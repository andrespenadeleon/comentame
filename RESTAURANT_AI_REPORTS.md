# Restaurant reports with GPT-6 Luna

## Setup
1. Apply `supabase/migrations/202611270001_restaurant_ai_reports.sql` after the existing November 23 question analytics migrations.
2. Add `OPENAI_API_KEY` to `.env.local` and Vercel server environment variables. Do not prefix it with `NEXT_PUBLIC_` or commit a real key. Restart local development after adding it; deploy after configuring Vercel.
3. The model is explicitly `gpt-6-luna`, through the direct OpenAI Responses API using AI SDK. No AI Gateway account is involved.

## Behavior
The existing admin-only AI button opens a saved report with a month-to-date range in America/Monterrey. Custom ranges support up to 366 inclusive dates, no future end dates. Reports retain selected version/employee/rating filters; their dates are independent of dashboard period. Expand/reduce changes the existing dialog's size without remounting or regenerating it. Restaurant access has not been broadened.

SQL prepares a full fixed snapshot: submitted response counts, average ratings, immediately previous equal-duration comparison, daily totals, per-question option counts and text answers, employees, contacts count, measured visit cohorts, voluntary Google clicks. Google clicks never prove reviews. Multiple-choice totals count each selected option once per response. Personal name/contact questions are excluded from model input; aggregate contacts count remains. Employee names become numbered placeholders for model input. Common email/phone patterns are redacted from comments; free text may still contain personal information. `store:false` requests no Responses application-state storage; it is not a claim of zero provider retention. Use applicable OpenAI data controls.

Charts are rendered by the app from SQL data. The model returns validated structured interpretations; citations must reference known input questions/comments. Recommendations remain interpretations, not guaranteed outcomes. Report quotations are private authenticated admin content.

Completed reports and snapshots are saved. Loading/reopening is free of AI calls. Updates reuse prior narrative as context but recalculate against the full current snapshot, avoiding stale accumulated totals. No new submitted responses means no new run. New visit-only activity does not currently trigger regeneration. Reports are keyed by restaurant, exact dates, version, employee and rating; a new day creates a new month-to-date scope.

## Quota and operational behavior
Two successful/pending reports per restaurant per Monday-based Monterrey week, shared across admins and filters and including legacy saved mock analyses. A transaction-scoped restaurant lock prevents racing reservations; only one pending report per restaurant. Request UUIDs bind user and scope. Completion is idempotent. Old mock generation is disabled by migration, while historical results remain in the database. Failed generation releases application quota, but provider processing may still be billed. Pending reservations expire after 10 minutes. Provider request: low reasoning, 6,500 maximum billed output tokens, no automatic retries, 110-second timeout. API route max duration: 180 seconds (hosting plan must support it).

No paid inference was run during implementation. Reading results remains possible without an API key. At most 5,000 submitted responses and a 1.2 MB snapshot are accepted. Provider input has a separate 300,000-character limit. Oversized input is rejected with a smaller-range prompt, never silently sampled. Hierarchical analysis for large datasets is future work. Input/output usage and an estimated cost at Nov 27, 2026 standard rates are saved; invoices are authoritative. No global spending cap is implemented; configure an OpenAI project budget/alerts and retain the restaurant quota.

## Manual verification
After setup, confirm admin-only access, month defaults and custom dates, saved reload, no-new-response behavior, two-run limits across filters/admins, failed call recovery, repeated request IDs, expanding during generation and after completion, keyboard and mobile layouts, matching chart/SQL totals, and evidence links. Do not use guest text as executable instructions. No automated checks or paid smoke generations were performed under the user's standing instruction.

## Admin monitoring
Apply the follow-up `202611270002_ai_observability.sql` migration to enable lifecycle logging. New paid generations require the initial audit record to persist. Use **Actividad IA** for the exact safe error category, stage, operation UUID, provider request IDs, usage and quota events. See `AI_OBSERVABILITY.md`.


