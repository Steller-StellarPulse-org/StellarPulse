#!/usr/bin/env bash
# =============================================================================
# PULSE — Testnet Deploy Script
# =============================================================================
# Usage:
#   cp .deploy.env.example .deploy.env   # fill in your secret key
#   bash scripts/deploy-testnet.sh
#
# What it does:
#   1. Reads DEPLOYER_SECRET from .deploy.env (never echoed to terminal)
#   2. Builds optimised WASM for all 4 contracts
#   3. Uploads and instantiates each contract on Soroban testnet
#   4. Wires the contracts together (initialize calls)
#   5. Sets minters on the token contract
#   6. Funds deployer via Friendbot if balance is low
#   7. Writes all contract IDs to deploy-output.json and .env.local patch
#
# Security:
#   - Secret key is only used via --source-account flag — never printed
#   - deploy-output.json and .deploy.env are in .gitignore
#   - All contract IDs are public and safe to commit
# =============================================================================

set -euo pipefail

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}━━━ $* ━━━${NC}"; }

# ── Locate repo root ───────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACTS_DIR="$ROOT/contracts"
FRONTEND_DIR="$ROOT/frontend"

# ── Load secrets from .deploy.env ─────────────────────────────────────────────
DEPLOY_ENV_FILE="$ROOT/.deploy.env"
if [[ ! -f "$DEPLOY_ENV_FILE" ]]; then
  error ".deploy.env not found.  Run:  cp .deploy.env.example .deploy.env  then fill in your secret key."
fi

# shellcheck source=/dev/null
source "$DEPLOY_ENV_FILE"

if [[ -z "${DEPLOYER_SECRET:-}" ]]; then
  error "DEPLOYER_SECRET is empty in .deploy.env"
fi

# ── Network config ─────────────────────────────────────────────────────────────
NETWORK="testnet"
RPC_URL="https://soroban-testnet.stellar.org"
HORIZON_URL="https://horizon-testnet.stellar.org"
PASSPHRASE="Test SDF Network ; September 2015"
FRIENDBOT_URL="https://friendbot.stellar.org"

# XLM SAC on testnet (this is fixed — it's the native asset contract)
XLM_SAC_TESTNET="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

# ── Derive deployer public key without printing the secret ─────────────────────
# We import the key into a temp stellar identity named "PULSE-deployer"
# so subsequent commands use --source-account PULSE-deployer (reads keystore, not env).
step "Importing deployer identity"

# Remove any stale identity first
stellar keys rm PULSE-deployer 2>/dev/null || true

# Add the secret key to the local stellar keystore (file at ~/.config/stellar/identity/)
echo "$DEPLOYER_SECRET" | stellar keys add PULSE-deployer --secret-key 2>&1

DEPLOYER_PUBLIC=$(stellar keys show PULSE-deployer)
info "Deployer: $DEPLOYER_PUBLIC"

# ── Add testnet network config if not already present ─────────────────────────
stellar network add \
  --global testnet \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASSPHRASE" 2>/dev/null || true
success "Testnet network configured"

# ── Fund via Friendbot if balance < 50 XLM ────────────────────────────────────
step "Checking deployer balance"

BALANCE=$(curl -sf "$HORIZON_URL/accounts/$DEPLOYER_PUBLIC" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); \
    print(next((b['balance'] for b in d['balances'] if b['asset_type']=='native'), '0'))" \
  2>/dev/null || echo "0")

info "Current balance: $BALANCE XLM"

BALANCE_INT=$(echo "$BALANCE" | cut -d. -f1)
if [[ "$BALANCE_INT" -lt 50 ]]; then
  warn "Balance below 50 XLM — requesting Friendbot funding..."
  FB_RESULT=$(curl -sf "${FRIENDBOT_URL}?addr=${DEPLOYER_PUBLIC}" || echo '{"error":"friendbot failed"}')
  if echo "$FB_RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); exit(0 if 'envelope_xdr' in r or 'id' in r else 1)" 2>/dev/null; then
    success "Friendbot funded: 10,000 XLM"
  else
    warn "Friendbot response: $FB_RESULT"
    warn "Proceeding anyway — you may need to fund manually."
  fi
fi

# ── Build contracts ────────────────────────────────────────────────────────────
step "Building WASM (release)"
cd "$CONTRACTS_DIR"
cargo build --target wasm32v1-none --release --quiet 2>&1
success "Build complete"

WASM_DIR="$CONTRACTS_DIR/target/wasm32v1-none/release"

