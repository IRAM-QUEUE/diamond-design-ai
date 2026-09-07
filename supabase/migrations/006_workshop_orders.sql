begin;

create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  image_id uuid not null,
  reference_id text not null,
  customer_email text not null,
  customer_name text not null,
  customer_mobile text not null,
  image_name text not null,
  source_storage_path text not null,
  status text not null default 'preparing' check (status in ('preparing', 'new', 'viewed', 'in_progress', 'completed')),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, image_id, reference_id),
  check ((status = 'preparing' and submitted_at is null) or (status <> 'preparing' and submitted_at is not null))
);
create index shop_orders_inbox_idx on public.shop_orders (submitted_at desc, id desc) where submitted_at is not null;
alter table public.shop_orders enable row level security;
revoke all on public.shop_orders from anon, authenticated;
grant all on public.shop_orders to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workshop-orders', 'workshop-orders', false, 26214400, array['application/pdf', 'image/png']);
-- No client storage policies: PDFs use scoped, non-overwriting upload tokens;
-- originals and admin download links are issued only by authenticated routes.
notify pgrst, 'reload schema';
commit;
