<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Credit Dashboard — Summary of Changes

### Goal
Maintain credit-dashboard Next.js app with accurate report parsing, multi-bureau support, dispute letters, admin tools, and stable Vercel deployment.

### Constraints & Preferences
- Next.js 16 at `/home/rich/credit-dashboard/` with SQLite at `data/credit-dashboard.db`.
- Deployed to `retteewealth.me` via Vercel (`richmediarts-projects/credit-dashboard`).
- DB auto-seeds from `seed/seed.json` on every Vercel cold start.
- Admin user: `richljohnson50@gmail.com` / password `ella`.
- Local dev server on `http://10.0.0.94:3000`; HMR requires `allowedDevOrigins` in `next.config.ts`.
- **Backup policy**: Before every code change, run `node scripts/backup-db.cjs` to snapshot the local SQLite DB to `data/backups/` (keeps last 30). Then commit changes. Backups live in gitignored `data/`, never committed.

### Done
- Created `scripts/backup-db.cjs` — snapshots SQLite DB to `data/backups/` (keeps last 30); run before every change.
- Increased base font size to 18px and body font-weight to 500 for visibility.
- Created `scripts/seed-real-data.cjs` — authoritative BureauReport JSON for all three bureaus.
- Ran seed — DB has correct data for user_id=1 across `reports` and `fico_scores` tables.
- Fixed TransUnion TXT parser: rewrote `extractInquiries` to find exactly 10 hard inquiries from "Regular Inquiries" section.
- Added OCR support via `tesseract.js` — pdfjs-extract falls back to OCR when native text is garbled.
- Added `.docx` export via `docx` npm package — `letterTextToDocx()` in `disputeLetters.ts`, download button on dispute-letters page.
- Added `PATCH /api/users/[id]` for admin password/name/role updates, and inline "Change Password" UI on `/admin/users`.
- Created `/help` page explaining every sidebar section with descriptions and usage.
- Added "Help Guide" link to sidebar nav.
- Fixed dark/light toggle visibility on login page — now a white pill with border, shadow, and "Dark Mode"/"Light Mode" label.
- Fixed `/login` page (logout redirect target) — was missing dark mode toggle and theming; now matches root page's login form.
- Changed logout redirect from `/login` to `/`.
- Added "Where to Send Letters" card to dispute-letters page with mailing addresses for Experian, Equifax, and TransUnion.
- Removed `/api/reports/enrich` call from upload flow — uploaded reports no longer overwritten by seed data.
- Updated `seed.json` hashes to match local DB passwords (admin password: `ella`).
- Added `showSaveFilePicker` (File System Access API) to both `.txt` and `.docx` download buttons — opens native "Save As" dialog with suggested filename.
- Removed `fileData` stripping from `saveReportToServer` — uploaded PDF data now persists to server so Original Document Viewer shows the user's actual report, not the static fallback.
- Comparison and dispute letters pages now use `useAuth().user.name` instead of hardcoded "Richard Johnson".
- Redesigned AI analysis page with WalletHub-style FICO score cards, letter grades (A-F) for credit factors, and improvement recommendations.
- Fixed unreadable text colors in Cross-Bureau Summary table (added `dark:` variants, replaced hardcoded `#d93025`/`#fef7e0`/`#b06000` with proper Tailwind classes).
- Rewrote score simulator to fetch real FICO scores from `/api/fico-scores`, with interactive action selection buttons (Pay Down Cards, Remove Late Payments, etc.) showing per-bureau projected score changes.
- Fixed stale closure bug in upload merge — now uses parsed `data.fileData` directly instead of stale `state.reports` from the callback closure.
- Added regex-based fallback parsers (`extractAccountsRegex`) for TransUnion and Equifax — activates when primary layout-based parser returns 0 accounts.
- Bureau titles on Summary page are now clickable links to `/report-viewer?bureau=X`; Report Viewer reads `?bureau=` param and pre-selects that bureau filter.
- Added `Suspense` boundary to Report Viewer page for `useSearchParams` compatibility.
- Added fully generic fallback parser (`src/lib/parsers/genericParser.ts`) — uses heuristic creditor name detection, flexible regex patterns (tolerant of missing whitespace and `:`/`=` delimiters), and dollar-amount-based chunking when no creditor names are found.
- PDF extractor returns TWO text versions: `positionGrouped` (layout-based) and `rawConcat` (document order). Parser tries positionGrouped → rawConcat → OCR.
- Added `hasCreditReportContent()` quality check — inspects for dollar amounts, dates, credit terms, and recognizable word ratio. Falls through to OCR when native text is garbled.
- Added `extractTextFromPDFWithOCR()` — standalone OCR-only extraction, called as last resort from `parseFile` when both native text versions yield 0 accounts.
- Rewrote `pdfExtractor.ts`: now renders PDF pages at 3x to canvas and uses OCR when native text quality check fails (word ratio < 0.5). Native text extraction is a fast-path only for clean PDFs.
- Added "Important Note" card on Upload page with instructions for pulling reports from AnnualCreditReport.com and why it works best with retteewealth.me.
- Added Budget app integration (rewrite of Flask `budget_app`, not iframe): new `budget_*` tables in SQLite, migration script, API routes, and 3 pages.
- Created `scripts/migrate-budget.cjs` — copied paychecks/bank accounts/credit cards/payees/bills/categories from `/home/rich/DATA/budget_app/budget.db` into `data/credit-dashboard.db` (assigned to user_id=1 Admin).
- Created `src/lib/budget-db.ts` — schema + queries (`getPaychecks`, `getPaycheck`, `addPaycheck`, `updatePaycheck`, `deletePaycheck`, `getNextPaycheckDate`, `getBudgetStats`) with typed casts (no `any`).
- Created API routes: `/api/budget/stats`, `/api/budget/paychecks` (GET/POST), `/api/budget/paychecks/[id]` (GET/PUT/DELETE).
- Created pages `/budget` (dashboard), `/budget/paychecks` (list + add/edit form), `/budget/paychecks/[id]` (paystub view).
- Added sidebar links (Wallet/Banknote icons) and Budget help sections.
- Fixed budget lint errors: `fetchStats`/`fetchPaycheck` moved to `useCallback` (declared before `useEffect`); removed unused `loading` in paychecks page; fixed `Stats` interface missing `last_paycheck_date`/`total_income`/`total_expenses`.
- Verified `npm run build` passes and all budget endpoints work (stats, list, detail, create, delete) with Admin login.
- Full data sync from Flask (584 transactions, 9 plaid items, 30 bank accounts, 24 credit cards, 4 paychecks with YTD fields).
- Seed.json updated with all budget tables (787 rows) for Vercel cold start persistence.
- Credit Cards page: Available Credit card, Plaid Link, Sync Balances, per-card Available column, duplicate cleanup (15 remain).
- Interactive Budget complete rewrite matching Flask: periods, income/expense tables, bills dropdown, localStorage persistence.
- Mobile responsive fixes: Categories edit/delete always visible, action row wrapping on all budget pages, header wrapping on mobile.
- Paycheck parser refinement: 401(k) label matching, separate-line format, tax exclusion checks, holiday pay exclusion.
- Plaid API: create-link-token, exchange-public-token, sync-balances, sync-transactions, settings GET/POST.
- Plaid config NOT seeded — user configures via settings page; `getPlaidConfig()` creates settings table if missing.
- Experian URL fixed on FICO scores page to `https://usa.experian.com/login/index`.
- DB backup script (`scripts/backup-db.cjs`): WAL-safe, keeps last 30.
- Goals page rewritten to match Flask: 6-Month Projection, Debt Breakdown, Savings Goals, Credit Utilization Simulator with per-card allocation table and slider.

