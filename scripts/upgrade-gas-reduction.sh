#!/usr/bin/env bash
# =============================================================================
# PULSE — Gas-Reduction Upgrade (Levers E + A)
# =============================================================================
# Upgrades TWO contracts in place (no redeploy, no new addresses, storage kept):
#   • leaderboard      — Lever E: O(1) eviction (claim fees stay flat at scale)
#   • referral_registry — Lever A: packed registrant profile (cheaper register)
#
# NOT touched: prediction_market, PULSE_token (no logic change). The claim
# payout math and the resolve→claim money path are completely unchanged.
#
# Usage:
#   bash scripts/upgrade-gas-reduction.sh testnet   # verify first (free)
#   bash scripts/upgrade-gas-reduction.sh mainnet   # real upgrade (~1 XLM)
#
# Prerequisites:
#   1. PULSE-deployer key in stellar keystore (the contracts' admin).
#   2. Built WASM:  cd contracts && stellar contract build
#   3. Admin = GDZ4VJWNJPLNU3PAWDYX3V5XNATO7X257DPHWRPFXSCCNEUZ7QTXIIUI
#
# Security:
#   - Secret key stays in the keystore, never printed.
#   - upgrade() is admin-only and require_auth-gated on-chain.
#   - Storage is preserved across upgrade(); lazy migration means existing
#     users/data remain readable. Rollback = upgrade() back to the old hash.
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
WASM_DIR="$ROOT/contracts/target/wasm32v1-none/release"

NETWORK="${1:-}"
[ -z "$NETWORK" ] && error "Usage: $0 <testnet|mainnet>"

SOURCE="PULSE-deployer"

# ── Contract IDs (mainnet). For testnet, pass your testnet IDs via env. ────────
if [ "$NETWORK" = "mainnet" ]; then
  LEADERBOARD_ID="${LEADERBOARD_ID:-CCWWOQSDSO3XXLCMA6A2HYRUFYVNUJZ2HPAMFQSPOB4JWYIBY2HWVTOB}"
  REFERRAL_ID="${REFERRAL_ID:-CAGJVX6EXMCKKWDJCQFIEJ34CZTHZOGLWJM6KQTGDEXEO723CJZ5773H}"
  ADMIN="GDZ4VJWNJPLNU3PAWDYX3V5XNATO7X257DPHWRPFXSCCNEUZ7QTXIIUI"
else
  [ -z "${LEADERBOARD_ID:-}" ] && error "Set LEADERBOARD_ID + REFERRAL_ID env for testnet"
  [ -z "${REFERRAL_ID:-}" ] && error "Set LEADERBOARD_ID + REFERRAL_ID env for testnet"
  ADMIN="${ADMIN:?Set ADMIN env to your testnet admin public key}"
fi

if [ "$NETWORK" = "mainnet" ]; then
  echo ""
  echo -e "${RED}${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}${BOLD}║   MAINNET UPGRADE — REAL XLM WILL BE SPENT (~1 XLM)      ║${NC}"
  echo -e "${RED}${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
  read -r -p "Type 'UPGRADE' to proceed: " confirm
  [ "$confirm" = "UPGRADE" ] || error "Aborted."
fi

# ── Helper: install WASM, capture hash, upgrade() the contract ─────────────────
upgrade_contract() {
  local name="$1" cid="$2" wasm="$3"
  step "Upgrading $name ($cid)"

  [ -f "$wasm" ] || error "Missing WASM: $wasm (run: cd contracts && stellar contract build)"

  info "Installing new WASM bytecode on-chain…"
  local hash
  hash=$(stellar contract install \
    --wasm "$wasm" \
    --source "$SOURCE" \
    --network "$NETWORK")
  success "Installed. WASM hash: $hash"

  info "Invoking upgrade() (admin-only)…"
  stellar contract invoke \
    --id "$cid" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- upgrade \
    --admin "$ADMIN" \
    --new_wasm_hash "$hash"
  success "$name upgraded to $hash"
}

# ── Order: leaderboard first, then referral. Neither depends on the other's
#    new code; no minter changes; no market/token touch. Safe in any order. ─────
upgrade_contract "leaderboard"       "$LEADERBOARD_ID" "$WASM_DIR/leaderboard.wasm"
upgrade_contract "referral_registry" "$REFERRAL_ID"    "$WASM_DIR/referral_registry.wasm"

step "Post-upgrade smoke checks (read-only)"
info "Leaderboard get_player_count:"
stellar contract invoke --id "$LEADERBOARD_ID" --source "$SOURCE" --network "$NETWORK" --send=no -- get_player_count || true
info "Referral is_registered (admin, expect false unless registered):"
stellar contract invoke --id "$REFERRAL_ID" --source "$SOURCE" --network "$NETWORK" --send=no -- is_registered --user "$ADMIN" || true

success "Gas-reduction upgrade complete on $NETWORK."
echo ""
echo "Verify a full cycle (place_bet → resolve → claim → register) and confirm"
echo "the resource-fee drop in the wallet before announcing."