# Helper: deploy a single contract, print its contract ID
# Usage: deploy_contract <name> <wasm_file>
deploy_contract() {
  local NAME="$1"
  local WASM="$2"

  info "Uploading $NAME WASM..."
  local WASM_HASH
  WASM_HASH=$(stellar contract upload \
    --network "$NETWORK" \
    --source-account PULSE-deployer \
    --wasm "$WASM" \
    2>&1 | grep -E '^[0-9a-f]{64}$' | head -1)

  if [[ -z "$WASM_HASH" ]]; then
    # Try without filtering — upload might already print only the hash
    WASM_HASH=$(stellar contract upload \
      --network "$NETWORK" \
      --source-account PULSE-deployer \
      --wasm "$WASM")
  fi

  info "  Wasm hash: $WASM_HASH"

  info "Deploying $NAME contract..."
  local CONTRACT_ID
  CONTRACT_ID=$(stellar contract deploy \
    --network "$NETWORK" \
    --source-account PULSE-deployer \
    --wasm-hash "$WASM_HASH" \
    2>&1 | grep -E '^C[A-Z0-9]{55}$' | head -1)

  if [[ -z "$CONTRACT_ID" ]]; then
    CONTRACT_ID=$(stellar contract deploy \
      --network "$NETWORK" \
      --source-account PULSE-deployer \
      --wasm-hash "$WASM_HASH")
  fi

  success "$NAME deployed: $CONTRACT_ID"
  echo "$CONTRACT_ID"
}

# ── Deploy all contracts ───────────────────────────────────────────────────────
step "Deploying contracts"

TOKEN_ID=$(deploy_contract "PULSE_token"     "$WASM_DIR/PULSE_token.wasm")
LEADERBOARD_ID=$(deploy_contract "leaderboard"  "$WASM_DIR/leaderboard.wasm")
REFERRAL_ID=$(deploy_contract "referral_registry" "$WASM_DIR/referral_registry.wasm")
MARKET_ID=$(deploy_contract "prediction_market" "$WASM_DIR/prediction_market.wasm")

echo ""
info "Contract IDs:"
info "  token:       $TOKEN_ID"
info "  leaderboard: $LEADERBOARD_ID"
info "  referral:    $REFERRAL_ID"
info "  market:      $MARKET_ID"

# ── Initialize contracts ───────────────────────────────────────────────────────
step "Initializing contracts"

# 1. Token contract
info "Initializing PULSE_token..."
stellar contract invoke \
  --network "$NETWORK" \
  --source-account PULSE-deployer \
  --id "$TOKEN_ID" \
  -- initialize \
  --admin "$DEPLOYER_PUBLIC" \
  --name "PULSE" \
  --symbol "PLSE" \
  --decimals 7
success "PULSE_token initialized"

# 2. Leaderboard contract
info "Initializing leaderboard..."
stellar contract invoke \
  --network "$NETWORK" \
  --source-account PULSE-deployer \
  --id "$LEADERBOARD_ID" \
  -- initialize \
  --admin "$DEPLOYER_PUBLIC" \
  --market_contract "$MARKET_ID" \
  --referral_contract "$REFERRAL_ID"
success "leaderboard initialized"

# 3. Referral registry contract
info "Initializing referral_registry..."
stellar contract invoke \
  --network "$NETWORK" \
  --source-account PULSE-deployer \
  --id "$REFERRAL_ID" \
  -- initialize \
  --admin "$DEPLOYER_PUBLIC" \
  --market_contract "$MARKET_ID" \
  --token_contract "$TOKEN_ID" \
  --leaderboard_contract "$LEADERBOARD_ID" \
  --xlm_sac "$XLM_SAC_TESTNET"
success "referral_registry initialized"

# 4. Prediction market contract
info "Initializing prediction_market..."
stellar contract invoke \
  --network "$NETWORK" \
  --source-account PULSE-deployer \
  --id "$MARKET_ID" \
  -- initialize \
  --admin "$DEPLOYER_PUBLIC" \
  --token_contract "$TOKEN_ID" \
  --referral_contract "$REFERRAL_ID" \
  --leaderboard_contract "$LEADERBOARD_ID" \
  --xlm_sac "$XLM_SAC_TESTNET"
success "prediction_market initialized"

# ── Set minters on token contract ──────────────────────────────────────────────
step "Configuring token minters"

info "Setting market contract as minter..."
stellar contract invoke \
  --network "$NETWORK" \
  --source-account PULSE-deployer \
  --id "$TOKEN_ID" \
  -- set_minter \
  --minter "$MARKET_ID"
success "market_id is now a token minter"

info "Setting referral contract as minter..."
stellar contract invoke \
  --network "$NETWORK" \
  --source-account PULSE-deployer \
  --id "$TOKEN_ID" \
  -- set_minter \
  --minter "$REFERRAL_ID"
success "referral_id is now a token minter"

# ── Optional: add resolver ─────────────────────────────────────────────────────
if [[ -n "${RESOLVER_PUBLIC_KEY:-}" ]]; then
  step "Adding resolver"
  stellar contract invoke \
    --network "$NETWORK" \
    --source-account PULSE-deployer \
    --id "$MARKET_ID" \
    -- add_resolver \
    --admin "$DEPLOYER_PUBLIC" \
    --resolver "$RESOLVER_PUBLIC_KEY"
  success "Resolver added: $RESOLVER_PUBLIC_KEY"
