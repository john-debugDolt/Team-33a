# Bonus, Rollover & Bonus Conversion — Frontend Integration

_Audience: admin-panel and player-app frontend devs._
_Status: 2026-06-18, post Design-C rollover deploy._

---

## 1. Mental model

Three concepts, one ledger:

1. **Bonus catalog** (`bonuses` table) — admin-defined promotions. One row per code (e.g. `WELCOME50`).
2. **Bonus wallet** (`bonus_wallet` + `bonus_transactions`) — the player's gifted-credit balance and its immutable ledger. **All bonuses land here**, never on the main wallet.
3. **Rollover** (Design-C, normalised 0–1) — wagering requirement, tracked **on `bonus_wallet`** (no separate turnover table on the player's main wallet).
4. **Bonus conversion** (`bonus_conversion_requests`) — admin-reviewed sweep from `bonus_wallet` → main wallet, gated on rollover completion.

End-to-end lifecycle:

```
admin creates a row in `bonuses`
        │
        ▼  player claims (free OR with deposit)
funds land in `bonus_wallet`         ← main wallet is locked (restricted=true derived from balance > 0)
        │
        ▼  player wagers; each provider bet debits bonus_wallet
rollover_completed = (original_bonus_credited - balance) / rollover_denominator
        │
        ▼  trigger fires when balance hits 0 (full loss) OR rollover_completed >= 1
`bonus_conversion_requests` (PENDING)
        │
        ▼  admin reviews + approves
wallet-service atomically sweeps bonus_wallet → main wallet
        │
        ▼
request status = COMPLETED, main wallet unlocked, player can withdraw
```

---

## 2. Hosts & routing

| Frontend                  | Base URL                                       | Notes                                                                                                          |
| ------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Player web/app**        | `https://accounts.team33.mx`                   | All player traffic. NLB fronting accounts-service (port 443 → 8086, ACM cert). accounts-service proxies to wallet-service internally. |
| **Admin panel**           | `https://api.team33.mx`                        | Admin BFF (admin-service ALB). Proxies to accounts-service + wallet-service. Requires Keycloak JWT.            |
| _wallet-service (direct)_ | `wallet-service:8085` (cluster-internal only)  | Frontends never call this directly. The `seamless.team33.mx` ALB also points at wallet-service but is reserved for game-provider seamless callbacks — not for player/admin frontends. |

**Auth.** Admin panel attaches a Keycloak JWT (`Authorization: Bearer ...`); the BFF gates routes on roles `ADMIN` or `STAFF`. Player endpoints currently do not require JWT (account_id is on the path) — change-of-record will land when player Keycloak ships.

**Currency** is AUD throughout. The `currency` field on responses is always `"AUD"`; ignore unless multi-currency is announced.

**Money fields** are decimal strings with up to 4 decimal places (DB column type `DECIMAL(19,4)`). Treat them as decimal strings in JS — never parse to `Number` for math.

---

## 3. Player-facing endpoints

### 3.1 List available bonuses

```
GET /api/bonuses/available
```

Returns the active promotional bonuses to render as cards. Each card's `description` field contains the **full T&C text** ready to display (including unicode arrows ➤, ⚠, ✓, ✘ and newlines).

**Response** (200):

```json
[
  {
    "id": 1,
    "bonusCode": "WELCOME50",
    "displayName": "Welcome Bonus 50%",
    "description": "Welcome Bonus\n➤ 50% Bonus\n➤ Winover/Turnover X5\n...",
    "bonusType": "PERCENTAGE",
    "bonusValue": "50.0000",
    "maxBonusAmount": "388.0000",
    "minDeposit": "100.0000",
    "maxDeposit": null,
    "turnoverMultiplier": "5.00",
    "claimPeriod": "NONE",
    "minWithdrawAmount": null,
    "maxWithdrawAmount": null,
    "weeklyDepositRequired": null,
    "streakDay": null,
    "streakGroup": null,
    "isActive": true,
    "requiresCode": false
  }
]
```

Filter rules to know:
- `requiresCode: true` rows are **not** in `/available` — they only return via `/validate/{code}`.
- `claimPeriod`: `"NONE"` (one-time) / `"DAILY"` / `"WEEKLY"`. Frontend should label the card accordingly.
- `streakDay` + `streakGroup` mean it's part of a 7-day check-in series; render as a streak tile, not a standalone bonus.

### 3.2 Validate a promo code

```
GET /api/bonuses/validate/{code}
```

Used when the user types a code (e.g. on the deposit page). Returns the bonus row if valid (active, in date range, claims available), or 400 with an error message.

### 3.3 Claim a free bonus (no deposit)

```
POST /api/bonuses/claim
Content-Type: application/json

{ "accountId": "ACC123...", "bonusId": 44 }
```

or by code:

```json
{ "accountId": "ACC123...", "bonusCode": "DAILY_FREE_5" }
```

Only bonuses with `minDeposit == 0` are claimable via this endpoint. The bonus amount lands in `bonus_wallet`. `rollover_denominator` extends by `bonus_amount × turnover_multiplier` automatically.

**200**: bonus claim row (see 3.4 shape).
**400** on:
- "You have already claimed this bonus today. Try again tomorrow." — DAILY bonus, already claimed today
- "You have already claimed this bonus this week." — WEEKLY bonus, already claimed this ISO week
- "You have already claimed this bonus" — NONE (one-time)
- "Weekly deposit requirement not met: need $X deposited this week, have $Y" — weekly rebate gate failed
- "This bonus requires a deposit. Use the deposit flow instead." — wrong endpoint
- "Bonus is not available" — inactive / out of date range / max_claims hit

### 3.4 Claim a bonus with a deposit

The deposit flow accepts an optional `bonusId` / `promoCode`. The bonus is credited immediately on deposit submission (not on admin approval — the bonus_wallet credit is independent of the deposit's main-wallet credit).

```
POST /api/deposits/initiate
{ "accountId": "ACC123...", "amount": "100.00", "bonusId": 1 }
```

Response includes the message:

> "Deposit initiated with bonus 'Welcome Bonus 50%'. Bonus $50 credited to wallet. Turnover requirement: ..."

### 3.5 My claims

```
GET /api/bonuses/my-claims/{accountId}
```

Player's claim history, newest first.

```json
[
  {
    "id": 99,
    "bonusId": 44,
    "accountId": "ACC123...",
    "depositId": "FREE_CLAIM_FREE_CLAIM_DAILY_FREE_5_AB12CD34",
    "depositAmount": "0.0000",
    "bonusAmount": "5.0000",
    "turnoverRequired": "100.0000",
    "status": "CREDITED",
    "creditedAt": "2026-06-17T08:32:11",
    "createdAt": "2026-06-17T08:32:11"
  }
]
```

Status values: `PENDING` → `CREDITED` | `CANCELLED` | `EXPIRED`.

### 3.6 Bonus wallet balance

```
GET /api/bonus-wallet/{accountId}/balance
```

```json
{ "accountId": "ACC123...", "balance": "5.0000" }
```

This is the **gifted-credit** balance, not the main wallet. The header bar usually shows whichever is non-zero (see `GET /api/accounts/{id}/balance` on accounts-service for the bonus-first composite).

### 3.7 Rollover progress (**NEW — Design-C**)

```
GET /api/bonus-wallet/{accountId}/rollover
```

```json
{
  "accountId": "ACC123...",
  "balance": "3.0000",
  "originalBonusCredited": "5.0000",
  "rolloverRequired": "1.0000",
  "rolloverCompleted": "0.0200",
  "rolloverDenominator": "100.0000"
}
```

**Reading it on the frontend:**
- `rolloverRequired` is **always 1.0** — it's a constant scale. Don't render it.
- Show progress as `rolloverCompleted` × 100 percent toward unlock. The above example is 2% complete.
- The bonus unlocks (conversion request fires) when `rolloverCompleted >= 1.0` OR `balance == 0` (full loss path).
- If `originalBonusCredited == 0` and `balance == 0`, the player has no active round — show "No active bonus."

Empty-row case (account has never received a bonus): the endpoint returns the same shape with all monetary fields = "0.0000" and `rolloverRequired = "1.0000"`.

### 3.8 Bonus transaction history

```
GET /api/bonus-wallet/{accountId}/transactions
```

Returns the immutable ledger: `CREDIT_GRANT`, `DEBIT_PROVIDER_DEPOSIT` (bet), `CREDIT_PROVIDER_WITHDRAW` (win), `DEBIT_CLEAR_BALANCE`, `DEBIT_REVOKE`, etc. Each row carries `balanceAfter` so you can render a running balance without recomputing.

### 3.9 Check-in bonus (legacy parallel system)

```
POST /api/checkin-bonus/claim
{ "accountId": "ACC123..." }
```

This is **a different mechanism** from the `DAILY_CHECKIN_1..7` rows in the bonuses table — those are seeded inactive and aren't wired to a streak engine yet. Use `/api/checkin-bonus/claim` for the existing streak product.

---

## 4. Admin-facing endpoints

> **All admin endpoints require `Authorization: Bearer <JWT>` with role `ADMIN` or `STAFF`.**
> Admin panel calls these via the admin-service BFF; admin-service forwards to the underlying service with an internal API key.

### 4.1 Bonus catalog CRUD ⭐ **ADMIN**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/bonuses` | List all bonuses (incl. inactive, incl. requires_code). |
| `GET` | `/api/admin/bonuses/{bonusId}` | Single bonus by id. |
| `GET` | `/api/admin/bonuses/code/{bonusCode}` | Single bonus by code. |
| `GET` | `/api/admin/bonuses/filter?isActive=&bonusType=` | Filtered list. |
| `PUT` | `/api/admin/bonuses/{bonusId}` | Update fields. Pass only the fields you want to change. |
| `POST` | `/api/admin/bonuses/{bonusId}/activate` | Sets `is_active = true`. |
| `POST` | `/api/admin/bonuses/{bonusId}/deactivate` | Sets `is_active = false`. |
| `DELETE` | `/api/admin/bonuses/{bonusId}` | Soft delete (deactivates). |

**PUT request body** — any subset of:

```json
{
  "displayName": "...",
  "description": "...",
  "bonusType": "PERCENTAGE" | "FIXED",
  "bonusValue": "50",
  "maxBonusAmount": "388",
  "minDeposit": "100",
  "maxDeposit": null,
  "turnoverMultiplier": "5",
  "maxClaims": null,
  "isActive": true,
  "requiresCode": false,
  "startDate": "2026-06-18T00:00:00",
  "endDate": null,
  "claimPeriod": "NONE" | "DAILY" | "WEEKLY",
  "minWithdrawAmount": null,
  "maxWithdrawAmount": "777",
  "weeklyDepositRequired": "300",
  "streakDay": null,
  "streakGroup": null
}
```

### 4.2 View claims ⭐ **ADMIN**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/bonuses/{bonusId}/claims` | Who claimed this bonus. |
| `GET` | `/api/admin/bonuses/claims/account/{accountId}` | All claims by an account. |

### 4.3 Direct credit ⭐ **ADMIN**

For VIP/goodwill/marketing credits with no deposit attached.

```
POST /api/admin/bonuses/credit-direct
{
  "accountId": "ACC123...",
  "bonusAmount": "50.00",
  "turnoverMultiplier": "5",            // optional; if present, extends rollover
  "reference": "VIP_GOODWILL_NOV",      // optional; auto-generated if omitted
  "reason": "VIP retention November"
}
```

Today this credits the **main wallet** (legacy behaviour). The team has agreed to change this so direct credits also land in `bonus_wallet` — see PR follow-up. Until that ships, direct credits bypass the rollover loop, which is the documented behaviour.

**Response**:

```json
{
  "status": "SUCCESS",
  "accountId": "ACC123...",
  "bonusAmount": "50.0000",
  "turnoverRequired": "250.0000",
  "reference": "VIP_GOODWILL_NOV",
  "reason": "VIP retention November"
}
```

### 4.4 Bonus conversion queue ⭐ **ADMIN**

The conversion request is the gate between `bonus_wallet` and the player's main wallet. Wallet-service creates the row when rollover completes; admin reviews here.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/bonus-conversions/pending` | The work queue (status = `PENDING`). |
| `GET` | `/api/admin/bonus-conversions/status/{status}` | `PENDING` \| `APPROVED` \| `REJECTED` \| `COMPLETED`. |
| `GET` | `/api/admin/bonus-conversions/account/{accountId}` | Per-account history. |
| `GET` | `/api/admin/bonus-conversions/{requestId}` | Single request. |
| `GET` | `/api/admin/bonus-conversions/stats` | `{ "PENDING": 5, "APPROVED": 12, ... }` for the dashboard. |
| `POST` | `/api/admin/bonus-conversions/{requestId}/approve` | Approves; wallet-service sweeps bonus_wallet → main wallet atomically. |
| `POST` | `/api/admin/bonus-conversions/{requestId}/reject` | Rejects; no money moves. |

**Approve / reject body**:

```json
{ "adminId": "admin1", "notes": "Reviewed by Sam — looks legit." }
```

**Request shape**:

```json
{
  "requestId": "BCR1781330842000001",
  "accountId": "ACC123...",
  "amount": "5.0000",
  "currency": "AUD",
  "status": "PENDING",
  "rolloverRef": "TURNOVER_COMPLETED_ACC123_178133...",
  "adminNotes": null,
  "reviewedBy": null,
  "createdAt": "2026-06-18T03:15:22",
  "updatedAt": "2026-06-18T03:15:22",
  "reviewedAt": null,
  "completedAt": null
}
```

State transitions you'll see:
- `PENDING` → `APPROVED` (admin clicks approve; wallet-service hasn't swept yet)
- `APPROVED` → `COMPLETED` (sweep finished; player can withdraw)
- `PENDING` → `REJECTED` (terminal; no sweep)

### 4.5 Admin bonus ledger ⭐ **ADMIN**

```
GET /api/admin/bonus-ledger/{accountId}
```

Same shape as `/api/bonus-wallet/{id}/transactions` but with admin-only fields. Use for the player-detail page audit timeline.

### 4.6 Rollover / turnover settings ⭐ **ADMIN**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/turnover-settings` | All settings (rows: `DEPOSIT`, `BONUS`). |
| `GET` | `/api/admin/turnover-settings/type/{settingType}` | One. |
| `PUT` | `/api/admin/turnover-settings/{id}` | Update by id. |
| `PUT` | `/api/admin/turnover-settings/type/{settingType}` | Update by type. |
| `POST` | `/api/admin/turnover-settings/type/{settingType}/toggle` | Toggle active. |
| `GET` | `/api/admin/rollover/rate` | Global rollover multiplier (default for bonuses without an explicit one). |
| `PUT` | `/api/admin/rollover/rate` | Update global rollover multiplier. Body: `{ "multiplier": "5" }`. |
| `POST` | `/api/admin/rollover/{accountId}/convert-if-complete` | Force-check: if the player's `rollover_completed >= 1`, immediately queue a conversion request. |

### 4.7 Check-in bonus admin ⭐ **ADMIN**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/checkin-bonus/active` | Current active check-in config. |
| `PATCH` | `/api/admin/checkin-bonus/{id}/active` | Toggle. |

### 4.8 Manual bonus wallet operations ⭐ **ADMIN**

For ops corrections — gift, claw back, wipe.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/bonus-wallet/{accountId}/grant?amount=&referenceId=&currency=AUD&description=&multiplier=` | Add to bonus pool. Pass `multiplier` to extend the rollover round. |
| `POST` | `/api/bonus-wallet/{accountId}/revoke?amount=&referenceId=&description=` | Subtract. |
| `POST` | `/api/bonus-wallet/{accountId}/clear?referenceId=&description=` | Zero out and unlock main wallet. |

> **Idempotency:** every grant/revoke/clear is keyed on `(account_id, reference_id, type)`. Calling twice with the same `referenceId` returns the original transaction without re-applying — safe to retry on timeouts.

---

## 5. Rollover details (Design-C)

### 5.1 Math

```
rollover_required   = 1.0           (constant)
rollover_completed  = (original_bonus_credited - balance) / rollover_denominator
```

where the denominator is `Σ (granted_amount × bonus.turnover_multiplier)` summed across every bonus credited in the current round.

### 5.2 Round lifecycle

| Event                                            | What happens to the 4 rollover columns                                                                                                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New player created                               | `original_bonus_credited=0`, `rollover_required=1.0`, `rollover_completed=0`, `rollover_denominator=0`.                                                                                                                              |
| Bonus credited (CREDIT_GRANT with multiplier)    | `original_bonus_credited += grantedAmount`; `rollover_denominator += grantedAmount × multiplier`. `rollover_completed` is recomputed (still 0 if no bet happened).                                                                    |
| Provider bet (DEBIT_PROVIDER_DEPOSIT)            | `balance -= bet`. `rollover_completed` recomputed against new balance.                                                                                                                                                                |
| Provider win (CREDIT_PROVIDER_WITHDRAW)          | `balance += win`. `rollover_completed` recomputed (decreases — wins lower the completion ratio because they replenish balance).                                                                                                       |
| Balance hits 0                                   | **Round resets**: all 4 columns return to defaults (1.0 for `rollover_required`, 0 for the others). Player can claim a fresh bonus.                                                                                                  |

### 5.3 What the frontend should render

- **Progress bar**: `rolloverCompleted × 100` as percent (cap at 100% visually even though server permits >1).
- **"Original bonus"**: `originalBonusCredited`.
- **"Balance"**: `balance` (in bonus pool).
- **"You need to lose / wager"**: complicated — see §5.4 caveat. Easiest UX is "Your bonus is X% complete" and a tooltip.

### 5.4 ⚠ Math caveat

With `multiplier > 1`, the maximum possible `rolloverCompleted` is `1 / multiplier` (reached when balance = 0). So `rolloverCompleted >= 1` is mathematically unreachable for any meaningful multiplier — **in practice the round always resets via the balance-hits-zero path**, not via the rollover-completed-reaches-1 path. This is the agreed Design-C behaviour (PR #2). If a future product change wants gross-turnover counting (where wins don't push progress back down), the formula needs to change to `cumulative_bets / rollover_denominator`.

---

## 6. End-to-end example

Player `ACC123` claims daily-free $5 bonus, plays, loses it.

1. `GET /api/bonuses/available` → returns DAILY_FREE_5 (bonusValue $5, turnoverMultiplier 20).
2. Frontend renders the card with the description T&C.
3. User taps **Claim** → `POST /api/bonuses/claim { accountId, bonusId: 44 }`.
4. `bonus_wallet` row updates atomically:
   - `balance: 0 → 5`
   - `original_bonus_credited: 0 → 5`
   - `rollover_denominator: 0 → 100`
   - `rollover_completed: 0 → 0`
5. Player opens MetaGaming, plays slot. After provider posts bet of $1 and no win:
   - `balance: 5 → 4`
   - `rollover_completed: 0 → 0.01`
6. Frontend polls `GET /api/bonus-wallet/{id}/rollover` and shows "1% complete".
7. Player keeps losing until `balance = 0`:
   - All 4 columns reset to defaults.
   - No conversion request is created (player has nothing to convert).
   - Player can claim a new bonus tomorrow (DAILY).

Player `ACC456` claims welcome 50% with $100 deposit, plays, wins, eventually clears.

1. `POST /api/deposits/initiate { accountId, amount: 100, bonusId: 1 }`.
2. Deposit submits; wallet-service credits `bonus_wallet` $50:
   - `balance: 0 → 50`, `original_bonus_credited: 50`, `denominator: 250` (50 × 5).
3. Player wagers, balance fluctuates. Player ends a session at $0 (lost everything): round resets, no conversion fired.
4. Alternative: player ends a session at exactly `balance == 0` via a final bet → same reset, no conversion.

Player `ACC789` (admin operation): admin force-converts.

1. Admin sees `ACC789` has `rolloverCompleted = 0.05` and `balance = 25` and decides to grant.
2. `POST /api/admin/rollover/ACC789/convert-if-complete` — server checks; under strict Design-C this returns 400 because `0.05 < 1.0`.
3. Admin uses `POST /api/bonus-wallet/ACC789/grant?...` to top up or `POST /api/bonus-wallet/ACC789/clear` to wipe and unlock without conversion.

---

## 7. Error handling

| HTTP | Common causes                                                                                          | Frontend treatment                                                  |
| ---- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 400  | Validation failure — claim duplicate, weekly-deposit gate, invalid promo code                          | Surface the server's `message` field verbatim — these are player-friendly. |
| 401  | Missing/expired JWT (admin endpoints)                                                                  | Bounce to login.                                                    |
| 403  | Role mismatch (e.g. STAFF trying to PUT rollover rate)                                                 | Hide the button instead.                                            |
| 404  | Account/bonus/conversion not found                                                                     | Show empty state, don't error.                                      |
| 409  | Idempotency replay raced — refresh data, the original op succeeded.                                    | Refetch, don't double-submit.                                       |
| 5xx  | Wallet-service or accounts-service down                                                                | Retry with backoff once, then surface a generic error.              |

Error body shape:

```json
{ "error": "BAD_REQUEST", "message": "You have already claimed this bonus today. Try again tomorrow." }
```

---

## 8. Common pitfalls

1. **Don't show "Turnover X needed" using `rolloverRequired` × `rolloverDenominator`.** `rolloverRequired` is always 1.0; the meaningful number is `rolloverDenominator` itself (the dollar amount of wagering target). Render `rolloverDenominator` as "Total wagering target" if you must show a number.
2. **Don't treat `bonus_wallet.balance` as withdrawable.** It's locked until a conversion request lands as `COMPLETED`. Use `GET /api/accounts/{id}/balance` for the "what can the player see as their balance" figure (composite, bonus-first).
3. **`requires_code: true` bonuses never appear in `/api/bonuses/available`.** Don't try to filter them in the frontend — they're already filtered server-side. To accept a code, hit `/api/bonuses/validate/{code}`.
4. **Idempotent retries are safe but ledger reads can lag.** After a grant, balance fields may take ~100ms to reflect in `GET .../balance` calls (R2DBC commit). Retry once after 200ms if you see the old value.
5. **`/api/checkin-bonus/claim` and the `bonuses` table rows `DAILY_CHECKIN_1..7` are not the same system.** Keep using the legacy `/api/checkin-bonus/*` endpoints for the existing streak feature. The 7 inactive rows in the `bonuses` table are for a planned migration.
6. **Direct credits currently land on the main wallet, not bonus_wallet.** Documented inconsistency; product fix is on the roadmap. Until then, "Direct credit" amounts don't appear in `bonus_wallet.transactions` — they appear in main wallet `transactions` with `type=BONUS`.

---

## 9. Quick reference — endpoint list

### Player (`https://accounts.team33.mx`)

- `GET /api/bonuses/available`
- `GET /api/bonuses/{bonusId}`
- `GET /api/bonuses/validate/{code}`
- `GET /api/bonuses/my-claims/{accountId}`
- `POST /api/bonuses/claim`
- `POST /api/checkin-bonus/claim`
- `GET /api/bonus-wallet/{accountId}/balance`
- `GET /api/bonus-wallet/{accountId}/rollover` ← **NEW (Design-C)**
- `GET /api/bonus-wallet/{accountId}/transactions`

### ⭐ Admin (`https://api.team33.mx`; ADMIN/STAFF role required)

- `GET /api/admin/bonuses` (+ `/{id}`, `/code/{code}`, `/filter`)
- `PUT /api/admin/bonuses/{bonusId}`
- `POST /api/admin/bonuses/{bonusId}/activate` | `/deactivate`
- `DELETE /api/admin/bonuses/{bonusId}`
- `GET /api/admin/bonuses/{bonusId}/claims`
- `GET /api/admin/bonuses/claims/account/{accountId}`
- `POST /api/admin/bonuses/credit-direct`
- `GET /api/admin/bonus-conversions/pending`
- `GET /api/admin/bonus-conversions/status/{status}`
- `GET /api/admin/bonus-conversions/account/{accountId}`
- `GET /api/admin/bonus-conversions/{requestId}`
- `GET /api/admin/bonus-conversions/stats`
- `POST /api/admin/bonus-conversions/{requestId}/approve`
- `POST /api/admin/bonus-conversions/{requestId}/reject`
- `GET /api/admin/bonus-ledger/{accountId}`
- `GET /api/admin/turnover-settings` (+ CRUD)
- `GET /api/admin/rollover/rate`
- `PUT /api/admin/rollover/rate`
- `POST /api/admin/rollover/{accountId}/convert-if-complete`
- `GET /api/admin/checkin-bonus/active`
- `PATCH /api/admin/checkin-bonus/{id}/active`
- `POST /api/bonus-wallet/{accountId}/grant` (admin-tier op)
- `POST /api/bonus-wallet/{accountId}/revoke`
- `POST /api/bonus-wallet/{accountId}/clear`

### Internal (don't call from frontend)

- `POST /api/internal/bonus-conversions` — wallet-service → accounts-service handshake when rollover completes
- `POST /api/wallets/{accountId}/rollover/credit-bonus` — accounts-service → wallet-service on bonus claim
- `POST /api/wallets/{accountId}/bonus/execute-conversion` — wallet-service self-call to perform the sweep
