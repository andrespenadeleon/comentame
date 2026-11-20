# Submitted responses by question

Click a participation bar on the owner or admin dashboard to open the existing animated response drawer. It shows submitted surveys only, with an actual nonempty answer to that exact field and published version; no partial values are collected. Fixed rating/name/contact fields and custom text/single/multiple questions are supported. Original answer values, guest name, date/time (Monterrey) and employee name are displayed.

The drawer uses local URL history (question/questionPage), a scoped in-memory cache, and first-page intent prefetch on hover/focus. It opens immediately with an inline placeholder when data is not ready, without reloading the dashboard. Results are paginated by 20, ordered by submission date and ID. Filters follow the existing version, restaurant, employee, rating and rolling period (7/30/90/all) rules. Counts can differ from the participation bars because those include unfinished attempts and ignore rating filters.

Apply `supabase/migrations/202611200001_question_responses.sql` before using the new endpoint. The GET route validates inputs and a confirmed authenticated session; SQL verifies owner/admin access to the exact restaurant/version and validates the field against the original questions. Responses are constrained to that version/restaurant and filtered before counting/pagination. Route responses are private/no-store. No direct table permissions are expanded.

Source/diff review only. No tests, builds, typecheck, database execution or browser QA run per the user's standing instruction. No commit/push/deploy performed.


## Answer summaries

Apply 202611200002_question_answer_summaries.sql after the initial question-responses migration. It retains the same authorization, field validation, filters, answer eligibility and pagination, while adding metadata from the original survey version and option totals across the full filtered result. Fixed stars and scale questions return all five counts; yes/no returns both original options even when their totals are zero. These charts never infer totals from one result page. Other types have no distribution. Name-field responses display the customer's name only once. Rating and scale entries show numeric score plus five filled/unfilled stars; text/options remain their original values. No tests/builds or database execution performed.
Legacy single-choice versions with exact options 1–5, or Sí/No (also Si/No and Yes/No), are recognized for summary presentation without modifying their original survey definition or answers.


## Score layout and admin AI mock

Main star rating omits the visual /5 denominator; all scale denominators stay inline with their score. Both keep the accessible score-out-of-five label. Custom open-text questions expose an admin-only Analizar respuestas con IA button when params.portal is server-supplied as 1. Owner pages explicitly clear that parameter. This is a client-only mock, prominently labeled Demo and Datos ficticios before and after activation. It shows example summary, findings and next actions without reading, aggregating or transmitting response text, without AI services, keys, additional queries or schema changes. It states that a future integration would use all matching submitted answers, not just the current page. Fixed guest-name/contact fields do not receive the action.


## Persisted mock analysis and weekly allowance

Apply 202611200003_persist_question_insights.sql after the question-response migrations. Mock generation remains portal-admin-only; restaurant users cannot read or generate results. New tables have RLS and no direct access for anon/authenticated; RPCs and the route independently check portal admin. Saved analyses are scoped by restaurant, published version, question, period, employee and rating. Reading an existing result does not generate anything or consume quota.

Successful generations count toward a restaurant-wide allowance of two per local Monday–Sunday week (America/Monterrey), across all questions, filters and admins. A per-restaurant transaction advisory lock serializes generation and quota validation; failed transactions consume nothing. Request UUIDs make retries idempotent. No new matching answers means no generation and no charge, even when the weekly allowance is exhausted. Limits are never enforced only in the UI.

Each analysis stores the prior result reference and the set of included response IDs. The next run prepares prior mock output plus eligible new submitted text answers (never just the current page and never partial survey values). The mock does not perform semantic analysis or send any data to an AI provider; its saved summary/insights/actions remain prominently labeled fictitious. Raw text is read for generation context inside the transaction but not duplicated into the saved output. Existing source IDs are carried forward; newly eligible IDs are deduplicated against them. Thus older backfilled answers are not skipped by a timestamp-only watermark. A saved incremental result may reference earlier snapshots that have since rolled out of the current rolling period; generation timestamps and snapshot counts remain historical rather than a claim to be a fresh re-analysis of the entire moving window.

GET loads saved result, new-answer count and quota. POST explicitly creates or updates, with a bounded JSON body and private/no-store responses. New generation output is saved atomically alongside source IDs; the prior history is retained. UI reloads the saved analysis automatically and displays used/remaining allowance, reset time and newly included counts. No real AI credentials, email or WhatsApp integration introduced. No migrations applied or automated checks executed from this session.

Final source review: the state RPC takes a fresh timestamp/snapshot after the per-restaurant generation lock. Quota week, input cutoff and generation timestamp share that snapshot, so concurrent requests and a weekly rollover cannot use a stale pre-lock generation timestamp. Read requests have a bounded timeout. This review did not execute the migration or automated checks.


## Survey-wide analysis (supersedes per-question UI)

The persisted mock analysis now lives in the main Participación por pregunta card, directly under its version selector, and in the complete view. It is no longer shown inside an individual question drawer. Portal admin only, as previously agreed. It includes every submitted survey in the selected restaurant/version/period/employee/rating scope, across all questions, independent of the four-bar preview or answer-list pagination.

Apply 202611200004_survey_wide_insights.sql after the previous insight migration. The existing tables and quota ledger are reused with field_key=* for whole-survey snapshots. Previous per-question reports remain stored and their usage still counts toward the same two-run restaurant/week allowance; they are not silently relabeled or merged into a whole-survey report. Incremental inputs contain the original question definitions plus the previous survey-level mock result and every answer (including the main rating) from newly eligible submitted surveys. Source counts represent surveys, not the sum of question answers. No raw answer content is persisted into output or sent to an AI provider. This is still mock generation.


## Analysis drawer placement

On the full participation page, the admin-only Análisis con IA trigger is opposite Volver atrás. On the main preview, it sits alongside the survey-version controls. The saved report, weekly allowance, generation action and results are all inside the shared animated drawer, not inline with the graph. Opening reads the saved analysis without consuming quota; generation remains a separate explicit action inside. Selection logic is shared with the question graph so the analysis always follows the same version. The current locally selected version is also preserved by the back link. No SQL or quota behavior changed.
