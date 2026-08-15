# Taste — Coding Style

- No hardcoded colors — use design tokens (brand ink/gold/cream). Confidence: 0.85
- Uses Solar BoldDuotone icons (`weight="BoldDuotone"`), not lucide-react. Confidence: 0.85
- No `any` type; no `console.log` (only `console.error` in catch). Confidence: 0.8
- Explicit return types on exported functions. Confidence: 0.7
- Do not edit `components/ui/*` (shadcn-generated). Confidence: 0.8
- Rate limiting before DB work on every endpoint. Confidence: 0.75
- Prisma Neon HTTP array-form `$transaction([...])` only (no callback form, no createMany). Confidence: 0.7
- Tables: horizontally scrollable, wrap cell text instead of truncating, match the existing booking-wedding table style. Confidence: 0.7
- Prefers hardcoded options for small known filter sets over deriving from the API response; dropdowns over chip filters. Confidence: 0.65
- Prefers right-side slide-in drawers for list→detail views (e.g., conversation detail) over navigating to a separate page or a centered modal. Confidence: 0.7
- Navigation depth follows data cardinality: a row mapping to one detail goes straight to it, but a row with many sub-items (e.g., a sales row → multiple conversations) keeps an intermediate list drawer before the detail/dump. Confidence: 0.7
- Prefers shared/general entities (like Vendor) to live under the `(general)` route group rather than nested under a specific domain module (like `purchase`). Confidence: 0.8
- Keeps permission-related layers in sync — module→permission registry, seeders, migration SQL, and page-level permission maps — and expects every layer updated (and the seeder/migration actually applied to the DB) together whenever a feature moves modules or a role's permissions change. Confidence: 0.75
- Prefers status/stage badges and labels to use the actual color from the source system (e.g., Bitrix `stageColor`) with auto-computed readable text contrast, rather than generic semantic color mappings. Confidence: 0.7
- Prefers referencing external-system records (e.g., a Bitrix deal looked up by client name) through a searchable dropdown showing context (PIC + status/stage), instead of manually typing a raw ID. Confidence: 0.7
