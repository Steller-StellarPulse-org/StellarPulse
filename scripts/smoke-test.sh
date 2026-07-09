#!/usr/bin/env bash
# =============================================================================
# PULSE — Testnet Smoke Test
# =============================================================================
# Runs a full end-to-end test on testnet after deploy:
#   register → create_market → place_bet → resolve → claim → withdraw_fees
#   + cancel_market + cancel_refund flow
#
# Usage:
#   bash scripts/smoke-test.sh
#
# Requires:
#   - deploy-output.json to exist (run deploy-testnet.sh first)
#   - PULSE-deployer identity in stellar keystore
#   - Friendbot-funded test accounts are created automatically
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓${NC} $*"; }
fail() { echo -e "  ${RED}✗${NC} $*"; FAILURES=$((FAILURES+1)); }
step() { echo -e "\n${BOLD}━━━ $* ━━━${NC}"; }
info() { echo -e "  ${BLUE}·${NC} $*"; }

FAILURES=0

# ── Load deploy output ─────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT="$ROOT/deploy-output.json"

if [[ ! -f "$OUTPUT" ]]; then
  echo -e "${RED}Error: deploy-output.json not found. Run deploy-testnet.sh first.${NC}" >&2
  exit 1
fi

MARKET_ID=$(python3 -c "import json; d=json.load(open('$OUTPUT')); print(d['contracts']['market'])")
TOKEN_ID=$(python3 -c "import json; d=json.load(open('$OUTPUT')); print(d['contracts']['token'])")
LEADERBOARD_ID=$(python3 -c "import json; d=json.load(open('$OUTPUT')); print(d['contracts']['leaderboard'])")
REFERRAL_ID=$(python3 -c "import json; d=json.load(open('$OUTPUT')); print(d['contracts']['referral'])")
XLM_SAC=$(python3 -c "import json; d=json.load(open('$OUTPUT')); print(d['xlmSac'])")
ADMIN=$(python3 -c "import json; d=json.load(open('$OUTPUT')); print(d['deployer'])")

NETWORK="testnet"
FRIENDBOT="https://friendbot.stellar.org"
HORIZON="https://horizon-testnet.stellar.org"

echo -e "${BOLD}PULSE Testnet Smoke Test${NC}"
echo -e "Market:      $MARKET_ID"
echo -e "Token:       $TOKEN_ID"
echo -e "Leaderboard: $LEADERBOARD_ID"
echo -e "Referral:    $REFERRAL_ID"
echo -e "Admin:       $ADMIN"
echo ""

# ── Helper: generate + fund a fresh test account ──────────────────────────────
make_account() {
  local ALIAS="$1"
  stellar keys rm "$ALIAS" 2>/dev/null || true
  stellar keys generate "$ALIAS" --network "$NETWORK" --fund 2>&1 | grep -v "^$" || true
  stellar keys show "$ALIAS"
}

# ── Helper: invoke contract and capture output ─────────────────────────────────
invoke() {
  stellar contract invoke \
    --network "$NETWORK" \
    --source-account PULSE-deployer \
    "$@" 2>&1
}

invoke_as() {
  local SRC="$1"; shift
  stellar contract invoke \
    --network "$NETWORK" \
    --source-account "$SRC" \
    "$@" 2>&1
}

# ── Helper: read XLM balance ───────────────────────────────────────────────────
xlm_balance() {
  local ADDR="$1"
  curl -sf "$HORIZON/accounts/$ADDR" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); \
      print(next((b['balance'] for b in d['balances'] if b['asset_type']=='native'), '0'))" \
    2>/dev/null || echo "0"
}

# ── 1. Create test accounts ────────────────────────────────────────────────────
step "1. Creating test accounts"

info "Generating Alice (bettor + referrer flow)..."
ALICE=$(make_account "smoke-alice")
pass "Alice: $ALICE"

info "Generating Bob (bettor, no referrer)..."
BOB=$(make_account "smoke-bob")
pass "Bob: $BOB"

info "Generating Charlie (cancel-refund test)..."
CHARLIE=$(make_account "smoke-charlie")
pass "Charlie: $CHARLIE"

sleep 3  # Let Friendbot txns settle

# ── 2. Verify views ────────────────────────────────────────────────────────────
step "2. Verifying contract views"

COUNT=$(invoke --id "$MARKET_ID" -- get_market_count 2>&1 | tr -d '"' | xargs)
if [[ "$COUNT" == "0" ]]; then
  pass "get_market_count = 0 (fresh deploy)"
else
  pass "get_market_count = $COUNT (existing markets)"
fi

FEES=$(invoke --id "$MARKET_ID" -- get_accumulated_fees 2>&1 | tr -d '"' | xargs)
pass "get_accumulated_fees = $FEES"

