# Shared application design system

Opiniones y métricas is the visual reference. `src/app/design-tokens.css` defines the neutral surfaces, dark text, muted text, electric blue action states, semantic success/warning/error colors, gold ratings, borders, radii, shadows, focus ring and spacing scale. `globals.css` imports those tokens and applies them to existing selectors; no framework or dependency was added.

## Coverage

Shared Button/Input classes, links, navigation, restaurant switcher, filters, tabs, form fields, cards, KPI panels, lists/tables, badges, empty states, pagination, loading states, alerts, verification dialog and preview dialog chrome use the shared palette. Existing layouts, sizes and responsive breakpoints are retained. This covers dashboard/admin, restaurants/settings, team, surveys/builder, onboarding, support and authentication. There is no new notification or tooltip implementation; existing feedback elements retain their semantics.

## Restaurant themes

Customer survey selectors and restaurant theme values are intentionally excluded from palette consolidation. Live surveys and embedded previews retain `--survey-accent`, `--survey-accent-text`, `--survey-focus`, custom backgrounds/images and the original neutral form-control baseline. Color swatches and device preview framing remain intentional exceptions. Marketing landing styles remain separate.

## Validation

Source/diff review only. No tests, build, typecheck, browser QA, or mobile QA were run, per the user's standing instruction. Responsive and visual acceptance still requires manual review. This refactor changes no queries, schema, API calls, analytics, sorting/filter logic, permissions or workflows. Earlier pending analytics/overview work remains separate in the working tree.
