# Customer Frontend Integration — Bonuses, Wallet & Rollover

_Audience: player web / mobile / desktop apps. Customer-facing surface only — admin / staff endpoints are not in this doc._
_Status: 2026-06-18, post deploy. Reflects live prod._

---

## 1. Hosts

**Use these two hosts. Never call `seamless.team33.mx` — that ALB is reserved for game-provider callbacks.**

| Family | Host | What lives here |
| --- | --- | --- |
| Bonuses + wallet | `https://accounts.team33.mx` | `/api/bonuses/**` (catalog, validate, claim, my-claims), `/api/bonus-wallet/**` (balance, rollover, transactions, clear), `/api/accounts/**`, `/api/deposits/**`, `/api/withdrawals/**` |
| Check-in streak | `https://api.team33.mx` | `/api/checkin-bonus/**` (the 7-day daily check-in product) |

**Auth.** No JWT required today. The `accountId` is on the path; calls succeed for any well-formed ID. Player Keycloak is on the roadmap and will land as a header-only change (no path change), so wire calls without auth headers but keep the option open.

**CORS** is fully open (`*`) on accounts-service for `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`, `PATCH`.

---

## 2. Conventions

| Concern | Convention |
| --- | --- |
| Money | Decimal strings up to 4 decimal places (e.g. `"5.0000"`, `"100.0000"`). **Never `parseFloat`** — use a decimal library (`big.js`, `decimal.js`, native `BigInt` × scale) for arithmetic. |
| Currency | Always `"AUD"`. The `currency` field on responses is present for forward-compat; ignore for now. |
| Timestamps | ISO-8601 local time, no timezone offset (e.g. `"2026-06-18T04:36:55.484342"`). Server is `Australia/Sydney`. Treat as Sydney-local. |
| IDs | `accountId` is a string (`"ACC296886160007892992"` shape). `bonusId` is a number. |
| Error body shape | `{ "error": "BAD_REQUEST", "message": "<human-readable>" }`. The `message` is player-friendly and safe to surface verbatim. |

---

## 3. Bonus catalog

### 3.1 List available bonuses

```
GET /api/bonuses/available
Host: accounts.team33.mx
```

Returns the active promotional bonuses to render as cards. **Code-required bonuses are excluded** — they only return via `/validate/{code}`.

Per-card semantics:

| Field | Meaning |
| --- | --- |
| `bonusType` | `"PERCENTAGE"` → bonus = `min(deposit × bonusValue%, maxBonusAmount)`. `"FIXED"` → bonus = `bonusValue`. |
| `minDeposit` | `0` for free bonuses, > 0 for deposit-tied. Use this to route the user to the right CTA: `0` → "Claim Now", > 0 → "Deposit to Claim". |
| `claimPeriod` | `"NONE"` (lifetime, one-time), `"DAILY"` (resets at 00:00 local), `"WEEKLY"` (resets at ISO-week Monday 00:00). Render a small "Daily" / "Weekly" / "One-time" pill on the card. |
| `weeklyDepositRequired` | If set, player must have deposited at least this amount in the current ISO-week before claim succeeds. Show as a precondition on the card. |
| `streakDay`, `streakGroup` | Tag for the 7-day check-in series. **If non-null, don't render this as a standalone card — it's part of the check-in product** (§7). |
| `description` | Full T&C text **ready to display**, including unicode arrows (`➤ ⚠ ✓ ✘`) and newlines. Render in a monospace block or with `white-space: pre-wrap`. |

### 3.2 Get a single bonus by ID

```
GET /api/bonuses/{bonusId}
Host: accounts.team33.mx
```

### 3.3 Validate a promo code

```
GET /api/bonuses/validate/{code}
Host: accounts.team33.mx
```

`200` → bonus row; `400` → `{"error":"BAD_REQUEST","message":"Invalid or expired promo code"}`.

---

## 4. Claiming a bonus

### 4.1 Free claim (`minDeposit == 0`)

```
POST /api/bonuses/claim
Host: accounts.team33.mx
Content-Type: application/json

{ "accountId": "ACC…", "bonusId": 44, "ipAddress": "203.0.113.42" }
```

`accountId` + `ipAddress` are mandatory. Identify the bonus by **either** `bonusId` **or** `bonusCode`. The `ipAddress` is the player's egress IP.

### 4.2 Deposit-tied claim

```
POST /api/deposits/initiate
{ "accountId": "ACC…", "amount": "100.00", "bonusId": 1 }
```

### 4.3 My claims (history)

```
GET /api/bonuses/my-claims/{accountId}
```

Newest-first. `status`: `PENDING` → `CREDITED` | `CANCELLED` | `EXPIRED`.

---

## 5. Bonus wallet — reads

### 5.1 Balance

```
GET /api/bonus-wallet/{accountId}/balance
```

```json
{ "accountId": "ACC…", "balance": "5.0000" }
```