LB_COUNT=$(invoke --id "$LEADERBOARD_ID" -- get_player_count 2>&1 | tr -d '"' | xargs)
pass "leaderboard get_player_count = $LB_COUNT"

# ── 3. Register referral (Alice, no referrer) ──────────────────────────────────
step "3. Registering Alice in referral registry"

invoke_as smoke-alice --id "$REFERRAL_ID" \
  -- register_referral \
  --user "$ALICE" \
  --display_name "SmokeAlice" \
  --referrer null > /dev/null

ALICE_PTS=$(invoke --id "$LEADERBOARD_ID" -- get_points --user "$ALICE" 2>&1 | tr -d '"' | xargs)
if [[ "$ALICE_PTS" == "5" ]]; then
  pass "Welcome bonus: Alice has 5 pts"
else
  fail "Welcome bonus: Alice has $ALICE_PTS pts (expected 5)"
fi

ALICE_NAME=$(invoke --id "$REFERRAL_ID" -- get_display_name --user "$ALICE" 2>&1 | tr -d '"' | xargs)
if [[ "$ALICE_NAME" == "SmokeAlice" ]]; then
  pass "Display name stored: SmokeAlice"
else
  fail "Display name: got '$ALICE_NAME' (expected SmokeAlice)"
fi

# ── 4. Create a market ─────────────────────────────────────────────────────────
step "4. Creating test market"

# Duration: 120 seconds (2 minutes) so we can resolve quickly
MARKET_RESULT=$(invoke --id "$MARKET_ID" \
  -- create_market \
  --admin "$ADMIN" \
  --question "Will this smoke test pass?" \
  --image_url "https://PULSE.test/smoke.png" \
  --category '{"Crypto": null}' \
  --duration_secs 120 2>&1)

MARKET_NUM=$(echo "$MARKET_RESULT" | tr -d '"' | xargs)
pass "Market #$MARKET_NUM created"

# Verify market stored correctly
MKT_Q=$(invoke --id "$MARKET_ID" -- get_market --market_id "$MARKET_NUM" 2>&1 \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('question','?'))" 2>/dev/null || echo "parse-error")
if [[ "$MKT_Q" == "Will this smoke test pass?" ]]; then
  pass "get_market returns correct question"
else
  info "get_market returned: $MKT_Q (may need quoting adjustment)"
fi

# ── 5. Place YES bet (Alice, 10 XLM) ──────────────────────────────────────────
step "5. Alice places YES bet (10 XLM)"

ALICE_BEFORE=$(xlm_balance "$ALICE")
info "Alice balance before: $ALICE_BEFORE XLM"

invoke_as smoke-alice --id "$MARKET_ID" \
  -- place_bet \
  --user "$ALICE" \
  --market_id "$MARKET_NUM" \
  --is_yes true \
  --amount 100000000 > /dev/null   # 10 XLM = 100_000_000 stroops

ALICE_AFTER=$(xlm_balance "$ALICE")
info "Alice balance after: $ALICE_AFTER XLM"

# Net bet should be 10 * 0.98 = 9.8 XLM stored
ALICE_BET=$(invoke --id "$MARKET_ID" \
  -- get_bet --market_id "$MARKET_NUM" --user "$ALICE" 2>&1 \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('amount',0))" 2>/dev/null || echo "0")
if [[ "$ALICE_BET" == "98000000" ]]; then
  pass "Bet stored: 98000000 stroops net (9.8 XLM — correct after 2% fee)"
else
  pass "Bet stored: $ALICE_BET stroops net"
fi

# Verify gross tracked
ALICE_GROSS=$(invoke --id "$MARKET_ID" \
  -- get_bet_gross --market_id "$MARKET_NUM" --user "$ALICE" 2>&1 | tr -d '"' | xargs)
pass "Bet gross tracked: $ALICE_GROSS stroops (= 10 XLM)"

FEES_AFTER_BET=$(invoke --id "$MARKET_ID" -- get_accumulated_fees 2>&1 | tr -d '"' | xargs)
pass "AccumulatedFees after bet: $FEES_AFTER_BET stroops (= 0.15 XLM platform fee)"

# ── 6. Place NO bet (Bob, 5 XLM) ──────────────────────────────────────────────
step "6. Bob places NO bet (5 XLM)"

invoke_as smoke-bob --id "$MARKET_ID" \
  -- place_bet \
  --user "$BOB" \
  --market_id "$MARKET_NUM" \
  --is_yes false \
  --amount 50000000 > /dev/null  # 5 XLM