fi

# ── Optional: set up sponsor as fee recipient ──────────────────────────────────
if [[ -n "${SPONSOR_SECRET:-}" ]]; then
  step "Configuring fee sponsorship"
  SPONSOR_PUBLIC=$(stellar keys show PULSE-deployer 2>/dev/null || \
    stellar keys generate PULSE-sponsor --secret-key <<< "$SPONSOR_SECRET" && \
    stellar keys show PULSE-sponsor)
  info "Sponsor: $SPONSOR_PUBLIC"
fi

# ── Write output ───────────────────────────────────────────────────────────────
step "Writing output files"

# deploy-output.json — machine readable, git-ignored
cat > "$ROOT/deploy-output.json" <<EOF
{
  "network": "testnet",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployer": "$DEPLOYER_PUBLIC",
  "contracts": {
    "token":       "$TOKEN_ID",
    "leaderboard": "$LEADERBOARD_ID",
    "referral":    "$REFERRAL_ID",
    "market":      "$MARKET_ID"
  },
  "xlmSac": "$XLM_SAC_TESTNET"
}
EOF
success "deploy-output.json written"

# Patch frontend .env.local with the new contract IDs
ENV_FILE="$FRONTEND_DIR/.env.local"
ENV_PATCH="$ROOT/env-patch-testnet.txt"

cat > "$ENV_PATCH" <<EOF
# ── Paste these lines into frontend/.env.local ────────────────────────────────
NEXT_PUBLIC_MARKET_CONTRACT_ID=$MARKET_ID
NEXT_PUBLIC_TOKEN_CONTRACT_ID=$TOKEN_ID
NEXT_PUBLIC_REFERRAL_CONTRACT_ID=$REFERRAL_ID
NEXT_PUBLIC_LEADERBOARD_CONTRACT_ID=$LEADERBOARD_ID
NEXT_PUBLIC_XLM_SAC_ID=$XLM_SAC_TESTNET
NEXT_PUBLIC_ADMIN_PUBLIC_KEY=$DEPLOYER_PUBLIC
EOF

# Auto-update .env.local if it exists
if [[ -f "$ENV_FILE" ]]; then
  python3 - "$ENV_FILE" "$MARKET_ID" "$TOKEN_ID" "$REFERRAL_ID" "$LEADERBOARD_ID" \
    "$XLM_SAC_TESTNET" "$DEPLOYER_PUBLIC" <<'PYEOF'
import sys, re

env_file, market, token, referral, leaderboard, xlm_sac, admin = sys.argv[1:]

with open(env_file, 'r') as f:
    content = f.read()

replacements = {
    'NEXT_PUBLIC_MARKET_CONTRACT_ID': market,
    'NEXT_PUBLIC_TOKEN_CONTRACT_ID': token,
    'NEXT_PUBLIC_REFERRAL_CONTRACT_ID': referral,
    'NEXT_PUBLIC_LEADERBOARD_CONTRACT_ID': leaderboard,
    'NEXT_PUBLIC_XLM_SAC_ID': xlm_sac,
    'NEXT_PUBLIC_ADMIN_PUBLIC_KEY': admin,
}

for key, val in replacements.items():
    pattern = rf'^({re.escape(key)})=.*$'
    replacement = f'{key}={val}'
    if re.search(pattern, content, re.MULTILINE):
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    else:
        content += f'\n{replacement}\n'

with open(env_file, 'w') as f:
    f.write(content)
print("Updated .env.local")
PYEOF
  success "frontend/.env.local updated automatically"
else
  warn ".env.local not found — copy env-patch-testnet.txt values manually"
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║              PULSE Testnet Deploy Complete!               ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Admin (deployer):  ${BOLD}$DEPLOYER_PUBLIC${NC}"
echo -e "  Market contract:   ${BOLD}$MARKET_ID${NC}"
echo -e "  Token contract:    ${BOLD}$TOKEN_ID${NC}"
echo -e "  Leaderboard:       ${BOLD}$LEADERBOARD_ID${NC}"
echo -e "  Referral:          ${BOLD}$REFERRAL_ID${NC}"
echo -e "  XLM SAC:           ${BOLD}$XLM_SAC_TESTNET${NC}"
echo ""
echo -e "  Explorer: https://testnet.stellar.expert/explorer/testnet"
echo -e "  Output:   deploy-output.json"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo -e "  1. cd frontend && npm run dev   (verify frontend connects)"
echo -e "  2. bash scripts/smoke-test.sh   (run quick function tests)"
echo -e "  3. Open the app and place a test bet"
echo ""

# ── Clean up temporary identity ────────────────────────────────────────────────
# The identity stays in ~/.config/stellar/identity/ for subsequent CLI calls.
# If you want to remove it: stellar keys rm PULSE-deployer
info "Identity 'PULSE-deployer' saved to stellar keystore for future CLI calls."
info "To remove it later: stellar keys rm PULSE-deployer"

