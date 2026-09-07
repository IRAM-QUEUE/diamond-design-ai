begin;

create table if not exists public.shop_settings (
  id boolean primary key default true check (id),
  recipient_email text not null default '',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.shop_settings (id) values (true) on conflict do nothing;
alter table public.shop_settings enable row level security;
revoke all on public.shop_settings from anon, authenticated;
grant all on public.shop_settings to service_role;

create table if not exists public.shop_order_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  image_id uuid not null references public.design_images(id),
  reference_id text not null,
  recipient_email text not null,
  customer_email text not null,
  customer_name text not null,
  customer_mobile text not null,
  source_storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'creating', 'ready', 'unknown')),
  gmail_draft_id text,
  gmail_message_id text,
  created_at timestamptz not null default now(),
  unique (user_id, image_id)
);
alter table public.shop_order_drafts enable row level security;
revoke all on public.shop_order_drafts from anon, authenticated;
grant all on public.shop_order_drafts to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-order-files', 'shop-order-files', false, 15728640, array['application/pdf'])
on conflict (id) do nothing;
notify pgrst, 'reload schema';
commit;