### In Progress
- (none)

### Blocked
- Equifax and TransUnion PDF reports may still fail to import if PDF text extraction produces fundamentally garbled output (e.g., custom fonts, positional encoding). Raw text is visible in Report Viewer's Original Document section for debugging.

### Key Decisions
- Generic parser uses two-pass approach: (1) insert spaces before known field labels when concatenated, (2) scan for creditor-name-like lines and extract fields within each account block.
- PDF extractor now preserves relative spacing between text items (multiple spaces for larger gaps) rather than binary small/large gap.

### Next Steps
1. Debug PDF text extraction output — add raw text display on Report Viewer or upload page so user can see what the parsers actually receive.
2. Fix Experian parser — identify why uploaded Experian PDF parses to incorrect data.

### Critical Context
- **Admin login**: `richljohnson50@gmail.com` / `ella`.
- **DB users**: id=1 (admin), id=2 (member Richard), id=3 (member Ella).
- Budget data lives in `budget_*` tables, all assigned to user_id=1 (Admin). Source: `/home/rich/DATA/budget_app/budget.db` (Flask app at `10.0.0.94:8080`).
- **Vercel caveat**: DB lives in `/tmp` on Vercel and re-seeds from `seed/seed.json` on cold start — budget tables are NOT in the seed, so budget data will not persist on production Vercel, only on local dev (`data/credit-dashboard.db`).
- `saveReportToServer()` now includes `fileData`; server stores and returns it.
- Vercel cold starts auto-seed from `seed/seed.json` — hashes updated to match `ella` for admin.
- `/api/reports/enrich` route still exists but is no longer called from the upload flow.
- Stale closure in upload merge fixed: merge now uses parsed `data.fileData` directly, not `state.reports` from the useCallback closure.
- PDF text extraction via `pdfjs-dist` uses position-based grouping with `LINE_THRESHOLD=8`; generic parser should handle most text formats.