## Publication, prompts and PDF (2026-11-27)
Apply `202611270003_report_publication_and_prompts.sql` AFTER 001 and 002. This adds immutable editable prompt revisions, private admin reports, visibility flags, and revocable 256-bit public links. The monitor RPC now accepts `p_request` to scope activity by report ID.

All existing and new portal-admin runs are excluded from restaurant quotas. They still incur provider cost and remain fully logged. Admins may regenerate even without new responses. Restaurant report access stays hidden and server-restricted: `visible_to_restaurant` is preparatory metadata; `restaurant_ui_enabled` remains false. Public sharing is independent of this flag.

The latest survey version is selected by default, with version and date controls in the report panel. The current month is the default period. Reports use GPT-6 Luna with medium reasoning, 10,000 output tokens and a 140-second provider timeout. All text responses in the bounded period snapshot are analyzed; if input exceeds the existing cap, choose a shorter period rather than silently dropping responses.

Actividad IA → Configuración del prompt shows the complete composed system prompt, editable operational instructions and revision history. Saving affects only future runs. Every report captures its exact template and revision; technical guardrails and structured evidence constraints remain fixed.

Report actions support PDF download, a future restaurant-visibility flag, public URL copying and revocation. Revoking invalidates the old URL permanently. Public payloads are stored separately, omit source UUIDs, guest names/contact, prompts, costs and admin diagnostics, and retain employee names. Known guest identities and contact patterns are removed from narrative and text samples. Shared pages require no login and discourage indexing. PDFs use the same sanitized report and include every question, plus up to three recent text samples per question. They do not include individual-response lists or admin-only limitations.

Manual review points: generate against the selected version/range; verify prompt revision in activity; confirm admin quota exclusion and private default; toggle future visibility without exposing restaurant UI; copy/open/revoke a link in an anonymous browser; download both PDF routes; check all questions appear in PDF and only two initially on screen. No paid AI call or executable checks were run for this update.


## Executive prompt V2
`202611270004_executive_report_prompt.sql` upgrades only the shipped default template after migration 003. A customized active template is preserved; administrators can paste the new default into the prompt editor if they want to adopt it. Previous reports and template revisions are unchanged.

The model still uses strict structured output and bounded current-snapshot references. The supplied executive framework is mapped to existing fields: conclusion and change/maintain/monitor in `summary`; evidence strength, finding type and operational impact in `observation`; action priority and justification in `reason`. No response-schema or report-layout changes are required. Technical guardrails remain fixed; editable instructions are stored separately but composed into one system message. GPT-6 Luna remains selected.


## Executive report UI V2
Reports now default to Resumen ejecutivo, with a branded white header, an AI-provided takeaway, parsed change/maintain/monitor priorities, up to three findings and three expandable actions. Análisis detallado presents all findings/actions, themes, existing daily/rating charts, question results, employee metrics, and observed previous-period aggregates. These tabs are presentation modes of one saved report; switching never generates AI output.

Existing narrative fields are adapted without changing the generation schema or prompt. Structured labels inside `summary` and `observation` are recognized; older unstructured text remains readable, with explicit missing-category fallbacks. No old reports or issue logs are deleted or archived because they remain compatible. Evidence actions only use response IDs present in the current report's text-response snapshot. Public documents continue to exclude private evidence navigation and admin diagnostics.

All configuration/export/access actions sit in a single toolbar. Restaurant logos are loaded through the existing `restaurants.logo_path` field and public logo bucket. Existing report output and snapshots are not rewritten. A copied/refreshed public link captures the current logo path; previously shared payloads without branding retain initials until the link is copied again. PDF uses the same summary/field adapters, includes all questions, and converts supported uploaded logos to PNG via Sharp for WebP compatibility. Logo fetches are restricted to the own storage bucket, bounded in size and duration; failures use initials.

Missing first-class schema fields: executive priorities, evidence strength, finding type/impact, action priority, and historical signal categories. These currently exist only when explicitly provided in narrative text. A future optional-field schema revision could model them directly; the UI does not manufacture them. Historical comparisons show existing SQL aggregates only, not inferred implementation outcomes or new/recurring signal classifications.