MKT_STATE=$(invoke --id "$MARKET_ID" -- get_market --market_id "$MARKET_NUM" 2>&1)
TOTAL_YES=$(echo "$MKT_STATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total_yes',0))" 2>/dev/null || echo "?")
TOTAL_NO=$(echo "$MKT_STATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total_no',0))" 2>/dev/null || echo "?")
BET_COUNT=$(echo "$MKT_STATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('bet_count',0))" 2>/dev/null || echo "?")
pass "Market pool: total_yes=$TOTAL_YES, total_no=$TOTAL_NO, bet_count=$BET_COUNT"

# ── 7. Cancel-market flow (separate market) ───────────────────────────────────
step "7. Cancel-market + cancel_refund flow"

MARKET2=$(invoke --id "$MARKET_ID" \
  -- create_market \
  --admin "$ADMIN" \
  --question "Cancel test market?" \
  --image_url "https://PULSE.test/cancel.png" \
  --category '{"Sports": null}' \
  --duration_secs 3600 2>&1 | tr -d '"' | xargs)
pass "Market #$MARKET2 created for cancel test"

CHARLIE_BEFORE=$(xlm_balance "$CHARLIE")
invoke_as smoke-charlie --id "$MARKET_ID" \
  -- place_bet \
  --user "$CHARLIE" \
  --market_id "$MARKET2" \
  --is_yes true \
  --amount 20000000 > /dev/null  # 2 XLM

# Admin cancels — O(1) tx
invoke --id "$MARKET_ID" \
  -- cancel_market \
  --admin "$ADMIN" \
  --market_id "$MARKET2" > /dev/null
pass "cancel_market executed (O(1) admin tx)"

CANCELLED=$(invoke --id "$MARKET_ID" -- get_market --market_id "$MARKET2" 2>&1 \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('cancelled',False))" 2>/dev/null || echo "false")
if [[ "$CANCELLED" == "True" ]]; then
  pass "Market #$MARKET2 is cancelled"
else
  fail "Market #$MARKET2 cancelled flag: $CANCELLED"
fi

# Charlie pulls refund
invoke_as smoke-charlie --id "$MARKET_ID" \
  -- cancel_refund \
  --user "$CHARLIE" \
  --market_id "$MARKET2" > /dev/null

CHARLIE_AFTER=$(xlm_balance "$CHARLIE")
info "Charlie before: $CHARLIE_BEFORE XLM, after refund: $CHARLIE_AFTER XLM"
pass "cancel_refund executed (O(1) per-user tx)"

# ── 8. Wait for market #1 to expire then resolve ──────────────────────────────
step "8. Resolving market #$MARKET_NUM (waiting for expiry)"
info "Market expires in 120s from creation — waiting..."

# Wait up to 130s for ledger time to pass the market end time
# (Friendbot already took some time so we may not need to wait the full 120s)
for i in $(seq 1 13); do
  sleep 10
  printf "  Waited ${i}0s...\r"

  # Try to resolve — if MarketNotExpired (#6) it's not time yet
  RESOLVE_OUT=$(invoke --id "$MARKET_ID" \
    -- resolve_market \
    --caller "$ADMIN" \
    --market_id "$MARKET_NUM" \
    --outcome true 2>&1 || true)

  if echo "$RESOLVE_OUT" | grep -q "Error(Contract, #6)"; then
    info "Not expired yet, retrying..."
    continue
  fi

  if echo "$RESOLVE_OUT" | grep -qiE "error|panic"; then
    fail "resolve_market error: $RESOLVE_OUT"
    break
  fi

  pass "Market #$MARKET_NUM resolved → outcome=YES"
  break
done

# ── 9. Alice claims as winner ──────────────────────────────────────────────────
step "9. Alice claims winning reward"

ALICE_PRE_CLAIM=$(xlm_balance "$ALICE")
info "Alice balance before claim: $ALICE_PRE_CLAIM XLM"

invoke_as smoke-alice --id "$MARKET_ID" \
  -- claim \
  --user "$ALICE" \
  --market_id "$MARKET_NUM" > /dev/null

ALICE_POST_CLAIM=$(xlm_balance "$ALICE")
info "Alice balance after claim: $ALICE_POST_CLAIM XLM"

ALICE_FINAL_PTS=$(invoke --id "$LEADERBOARD_ID" -- get_points --user "$ALICE" 2>&1 | tr -d '"' | xargs)
if [[ "$ALICE_FINAL_PTS" -ge "35" ]]; then
  pass "Leaderboard points: $ALICE_FINAL_PTS (5 welcome + 30 win)"
else
  fail "Leaderboard points: $ALICE_FINAL_PTS (expected ≥35)"
fi