### Relevant Files
- `/home/rich/credit-dashboard/src/lib/parsers/genericParser.ts`: NEW — fully generic fallback parser with heuristic creditor detection, tolerant regex patterns
- `/home/rich/credit-dashboard/src/lib/parsers/index.ts`: generic fallback integrated via `tryParsers` cascade
- `/home/rich/credit-dashboard/src/lib/pdfExtractor.ts`: increased LINE_THRESHOLD to 8, improved spacing logic
- `/home/rich/credit-dashboard/src/lib/store/creditStore.tsx`: updated "0 accounts" error message with raw text hint
- `/home/rich/credit-dashboard/src/lib/parsers/experianParser.ts`: regex-based accounts extraction (works for TXT, data incorrect for PDF uploads)
- `/home/rich/credit-dashboard/src/lib/parsers/equifaxParser.ts`: added `extractAccountsRegex` regex fallback for PDF text
- `/home/rich/credit-dashboard/src/lib/parsers/transunionParser.ts`: added `extractAccountsRegex` regex fallback for PDF text
- `/home/rich/credit-dashboard/src/app/ai-analysis/page.tsx`: redesigned with WalletHub-style factor grades and score cards
- `/home/rich/credit-dashboard/src/app/score-simulator/page.tsx`: rewritten with interactive action selection and real FICO scores
- `/home/rich/credit-dashboard/src/app/comparison/page.tsx`: fixed dark mode text colors; user name from `useAuth()`
- `/home/rich/credit-dashboard/src/app/summary/page.tsx`: bureau titles link to `/report-viewer?bureau=X`
- `/home/rich/credit-dashboard/src/app/report-viewer/page.tsx`: reads `?bureau=` param; Suspense for `useSearchParams`
- `/home/rich/credit-dashboard/src/app/dispute-letters/page.tsx`: user name from `useAuth()`; "Where to Send Letters"; `.docx` Save As
- `/home/rich/credit-dashboard/seed/seed.json`: password hashes updated to match local DB (admin: `ella`)
- `/home/rich/credit-dashboard/src/app/api/reports/enrich/route.ts`: standalone seed endpoint (no longer called automatically)
- `/home/rich/credit-dashboard/src/lib/budget-db.ts`: NEW — budget schema + queries (`getPaychecks`, `getPaycheck`, `addPaycheck`, `updatePaycheck`, `deletePaycheck`, `getNextPaycheckDate`, `getBudgetStats`)
- `/home/rich/credit-dashboard/scripts/migrate-budget.cjs`: migration from Flask `budget.db` → credit-dashboard (already run)
- `/home/rich/credit-dashboard/src/app/api/budget/stats/route.ts`: stats endpoint
- `/home/rich/credit-dashboard/src/app/api/budget/paychecks/route.ts`: list/create paychecks
- `/home/rich/credit-dashboard/src/app/api/budget/paychecks/[id]/route.ts`: get/update/delete paycheck
- `/home/rich/credit-dashboard/src/app/budget/page.tsx`: budget dashboard (Stats interface at top must match `getBudgetStats` return)
- `/home/rich/credit-dashboard/src/app/budget/paychecks/page.tsx`: paychecks list + add/edit form
- `/home/rich/credit-dashboard/src/app/budget/paychecks/[id]/page.tsx`: paystub view
- `/home/rich/credit-dashboard/src/components/layout/Sidebar.tsx`: budget links (Wallet/Banknote icons)
- `/home/rich/credit-dashboard/src/app/help/page.tsx`: Budget section added
- `/home/rich/credit-dashboard/src/app/api/users/[id]/route.ts`: PATCH handler for admin user updates
