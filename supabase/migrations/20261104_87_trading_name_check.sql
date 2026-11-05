-- A trading name is public, so it must be a real name: null, or at most 120 characters with at
-- least one visible character. Tabs, NBSP, zero-width characters and the like cannot pass as a name.
-- The character class must match TRADING_NAME_VISIBLE_CHARACTER in services/operatorCompliance.ts:
-- tests/front-door-schema.spec.ts checks both, on the same sample values.
-- With this in place a stored trading_name is never blank, so the btrim() checks in _86 hold.
alter table public.operator_profiles
  drop constraint if exists operator_profiles_trading_name_check;

alter table public.operator_profiles
  add constraint operator_profiles_trading_name_check check (
    trading_name is null
    or (
      char_length(trading_name) <= 120
      and trading_name ~ '[^\u0001-\u0020\u007F-\u00A0\u00AD\u034F\u061C\u115F\u1160\u1680\u17B4\u17B5\u180E\u2000-\u200F\u2028-\u202F\u205F-\u206F\u2800\u3000\u3164\uFE00-\uFE0F\uFEFF\uFFA0]'
    )
  );
