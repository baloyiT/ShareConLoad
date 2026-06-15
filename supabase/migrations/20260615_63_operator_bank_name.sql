-- Add bank_name column to operator_profiles for storing institution name
-- (required for international/manual payout operators where bank_code is not available)
alter table operator_profiles add column if not exists bank_name text;
