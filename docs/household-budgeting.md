# Household pay-period budgeting

- Open **Budget Dashboard → Pay-Period Plan** to see a 14-day window, known bills, estimated bills, reserves, and cash projections.
- Choose **Spending vs Plan** for recorded purchases by category, account, and spouse. Choose the current or another pay period on the horizontal timeline.
- The budget owner can assign bank and card accounts to **Mine**, **Spouse’s**, or **Shared** on that screen. Shared remains a separate spending total.
- Card purchases count as spending once. Bank card payments, account transfers, and card credits are displayed separately. Card credits may include refunds; the spending total is gross of these credits.
- Bank inflows are recorded non-transfer deposits and can include money other than paychecks. Refresh reads saved transactions; use the existing bank/card **Sync Transactions** action to fetch new records.
- Legacy transactions whose bank/card identity cannot be determined are flagged and excluded. Re-sync linked records to populate account identity. Do not interpret partial totals as complete spending.
- Planned allocations include reserves and debt payments; recorded spending follows purchase dates. Their difference is not spendable cash. Use the pay-period dashboard's cash calculation for that.
- Missing bill amounts and due dates remain explicitly unresolved. Review the unconfirmed-expense reserve instead of treating missing details as zero.
- To link a spouse login, the household owner generates a one-time invitation under **Shared Household**. The code expires in 24 hours and is consumed when used. A new code replaces the old one. Joining grants access to the owner's shared plan; personal account connections are not automatically imported into that plan.

## Backup and recovery

Pre-change source and a consistent production PostgreSQL data/schema-metadata snapshot are stored privately on the Ubuntu server under `/home/rich/site-backups/retteewealth-finish-20261031T181530Z/`. `SHA256SUMS` verifies these files. This data snapshot is not a `pg_dump` archive; restoring it requires the backed-up application schema and a deliberate data restore.

UI preparation is preserved in commit `0487bea`; the UI applied to main is `6d96bec`. The last published main commit before this work was `7392cda`. Reverting the deployment should retain the additive database columns; do not drop them or overwrite production data as part of a code rollback.
