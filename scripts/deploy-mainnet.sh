#!/usr/bin/env bash
# =============================================================================
# PULSE — Mainnet Deploy Script
# =============================================================================
# Usage:
#   bash scripts/deploy-mainnet.sh
#
# Prerequisites:
#   1. The PULSE-deployer key must already be in your stellar keystore
#      (it was added during testnet deploy — run: stellar keys ls)
#   2. The deployer account must be funded on MAINNET with at least 10 XLM
#      Send XLM to: GDZ4VJWNJPLNU3PAWDYX3V5XNATO7X257DPHWRPFXSCCNEUZ7QTXIIUI
#   3. Contracts must already be built:
#      cd contracts && cargo build --target wasm32v1-none --release
#
# Security model:
#   - Secret key stays in stellar keystore (~/.stellar/identity/) — not printed
#   - All contract IDs written to deploy-mainnet-output.json (git-ignored)
#   - frontend/.env.local is NOT auto-updated — you must verify IDs first
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}━━━ $* ━━━${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACTS_DIR="$ROOT/contracts"
FRONTEND_DIR="$ROOT/frontend"

# ── Mainnet config ─────────────────────────────────────────────────────────────
NETWORK="mainnet"
RPC_URL="https://mainnet.sorobanrpc.com"
HORIZON_URL="https://horizon.stellar.org"
PASSPHRASE="Public Global Stellar Network ; September 2015"
# Native XLM SAC — DIFFERENT per network (derived from network passphrase).
# Mainnet value below. Testnet is CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC.
XLM_SAC="CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"

WASM_DIR="$CONTRACTS_DIR/target/wasm32v1-none/release"
OUTPUT_FILE="$ROOT/deploy-mainnet-output.json"

# ── Safety gate ────────────────────────────────────────────────────────────────
echo ""
echo -e "${RED}${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}${BOLD}║          MAINNET DEPLOYMENT — REAL XLM WILL BE SPENT    ║${NC}"
echo -e "${RED}${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Network:   ${BOLD}Stellar Mainnet${NC} (Public Global Stellar Network)"
echo -e "  RPC:       $RPC_URL"
echo -e "  Deployer:  $(stellar keys address PULSE-deployer 2>/dev/null || echo 'NOT FOUND')"
echo ""
echo -e "  ${YELLOW}This will spend approximately 7–10 XLM in deploy fees.${NC}"
echo -e "  ${YELLOW}All transactions are IRREVERSIBLE.${NC}"
echo ""
read -r -p "  Type 'deploy mainnet' to confirm: " CONFIRM
if [[ "$CONFIRM" != "deploy mainnet" ]]; then
  echo "Cancelled."
  exit 0
fi

# ── Verify deployer key exists in keystore ─────────────────────────────────────
step "Verifying deployer identity"
DEPLOYER=$(stellar keys address PULSE-deployer 2>&1) || \
  error "PULSE-deployer key not found in keystore. Run testnet deploy first or add key manually."
info "Deployer: $DEPLOYER"

# ── Add mainnet network to stellar CLI ────────────────────────────────────────
stellar network add \
  --global mainnet \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASSPHRASE" 2>/dev/null || true
success "Mainnet network configured (RPC: $RPC_URL)"

# ── Check deployer balance ─────────────────────────────────────────────────────
step "Checking mainnet balance"
BALANCE=$(curl -sf "$HORIZON_URL/accounts/$DEPLOYER" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(next(b['balance'] for b in d['balances'] if b['asset_type']=='native'))" \
  2>/dev/null) || error "Account $DEPLOYER not found on mainnet. Fund it with at least 10 XLM first."

info "Balance: $BALANCE XLM"
BALANCE_INT=${BALANCE%%.*}
if [[ "$BALANCE_INT" -lt 8 ]]; then
  error "Insufficient balance ($BALANCE XLM). Need at least 8 XLM. Send more XLM to $DEPLOYER"
fi
success "Balance sufficient: $BALANCE XLM"

# ── Verify WASM builds exist ───────────────────────────────────────────────────
step "Verifying WASM builds"
for WASM in PULSE_token leaderboard referral_registry prediction_market; do
  if [[ ! -f "$WASM_DIR/$WASM.wasm" ]]; then
    warn "Missing $WASM.wasm — rebuilding..."
    cd "$CONTRACTS_DIR"
    cargo build --target wasm32v1-none --release --quiet
    break
  fi
done
ls -lh "$WASM_DIR"/*.wasm | awk '{print "  "$5, $9}'
success "All WASM files present"

# ── Helper: deploy one contract and return its ID ─────────────────────────────
deploy_contract() {
  local NAME="$1"
  local WASM="$2"

  info "Deploying $NAME..."
  local OUT
  OUT=$(stellar contract deploy \
    --network "$NETWORK" \
    --source-account PULSE-deployer \
    --wasm "$WASM" 2>&1)

  local ID
  ID=$(echo "$OUT" | grep -oE "^C[A-Z0-9]{55}$" | head -1)
  if [[ -z "$ID" ]]; then
    ID=$(echo "$OUT" | grep -oE "C[A-Z0-9]{55}" | head -1)
  fi
  if [[ -z "$ID" ]]; then
    error "Failed to get contract ID for $NAME. Output: $OUT"
  fi
  success "$NAME: $ID"
  echo "$ID"
}

# ── Record balance helper ──────────────────────────────────────────────────────
get_bal() {
  curl -sf "$HORIZON_URL/accounts/$DEPLOYER" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(next(b['balance'] for b in d['balances'] if b['asset_type']=='native'))"
}

# ── Deploy ─────────────────────────────────────────────────────────────────────
step "Deploying 4 contracts to mainnet"
echo ""
info "Each deploy costs ~1–3 XLM (WASM upload + instantiation)."
info "Starting balance: $(get_bal) XLM"
echo ""

B_TOKEN=$(get_bal)
TOKEN_ID=$(deploy_contract "PULSE_token"     "$WASM_DIR/PULSE_token.wasm")
A_TOKEN=$(get_bal)
echo "  → Cost: $(python3 -c "print(f'{float(\"$B_TOKEN\")-float(\"$A_TOKEN\"):.7f}')") XLM"

B_LB=$(get_bal)
LEADERBOARD_ID=$(deploy_contract "leaderboard" "$WASM_DIR/leaderboard.wasm")
A_LB=$(get_bal)
echo "  → Cost: $(python3 -c "print(f'{float(\"$B_LB\")-float(\"$A_LB\"):.7f}')") XLM"

B_REF=$(get_bal)
REFERRAL_ID=$(deploy_contract "referral_registry" "$WASM_DIR/referral_registry.wasm")
A_REF=$(get_bal)
echo "  → Cost: $(python3 -c "print(f'{float(\"$B_REF\")-float(\"$A_REF\"):.7f}')") XLM"

B_MKT=$(get_bal)
MARKET_ID=$(deploy_contract "prediction_market" "$WASM_DIR/prediction_market.wasm")
A_MKT=$(get_bal)
echo "  → Cost: $(python3 -c "print(f'{float(\"$B_MKT\")-float(\"$A_MKT\"):.7f}')") XLM"

echo ""
info "Balance after deploy: $(get_bal) XLM"

# ── Initialize ─────────────────────────────────────────────────────────────────
step "Initializing contracts"

info "1/5 PULSE_token..."
B=$(get_bal)
stellar contract invoke --network "$NETWORK" --source-account PULSE-deployer \
  --id "$TOKEN_ID" -- initialize \
  --admin "$DEPLOYER" --name "PULSE" --symbol "PLSE" --decimals 7 2>&1 | \
  grep -v "^ℹ️\|^🌎\|^🔗"
echo "  → Cost: $(python3 -c "print(f'{float(\"$B\")-float(\"$(get_bal)\"):.7f}')") XLM"

info "2/5 leaderboard..."
B=$(get_bal)
stellar contract invoke --network "$NETWORK" --source-account PULSE-deployer \
  --id "$LEADERBOARD_ID" -- initialize \
  --admin "$DEPLOYER" --market_contract "$MARKET_ID" --referral_contract "$REFERRAL_ID" 2>&1 | \
  grep -v "^ℹ️\|^🌎\|^🔗"
echo "  → Cost: $(python3 -c "print(f'{float(\"$B\")-float(\"$(get_bal)\"):.7f}')") XLM"

info "3/5 referral_registry..."
B=$(get_bal)
stellar contract invoke --network "$NETWORK" --source-account PULSE-deployer \
  --id "$REFERRAL_ID" -- initialize \
  --admin "$DEPLOYER" --market_contract "$MARKET_ID" \
  --token_contract "$TOKEN_ID" --leaderboard_contract "$LEADERBOARD_ID" \
  --xlm_sac "$XLM_SAC" 2>&1 | grep -v "^ℹ️\|^🌎\|^🔗"
echo "  → Cost: $(python3 -c "print(f'{float(\"$B\")-float(\"$(get_bal)\"):.7f}')") XLM"

info "4/5 prediction_market..."
B=$(get_bal)
stellar contract invoke --network "$NETWORK" --source-account PULSE-deployer \
  --id "$MARKET_ID" -- initialize \
  --admin "$DEPLOYER" --token_contract "$TOKEN_ID" \
  --referral_contract "$REFERRAL_ID" --leaderboard_contract "$LEADERBOARD_ID" \
  --xlm_sac "$XLM_SAC" 2>&1 | grep -v "^ℹ️\|^🌎\|^🔗"
echo "  → Cost: $(python3 -c "print(f'{float(\"$B\")-float(\"$(get_bal)\"):.7f}')") XLM"

info "5/5 set_minter (market + referral)..."
B=$(get_bal)
stellar contract invoke --network "$NETWORK" --source-account PULSE-deployer \
  --id "$TOKEN_ID" -- set_minter --minter "$MARKET_ID" 2>&1 | grep -v "^ℹ️\|^🌎\|^🔗"
stellar contract invoke --network "$NETWORK" --source-account PULSE-deployer \
  --id "$TOKEN_ID" -- set_minter --minter "$REFERRAL_ID" 2>&1 | grep -v "^ℹ️\|^🌎\|^🔗"
echo "  → Cost: $(python3 -c "print(f'{float(\"$B\")-float(\"$(get_bal)\"):.7f}')") XLM"

# ── Write output ───────────────────────────────────────────────────────────────
step "Writing output"

FINAL_BAL=$(get_bal)
TOTAL_SPENT=$(python3 -c "print(f'{float(\"$(get_bal)\") - float(\"$BALANCE\"):.4f}')" 2>/dev/null || echo "?")

cat > "$OUTPUT_FILE" << EOF
{
  "network": "mainnet",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployer": "$DEPLOYER",
  "sdkVersion": "26.0.1",
  "cliVersion": "23.0.0",
  "contracts": {
    "token":       "$TOKEN_ID",
    "leaderboard": "$LEADERBOARD_ID",
    "referral":    "$REFERRAL_ID",
    "market":      "$MARKET_ID"
  },
  "xlmSac": "$XLM_SAC",
  "notes": "Review contract IDs before updating frontend .env.local"
}
EOF

success "deploy-mainnet-output.json written"

# ── Print env vars to paste (NOT auto-applied — you verify first) ──────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║           Mainnet Deploy Complete!                       ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Balance before: $BALANCE XLM"
echo -e "  Balance after:  $FINAL_BAL XLM"
echo ""
echo -e "  ${BOLD}Contract IDs (verify on Stellar Expert before using):${NC}"
echo -e "  Token:       $TOKEN_ID"
echo -e "  Leaderboard: $LEADERBOARD_ID"
echo -e "  Referral:    $REFERRAL_ID"
echo -e "  Market:      $MARKET_ID"
echo ""
echo -e "  ${BOLD}Explorer links:${NC}"
echo -e "  https://stellar.expert/explorer/public/contract/$MARKET_ID"
echo -e "  https://stellar.expert/explorer/public/contract/$TOKEN_ID"
echo ""
echo -e "${YELLOW}  ⚠️  DO NOT auto-update .env.local until you have verified${NC}"
echo -e "${YELLOW}     the contract IDs on stellar.expert above.${NC}"
echo ""
echo -e "  When verified, paste into ${BOLD}frontend/.env.local${NC}:"
echo ""
cat << ENVBLOCK
NEXT_PUBLIC_MARKET_CONTRACT_ID=$MARKET_ID
NEXT_PUBLIC_TOKEN_CONTRACT_ID=$TOKEN_ID
NEXT_PUBLIC_REFERRAL_CONTRACT_ID=$LEADERBOARD_ID
NEXT_PUBLIC_LEADERBOARD_CONTRACT_ID=$LEADERBOARD_ID
NEXT_PUBLIC_XLM_SAC_ID=$XLM_SAC
NEXT_PUBLIC_ADMIN_PUBLIC_KEY=$DEPLOYER
NEXT_PUBLIC_SOROBAN_RPC_URL=https://mainnet.sorobanrpc.com
NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
ENVBLOCK

