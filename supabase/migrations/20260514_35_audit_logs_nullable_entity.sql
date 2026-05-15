-- entity_type and entity_id are NOT NULL but logAudit() uses target_type/target_id
-- (the newer columns). Make the old columns nullable so inserts don't fail.

ALTER TABLE public.audit_logs
  ALTER COLUMN entity_type DROP NOT NULL,
  ALTER COLUMN entity_id   DROP NOT NULL;
