-- PostgreSQL standard-conforming strings do not require a doubled backslash
-- before the optional literal plus sign. The original expression compiled as
-- an invalid regular expression whenever a phone value was updated.

alter table public.user_profiles
  drop constraint if exists user_profiles_phone_check;

alter table public.user_profiles
  add constraint user_profiles_phone_check
  check (phone is null or phone ~ '^\+?[0-9][0-9 -]{7,18}$')
  not valid;

alter table public.user_profiles
  validate constraint user_profiles_phone_check;
