# Response trend charts and lead row interactions

Implemented in Opiniones y métricas for restaurant users and admin. The line chart counts completed survey responses per local calendar date for today plus 29 preceding dates, including zeros. The bar chart groups exactly those same counts by ISO weekday, Monday through Sunday. Both honor restaurant, employee and rating scope; their period is explicitly fixed at 30 days independent of the existing period selector. Weekday bars show totals, not per-day averages; the UI explains unequal weekday occurrences. No paginated opinion data is used as a source of chart totals.

Apply `supabase/migrations/202611190001_response_trends.sql`. Authentication and per-restaurant owner/admin checks remain in the aggregate function; only daily/weekday counts are returned. Counts are grouped in America/Monterrey and exclude future timestamps. The aggregate is requested in parallel with existing metrics, and missing migration produces a pending message instead of fabricated zeros or an error for the whole page.

Charts use server-rendered SVG/HTML, shared tokens and no extra dependencies or client data requests. Daily values have a disclosure table; weekday values are visible and described for assistive technology. Empty periods show actual zero data.

The existing native details link is stretched across each desktop lead row with CSS. This preserves keyboard focus, modified click/new-tab behavior and the same preloaded response drawer as metrics. Mobile already uses a full-row link. Leads require their prior migrations for preloading, as documented in LEADS.md.

Source review only. No tests, builds, typecheck or browser QA run, per standing user instruction. No migrations applied, commit or push performed in this task.


## Chart UI polish

Custom SVG/CSS retained, with a small client component for point inspection; no chart library, dependencies or client data requests added. Reporting data/SQL/filter logic unchanged. The daily line has no permanent dots, three subtle gridlines, five date labels and HTML axis labels that remain readable on mobile. Hover, touch or arrow keys expose one active marker and a compact full-date tooltip; Home/End and Escape are supported. Weekday bars use native focusable buttons, visible counts, neutral zero markers, and tooltip inspection on hover/focus/tap. Both cards have aligned header/plot geometry, shorter copy, accessible reporting-period disclosure, and friendly no-response states instead of blank plots. The daily values table remains available, including during empty periods. No animation was added to data values. Source review only; no tests, builds or browser QA run.


## Participation chart

The question participation panel now uses 100% stacked horizontal bars, with blue for openings with an answer and neutral gray for openings without a recorded answer. Each question uses its own opening count as denominator, rather than a share of answers across unrelated questions. The table retains counts and per-question percentages; chart receives all existing question rows while the preview table remains limited to three. No sorting, query, filter or counting changes. Zero-opening questions show an undefined percentage and a clearly labeled no-opening state. Hover/focus/tap exposes counts and percentages for both segments. Preserves the 60% chart/40% table split and mobile stacking. Replaced obsolete pie CSS. No tests/builds/browser checks run.


## Participation by survey version

Apply 202611190002_participation_versions.sql to load the authorized published-version catalog, including versions without activity. Latest publication is the default; an invalid/out-of-scope selection falls back to that default. A new empty version shows its own empty state instead of old questions. Each restaurant/version is a separate selectable option in consolidated/admin scope. A questionVersion query parameter stores the local selection, preserving deep links and the transition between the four-question preview and the complete graph. Selection uses the already loaded participation fields without a new metrics request. Existing counts/order and unrelated metrics remain unchanged. Without the catalog migration, only versions present in tracking can be shown, and this limitation is stated in the UI. Source review only; no tests, builds, browser QA or deployment performed.