### 5.2 Rollover state (full)

```
GET /api/bonus-wallet/{accountId}/rollover
```

```json
{
  "accountId": "ACC…",
  "balance": "5.0000",
  "originalBonusCredited": "5.0000",
  "rolloverRequired": "1.0000",
  "rolloverCompleted": "0.0000",
  "rolloverDenominator": "100.0000"
}
```

- `rolloverRequired` is always `1.0` — a normalisation ceiling, not a dollar target.
- `rolloverCompleted = (originalBonusCredited − balance) / rolloverDenominator`. Render as `× 100`% progress.
- Empty round → all monetary fields `"0.0000"`. Show "No active bonus."
- When `balance` hits 0, the round resets; all 4 columns return to defaults.

### 5.3 Rollover completed (slim — for progress bars)

```
GET /api/bonus-wallet/{accountId}/rollover-completed
```

```json
{
  "accountId": "ACC…",
  "rolloverCompleted": "0.0000",
  "rolloverRequired": "1.0000",
  "percentComplete": "0.00",
  "complete": false
}
```

### 5.4 Transaction history

```
GET /api/bonus-wallet/{accountId}/transactions
```

Type codes: `CREDIT_GRANT` (+), `DEBIT_PROVIDER_DEPOSIT` (−), `CREDIT_PROVIDER_WITHDRAW` (+), `DEBIT_CLEAR_BALANCE` (−), `DEBIT_REVOKE` (−), `DEBIT_CONVERT_TO_CASH` (−).

---

## 6. Player forfeit — clear the bonus wallet

```
POST /api/bonus-wallet/{accountId}/clear?referenceId=<unique>&description=<optional>
```

Idempotent on `referenceId` (UUID per user action). Wipes `bonus_wallet.balance` to 0, resets the round, unlocks the main wallet for withdrawal.

---

## 7. Check-in bonus (7-day streak)

**Different host** — `api.team33.mx`.

```
GET  /api/checkin-bonus?accountId={accountId}
POST /api/checkin-bonus/claim   body: { "accountId": "ACC…" }
```

Don't call `GET` without `accountId` — server returns 404. The amount credits the **main wallet** directly (this product does not route through `bonus_wallet`).

---

## 8. Error handling — one shape

```json
{ "error": "BAD_REQUEST", "message": "<player-friendly text>" }
```

| HTTP | When | FE behavior |
| --- | --- | --- |
| `200` | Success | — |
| `400` | Validation, dup claim, weekly-deposit gate, invalid code, IP-binding | Surface `message` verbatim |
| `404` | Account / bonus / claim not found | Empty state, don't show error |
| `409` | Idempotency race | Refetch — your write already won |
| `5xx` | Service-side issue | One backoff retry, then a generic message |

---

## 9. Common pitfalls

1. **Never call `seamless.team33.mx`** — that's the game-provider seamless callback host. All bonus-wallet endpoints you need are proxied to `accounts.team33.mx`.
2. **Don't render `rolloverRequired`** — always 1.0; it's a scale, not a target. Use `rolloverCompleted × 100` as percent, or `/rollover-completed` and read `percentComplete`.
3. **`bonus_wallet.balance` is not withdrawable** — locked until rollover completes or `/clear` runs. For the header "what can I see as my balance" use `/api/accounts/{id}/balance` (composite, bonus-first).
4. **Don't pre-filter `requiresCode: true` cards** — server already excludes them.
5. **Money fields are decimal strings** — never `parseFloat` for arithmetic.
6. **Idempotency on `/clear`** — unique `referenceId` per user action.
7. **DAILY/WEEKLY periods are server-local** (`Australia/Sydney`).
8. **R2DBC ~100ms lag** after a grant — retry once after 200ms if you see the old value.
9. **`/api/checkin-bonus/**` is on `api.team33.mx`**, not the accounts host.
10. **`description` is markdown-ish plain text with unicode** — render with `white-space: pre-wrap`.

---

## 11. Quick reference

### Bonuses (`https://accounts.team33.mx`)

- `GET  /api/bonuses/available`
- `GET  /api/bonuses/{bonusId}`
- `GET  /api/bonuses/validate/{code}`
- `GET  /api/bonuses/my-claims/{accountId}`
- `POST /api/bonuses/claim`

### Bonus wallet (`https://accounts.team33.mx`)

- `GET  /api/bonus-wallet/{accountId}/balance`
- `GET  /api/bonus-wallet/{accountId}/rollover`
- `GET  /api/bonus-wallet/{accountId}/rollover-completed`
- `GET  /api/bonus-wallet/{accountId}/transactions`
- `POST /api/bonus-wallet/{accountId}/clear`

### Check-in (`https://api.team33.mx`)

- `GET  /api/checkin-bonus?accountId={id}`
- `POST /api/checkin-bonus/claim`