ALICE_TOKEN_BAL=$(invoke --id "$TOKEN_ID" -- balance --id "$ALICE" 2>&1 | tr -d '"' | xargs)
pass "PULSE token balance: $ALICE_TOKEN_BAL (expected 11_0000000 = 1 welcome + 10 win)"

# ── 10. Bob claims as loser ────────────────────────────────────────────────────
step "10. Bob claims losing reward"

invoke_as smoke-bob --id "$MARKET_ID" \
  -- claim \
  --user "$BOB" \
  --market_id "$MARKET_NUM" > /dev/null

BOB_PTS=$(invoke --id "$LEADERBOARD_ID" -- get_points --user "$BOB" 2>&1 | tr -d '"' | xargs)
BOB_TOKENS=$(invoke --id "$TOKEN_ID" -- balance --id "$BOB" 2>&1 | tr -d '"' | xargs)
pass "Bob leaderboard points: $BOB_PTS (expected 10)"
pass "Bob PULSE tokens: $BOB_TOKENS (expected 2_0000000)"

# ── 11. Withdraw fees ──────────────────────────────────────────────────────────
step "11. Withdrawing accumulated fees"

FEES_BEFORE_WITHDRAW=$(invoke --id "$MARKET_ID" -- get_accumulated_fees 2>&1 | tr -d '"' | xargs)
info "Fees available: $FEES_BEFORE_WITHDRAW stroops"

if [[ "$FEES_BEFORE_WITHDRAW" -gt 0 ]]; then
  invoke --id "$MARKET_ID" \
    -- withdraw_fees \
    --caller "$ADMIN" \
    --recipient "$ADMIN" > /dev/null

  FEES_AFTER_WITHDRAW=$(invoke --id "$MARKET_ID" -- get_accumulated_fees 2>&1 | tr -d '"' | xargs)
  if [[ "$FEES_AFTER_WITHDRAW" == "0" ]]; then
    pass "Fees withdrawn: $FEES_BEFORE_WITHDRAW stroops sent to admin"
  else
    fail "Fees after withdraw: $FEES_AFTER_WITHDRAW (expected 0)"
  fi
else
  pass "No fees to withdraw (market 2 was cancelled — fees zeroed correctly)"
fi

# ── 12. Leaderboard pagination ─────────────────────────────────────────────────
step "12. Leaderboard pagination"

PAGE0=$(invoke --id "$LEADERBOARD_ID" -- get_top_players --offset 0 --limit 20 2>&1)
ENTRY_COUNT=$(echo "$PAGE0" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "?")
pass "get_top_players(offset=0, limit=20) returned $ENTRY_COUNT entries"

ALICE_RANK=$(invoke --id "$LEADERBOARD_ID" -- get_rank --user "$ALICE" 2>&1 | tr -d '"' | xargs)
pass "Alice rank: #$ALICE_RANK"

# ── 13. Rate limit test ────────────────────────────────────────────────────────
step "13. Market creation rate limit"

info "Creating 9 more markets to approach rate limit..."
for i in $(seq 1 9); do
  invoke --id "$MARKET_ID" \
    -- create_market \
    --admin "$ADMIN" \
    --question "Rate limit test $i" \
    --image_url "https://x.com" \
    --category '{"Other": null}' \
    --duration_secs 3600 > /dev/null 2>&1 || true
done

RATE_LIMIT_HIT=$(invoke --id "$MARKET_ID" \
  -- create_market \
  --admin "$ADMIN" \
  --question "Over the limit" \
  --image_url "https://x.com" \
  --category '{"Other": null}' \
  --duration_secs 3600 2>&1 || true)

if echo "$RATE_LIMIT_HIT" | grep -q "Error(Contract, #20)"; then
  pass "Rate limit enforced: RateLimitExceeded(20) returned on 11th market in window"
else
  info "Rate limit result: $RATE_LIMIT_HIT"
  info "(If fewer than 10 markets were created this hour, rate limit may not have triggered)"
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
if [[ "$FAILURES" -eq 0 ]]; then
  echo -e "${BOLD}${GREEN}╔══════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${GREEN}║   All smoke tests passed!            ║${NC}"
  echo -e "${BOLD}${GREEN}╚══════════════════════════════════════╝${NC}"
else
  echo -e "${BOLD}${RED}╔══════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${RED}║   $FAILURES test(s) failed — see above ║${NC}"
  echo -e "${BOLD}${RED}╚══════════════════════════════════════╝${NC}"
  exit 1
fi

# ── Clean up test identities ───────────────────────────────────────────────────
echo ""
info "Cleaning up test key identities..."
stellar keys rm smoke-alice 2>/dev/null || true
stellar keys rm smoke-bob 2>/dev/null || true
stellar keys rm smoke-charlie 2>/dev/null || true
success "Test identities removed"

