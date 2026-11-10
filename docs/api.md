# Chama API contract

Both backends (`backend-node` and `backend-laravel`) implement exactly this API, so the
frontend works with either one. Change `API_BASE` in `frontend/js/config.js` to switch.

- Base URL: `http://localhost:3000/api` (Node) or `http://localhost:8000/api` (Laravel)
- Send `Accept: application/json`, and `Content-Type: application/json` for request bodies
- After login, send `Authorization: Bearer <token>` on every request
- Dates are `YYYY-MM-DD`. Money is KES with two decimals
- Errors look like `{ "message": "...", "errors": { "field": ["..."] } }` (`errors` only on 422)

| Status | Meaning |
|---|---|
| 401 | Not logged in or token expired |
| 403 | Logged in, but your role is not allowed to do this |
| 404 | Record not found |
| 409 | Not allowed in the record's current state (e.g. approving a loan that is not pending) |
| 422 | Validation failed |

## Roles

`chairperson`, `treasurer` and `secretary` are **officials**. Everyone else is a `member`.
A member only ever sees their own contributions, loans, fines and statement: the backend
forces `member_id` to the logged-in member, whatever the request asks for.

## Endpoints and who may call them

| Method | Path | Allowed | Notes |
|---|---|---|---|
| POST | `/auth/login` | anyone | `{ phone, password }` → `{ token, user }` |
| POST | `/auth/register` | anyone | Sign up: `{ full_name, phone, password, email?, id_number? }` → `201 { token, user }`. Always creates an ordinary `member` |
| GET | `/auth/me` | logged in | Current member |
| POST | `/auth/logout` | logged in | |
| GET | `/members` | officials | |
| GET | `/members/{id}` | officials, or self | |
| POST | `/members` | chairperson, secretary | Only the chairperson may assign official roles |
| PUT | `/members/{id}` | chairperson, secretary | `password` is optional |
| DELETE | `/members/{id}` | chairperson | Deactivates (sets `status` = `inactive`). Never deletes |
| GET | `/contributions` | logged in | Filters: `member_id`, `from`, `to` |
| POST | `/contributions` | treasurer, chairperson | `{ member_id, amount, method, reference, contribution_date }` |
| PUT | `/contributions/{id}` | treasurer | |
| DELETE | `/contributions/{id}` | treasurer | |
| GET | `/loans` | logged in | Filters: `member_id`, `status`. Rows include `amount_paid`, `balance` |
| GET | `/loans/{id}` | officials, or owner | Includes `repayments` |
| POST | `/loans` | logged in | Apply: `{ principal, purpose, due_date }`. Officials may add `member_id`, `interest_rate` |
| PATCH | `/loans/{id}/approve` | chairperson | pending → active |
| PATCH | `/loans/{id}/reject` | chairperson | pending → rejected |
| POST | `/loans/{id}/repayments` | treasurer | `{ amount, method, reference, payment_date }`. Clears the loan when fully paid |
| GET | `/fines` | logged in | Filters: `member_id`, `status` |
| POST | `/fines` | treasurer, secretary | `{ member_id, reason, amount, fine_date }` |
| PATCH | `/fines/{id}/pay` | treasurer | unpaid → paid |
| PATCH | `/fines/{id}/waive` | chairperson | unpaid → waived |
| GET | `/expenses` | logged in | Visible to all members for transparency |
| POST | `/expenses` | treasurer | `{ category, description, amount, expense_date, receipt_ref }` |
| PUT | `/expenses/{id}` | treasurer | |
| DELETE | `/expenses/{id}` | treasurer | |
| GET | `/meetings` | logged in | Rows include `present_count` |
| GET | `/meetings/{id}` | logged in | Includes `attendance` |
| POST | `/meetings` | chairperson, secretary | `{ title, meeting_date, venue, agenda }` |
| PUT | `/meetings/{id}` | chairperson, secretary | Also used to save `minutes` |
| PUT | `/meetings/{id}/attendance` | secretary | `{ records: [{ member_id, status }] }`. status: present, absent, apology, late |
| GET | `/reports/summary` | officials | Group totals and cash at hand |
| GET | `/reports/statement/{memberId}` | officials, or self | Member statement |

## Report shapes

`GET /reports/summary`

```json
{
  "total_contributions": 0, "total_repayments": 0, "total_fines_paid": 0,
  "total_income": 0, "total_loans_issued": 0, "total_expenses": 0,
  "cash_at_hand": 0, "loans_outstanding": 0, "fines_unpaid": 0, "active_members": 0
}
```

`cash_at_hand = contributions + repayments + fines paid − loans issued − expenses`

`GET /reports/statement/{memberId}`

```json
{
  "member": { "...": "member fields" },
  "contributions": [], "loans": [], "fines": [],
  "attendance": { "total": 0, "present": 0 },
  "totals": { "contributions": 0, "loan_balance": 0, "fines_unpaid": 0 }
}
```
