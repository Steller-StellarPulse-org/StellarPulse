# Contract Calls and ABI Examples

This guide gives quick examples for calling the main StellarPulse contract
methods through Soroban RPC tooling. Values are placeholders unless they are
listed in the deployed contract table.

## Deployed Contracts

| Contract | Mainnet address |
|----------|-----------------|
| Prediction Market | `CDGNPRYTFDXJLWZE4YDKZXW4IEN2RLPSE4N7VM5HJ7NLPL2QC45GIXI5` |
| PULSE Token | `CAYL4TKNRMXAX5ZLQGFEZ6XOC2QHTCTN5QC2SB5BEEHLVO6SDU2UBLRH` |
| Referral Registry | `CAGJVX6EXMCKKWDJCQFIEJ34CZTHZOGLWJM6KQTGDEXEO723CJZ5773H` |
| Leaderboard | `CCWWOQSDSO3XXLCMA6A2HYRUFYVNUJZ2HPAMFQSPOB4JWYIBY2HWVTOB` |

## Environment

```bash
export STELLAR_RPC_URL="https://soroban-rpc.mainnet.stellar.gateway.fm"
export STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
export PREDICTION_MARKET_ID="CDGNPRYTFDXJLWZE4YDKZXW4IEN2RLPSE4N7VM5HJ7NLPL2QC45GIXI5"
```

For testnet work, replace the RPC URL, network passphrase, and contract IDs with
the deployed testnet values.

## Prediction Market ABI

| Method | Arguments | Result |
|--------|-----------|--------|
| `place_bet` | `user`, `market_id`, `is_yes`, `amount` | Records or increases a YES/NO bet after applying fees. |
| `resolve_market` | `admin`, `market_id`, `outcome` | Resolves a market with the final YES/NO outcome. |
| `claim` | `user`, `market_id` | Claims winnings, points, and token rewards for an eligible user. |

## Example: place_bet

Use `place_bet` when a user chooses a side and submits an amount.

```bash
soroban contract invoke \
  --rpc-url "$STELLAR_RPC_URL" \
  --network-passphrase "$STELLAR_NETWORK_PASSPHRASE" \
  --id "$PREDICTION_MARKET_ID" \
  --source "$USER_SECRET_KEY" \
  -- \
  place_bet \
  --user "$USER_ADDRESS" \
  --market_id 1 \
  --is_yes true \
  --amount 10000000
```

Notes:
- `market_id` is the numeric market identifier.
- `is_yes=true` places a YES bet; `false` places a NO bet.
- `amount` should be passed in the token's smallest unit.

## Example: resolve_market

Use `resolve_market` after the event outcome is known. This should be called by
an authorized admin source.

```bash
soroban contract invoke \
  --rpc-url "$STELLAR_RPC_URL" \
  --network-passphrase "$STELLAR_NETWORK_PASSPHRASE" \
  --id "$PREDICTION_MARKET_ID" \
  --source "$ADMIN_SECRET_KEY" \
  -- \
  resolve_market \
  --admin "$ADMIN_ADDRESS" \
  --market_id 1 \
  --outcome true
```

Notes:
- `outcome=true` resolves the market as YES.
- `outcome=false` resolves the market as NO.
- Clients should refresh odds, claim state, and leaderboard rows after
  resolution.

## Example: claim

Use `claim` after a market is resolved and the user is eligible to receive
rewards.

```bash
soroban contract invoke \
  --rpc-url "$STELLAR_RPC_URL" \
  --network-passphrase "$STELLAR_NETWORK_PASSPHRASE" \
  --id "$PREDICTION_MARKET_ID" \
  --source "$USER_SECRET_KEY" \
  -- \
  claim \
  --user "$USER_ADDRESS" \
  --market_id 1
```

Notes:
- The user should claim only once per resolved market.
- The frontend should show a pending state while the transaction is submitted
  and refresh balances after confirmation.

## Raw RPC Shape

When integrating without the CLI, construct a Soroban transaction client-side,
simulate it with the configured RPC server, sign it, submit it, then poll the
transaction status. The application should keep the same argument order as the
contract ABI:

```ts
const placeBetArgs = {
  method: "place_bet",
  args: {
    user: userAddress,
    market_id: 1,
    is_yes: true,
    amount: "10000000",
  },
};

const resolveMarketArgs = {
  method: "resolve_market",
  args: {
    admin: adminAddress,
    market_id: 1,
    outcome: true,
  },
};

const claimArgs = {
  method: "claim",
  args: {
    user: userAddress,
    market_id: 1,
  },
};
```

## Verification Checklist

- Confirm the RPC URL and network passphrase match the target network.
- Confirm the contract ID is for the same deployment listed in the README.
- Simulate the transaction before signing.
- Submit with the correct source account.
- Refresh market, leaderboard, and wallet state after the transaction succeeds.
