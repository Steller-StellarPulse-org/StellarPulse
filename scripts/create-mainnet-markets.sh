#!/usr/bin/env bash
# =============================================================================
# PULSE — Create seed markets on mainnet after deploy
# =============================================================================
# Usage:
#   bash scripts/create-mainnet-markets.sh
#
# Prerequisites:
#   - deploy-mainnet.sh must have run successfully
#   - deploy-mainnet-output.json must exist
#   - PULSE-deployer key must be in stellar keystore
#   - Edit scripts/mainnet-markets.json first to review/adjust questions
#
# Each market creation costs ~0.05–0.10 XLM on mainnet.
# 7 markets = ~0.35–0.70 XLM total.
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT="$ROOT/deploy-mainnet-output.json"
MARKETS_FILE="$SCRIPT_DIR/mainnet-markets.json"

# ── Load deployed contract ID ──────────────────────────────────────────────────
if [[ ! -f "$OUTPUT" ]]; then
  echo "Error: deploy-mainnet-output.json not found. Run deploy-mainnet.sh first." >&2
  exit 1
fi

MARKET_ID=$(python3 -c "import json; print(json.load(open('$OUTPUT'))['contracts']['market'])")
DEPLOYER=$(python3 -c "import json; print(json.load(open('$OUTPUT'))['deployer'])")
HORIZON="https://horizon.stellar.org"

get_bal() {
  curl -sf "$HORIZON/accounts/$DEPLOYER" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(next(b['balance'] for b in d['balances'] if b['asset_type']=='native'))"
}

echo ""
echo -e "${BOLD}PULSE — Mainnet Market Creation${NC}"
echo -e "Market contract: $MARKET_ID"
echo -e "Admin:           $DEPLOYER"
echo -e "Balance:         $(get_bal) XLM"
echo ""
echo -e "${YELLOW}Markets to create (from mainnet-markets.json):${NC}"
python3 -c "
import json
markets = json.load(open('$MARKETS_FILE'))
for m in markets:
    resolves = m.get('resolves', f'{m[\"duration_days\"]} days')
    print(f'  [{m[\"id\"]}] {m[\"category\"]:15} Resolves: {resolves}')
    print(f'       {m[\"question\"][:75]}')
    print()
"
echo ""
read -r -p "Review the questions above. Type 'create' to proceed: " CONFIRM
if [[ "$CONFIRM" != "create" ]]; then
  echo "Cancelled. Edit scripts/mainnet-markets.json then re-run."
  exit 0
fi

echo ""
info "Creating markets on mainnet..."
echo ""

# Map category name to Stellar CLI JSON format
category_arg() {
  case "$1" in
    Crypto)        echo '{"Crypto": null}' ;;
    Sports)        echo '{"Sports": null}' ;;
    Politics)      echo '{"Politics": null}' ;;
    Entertainment) echo '{"Entertainment": null}' ;;
    Science)       echo '{"Science": null}' ;;
    *)             echo '{"Other": null}' ;;
  esac
}

CREATED=0
FAILED=0

python3 -c "
import json
markets = json.load(open('$MARKETS_FILE'))
for m in markets:
    secs = m.get('duration_secs', m['duration_days'] * 86400)
    resolves = m.get('resolves', f\"{m['duration_days']} days\")
    print(f\"{m['id']}|{m['category']}|{m['question']}|{m['image_url']}|{secs}|{resolves}\")
" | while IFS='|' read -r IDX CATEGORY QUESTION IMAGE_URL DURATION_SECS RESOLVES; do

  info "Creating market $IDX: ${QUESTION:0:60}..."
  B=$(get_bal)

  RESULT=$(stellar contract invoke \
    --network mainnet \
    --source-account PULSE-deployer \
    --id "$MARKET_ID" \
    -- create_market \
    --admin "$DEPLOYER" \
    --question "$QUESTION" \
    --image_url "$IMAGE_URL" \
    --category "$(category_arg "$CATEGORY")" \
    --duration_secs "$DURATION_SECS" 2>&1 || true)

  A=$(get_bal)
  MARKET_NUM=$(echo "$RESULT" | grep -oE "^[0-9]+$" | head -1)
  COST=$(python3 -c "print(f'{float(\"$B\")-float(\"$A\"):.7f}')")

  if [[ -n "$MARKET_NUM" ]]; then
    success "Market #$MARKET_NUM created — cost: $COST XLM"
    success "  Question: $QUESTION"
    success "  Resolves: $RESOLVES"
    success "  Image:    $IMAGE_URL"
  else
    warn "Market $IDX may have failed. Output: ${RESULT:0:200}"
  fi
  echo ""

done

echo ""
echo -e "${BOLD}${GREEN}Done!${NC}"
echo -e "Final balance: $(get_bal) XLM"
echo ""
echo -e "View your markets:"
echo -e "  https://stellar.expert/explorer/public/contract/$MARKET_ID"
echo -e "  https://PULSE-stellar.vercel.app/markets"

