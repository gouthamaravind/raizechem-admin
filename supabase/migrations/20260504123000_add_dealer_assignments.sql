-- ============================================
-- Dealer assignments for field employees
-- ============================================

create table if not exists public.dealer_assignments (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  user_id uuid not null,
  assigned_by uuid,
  created_at timestamptz not null default now(),
  unique (dealer_id, user_id)
);

create index if not exists idx_dealer_assignments_dealer on public.dealer_assignments(dealer_id);
create index if not exists idx_dealer_assignments_user on public.dealer_assignments(user_id);

alter table public.dealer_assignments enable row level security;

create policy "Field employees can view own dealer assignments"
  on public.dealer_assignments
  for select
  using (
    auth.uid() = user_id
    or public.has_role(auth.uid(), 'admin'::app_role)
    or public.has_role(auth.uid(), 'sales'::app_role)
    or public.has_role(auth.uid(), 'accounts'::app_role)
  );

create policy "Admin and sales can manage dealer assignments"
  on public.dealer_assignments
  for all
  using (
    public.has_role(auth.uid(), 'admin'::app_role)
    or public.has_role(auth.uid(), 'sales'::app_role)
  )
  with check (
    public.has_role(auth.uid(), 'admin'::app_role)
    or public.has_role(auth.uid(), 'sales'::app_role)
  );
