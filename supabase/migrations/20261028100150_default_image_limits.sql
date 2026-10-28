-- New profiles get the higher defaults. Bring existing default limits forward
-- independently, preserving any per-user limits the admin has customized.
alter table public.profiles
  alter column daily_image_limit set default 25,
  alter column monthly_image_limit set default 250;

update public.profiles
set daily_image_limit = case when daily_image_limit = 5 then 25 else daily_image_limit end,
    monthly_image_limit = case when monthly_image_limit = 50 then 250 else monthly_image_limit end
where daily_image_limit = 5 or monthly_image_limit = 50;
