# Credit-card bills

A recurring household bill links to its credit card by `credit_card_id`. Multiple cards from the same issuer remain separate. Linked bills appear in the Credit Cards category, with **View linked card** navigation. The card has **View household bill** navigation back to that bill.

Duplicate recurring obligations are prevented by `budget_one_recurring_bill_per_card`. One-time extra payments remain separate. The paycheck planner uses explicit card identities when deciding whether a planned bill already covers a card payment.

Original duplicate bill records are retained as JSON in `budget_card_bill_history`, scoped to the owning user and linked to the current card. They can be read under **Archived bill records** on the card. Archived rows are excluded from current budget totals. Canonical bill amounts, due dates, payment dates, and partial payments are preserved.

## Completed cleanup

The cleanup consolidates confirmed duplicate bill records while retaining the card accounts and canonical financial fields. Cards without an existing household bill remain separate; no amounts or due dates are invented for them.

Private recovery data is on the Ubuntu server at `/home/rich/site-backups/card-bill-links-20261101/`, including `source-before.tar.gz` and `records-before-1793558377841.json`. The record snapshot includes all pre-cleanup bills, card identities, reserve references, and the exact consolidation plan. Recovery should be reviewed against subsequent payments rather than blindly restoring old data.

The maintenance script defaults to a read-only preview: `node --experimental-strip-types scripts/reconcile-card-bills.cjs --user-id=1`. Applying requires `--apply`; any bill containing payment history or user details requires an explicit `--archive-history` id. `--mapping` supports confirmed bill-id to card-id replacements. Application archives original rows transactionally before consolidation, and redirects linked reserves to the retained bill.
