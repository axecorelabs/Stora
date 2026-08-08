# Archived: MongoDB → Supabase cutover scripts

These are one-off scripts from the MongoDB → PostgreSQL/Supabase migration
(schema patches applied ad hoc via the Supabase dashboard/scripts rather than
tracked migrations, plus incomplete early attempts at data migration).

They're superseded by:
- `supabase/migrations/` — the authoritative, tracked schema (single source of truth going forward)
- `migration/migrate-all.mjs` — the complete data migration script covering every Mongo collection

Kept for reference only. Not part of the running application.
