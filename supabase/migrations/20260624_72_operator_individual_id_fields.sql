-- Individual operators provide a structured ID (type + number). Nullable: company
-- rows and existing rows leave them null; the app enforces presence for individuals.
alter table operator_profiles add column if not exists id_type text;
alter table operator_profiles add column if not exists id_number text;
