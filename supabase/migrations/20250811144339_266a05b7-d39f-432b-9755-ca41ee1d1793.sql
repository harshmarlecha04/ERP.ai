-- Re-run migration with corrected policy creation (no IF NOT EXISTS)

create extension if not exists pgcrypto;

alter table public.formulas
  add column if not exists formula_code text,
  add column if not exists recipe_json jsonb default '[]'::jsonb;

update public.formulas set formula_code = code where formula_code is null and code is not null;

create unique index if not exists formulas_formula_code_unique on public.formulas((lower(formula_code))) where formula_code is not null;

alter table public.raw_material_lots
  add column if not exists qty_reserved_kg numeric not null default 0;

create or replace view public.inventory_lots as
select
  l.id,
  l.raw_material_id as ingredient_id,
  rm.name as ingredient_name,
  coalesce(l.quantity, 0)::numeric as qty_on_hand_kg,
  coalesce(l.qty_reserved_kg, 0)::numeric as qty_reserved_kg,
  l.created_at
from public.raw_material_lots l
join public.raw_materials rm on rm.id = l.raw_material_id;

create table if not exists public.production_schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_date date not null unique,
  status text not null default 'scheduled',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_schedule_items (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.production_schedules(id) on delete cascade,
  formula_id uuid not null references public.formulas(id) on delete restrict,
  formula_code text not null,
  batches integer not null check (batches > 0),
  total_required_kg numeric not null default 0,
  materials_ok boolean not null default false,
  shortages_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_production_schedule_items_schedule_id on public.production_schedule_items(schedule_id);
create index if not exists idx_production_schedule_items_formula_id on public.production_schedule_items(formula_id);

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  schedule_item_id uuid not null references public.production_schedule_items(id) on delete cascade,
  lot_id uuid not null references public.raw_material_lots(id) on delete cascade,
  reserved_kg numeric not null check (reserved_kg > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_reservations_item on public.inventory_reservations(schedule_item_id);
create index if not exists idx_inventory_reservations_lot on public.inventory_reservations(lot_id);

alter table public.production_schedules enable row level security;
alter table public.production_schedule_items enable row level security;
alter table public.inventory_reservations enable row level security;

-- Drop and recreate policies to avoid "IF NOT EXISTS"
-- production_schedules
drop policy if exists "Anyone can view production schedules" on public.production_schedules;
drop policy if exists "Anyone can insert production schedules" on public.production_schedules;
drop policy if exists "Anyone can update production schedules" on public.production_schedules;
drop policy if exists "Anyone can delete production schedules" on public.production_schedules;
create policy "Anyone can view production schedules" on public.production_schedules for select using (true);
create policy "Anyone can insert production schedules" on public.production_schedules for insert with check (true);
create policy "Anyone can update production schedules" on public.production_schedules for update using (true);
create policy "Anyone can delete production schedules" on public.production_schedules for delete using (true);

-- production_schedule_items
drop policy if exists "Anyone can view production items" on public.production_schedule_items;
drop policy if exists "Anyone can insert production items" on public.production_schedule_items;
drop policy if exists "Anyone can update production items" on public.production_schedule_items;
drop policy if exists "Anyone can delete production items" on public.production_schedule_items;
create policy "Anyone can view production items" on public.production_schedule_items for select using (true);
create policy "Anyone can insert production items" on public.production_schedule_items for insert with check (true);
create policy "Anyone can update production items" on public.production_schedule_items for update using (true);
create policy "Anyone can delete production items" on public.production_schedule_items for delete using (true);

-- inventory_reservations
drop policy if exists "Anyone can view inventory reservations" on public.inventory_reservations;
drop policy if exists "Anyone can insert inventory reservations" on public.inventory_reservations;
drop policy if exists "Anyone can update inventory reservations" on public.inventory_reservations;
drop policy if exists "Anyone can delete inventory reservations" on public.inventory_reservations;
create policy "Anyone can view inventory reservations" on public.inventory_reservations for select using (true);
create policy "Anyone can insert inventory reservations" on public.inventory_reservations for insert with check (true);
create policy "Anyone can update inventory reservations" on public.inventory_reservations for update using (true);
create policy "Anyone can delete inventory reservations" on public.inventory_reservations for delete using (true);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_production_schedules_updated
before update on public.production_schedules
for each row execute function public.update_updated_at_column();

create trigger trg_production_schedule_items_updated
before update on public.production_schedule_items
for each row execute function public.update_updated_at_column();

create or replace function public.fn_upsert_schedule(p_schedule_date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.production_schedules where schedule_date = p_schedule_date;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.production_schedules(schedule_date)
  values (p_schedule_date)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.fn_formula_requirements(p_formula_id uuid, p_batches int)
returns table(ingredient_id uuid, ingredient_name text, required_kg numeric)
language sql
security definer
set search_path = public
as $$
  select
    (rec.ingredient_id)::uuid as ingredient_id,
    rec.ingredient_name::text as ingredient_name,
    (rec.qty_per_batch_kg::numeric * p_batches)::numeric as required_kg
  from (
    select * from jsonb_to_recordset(
      coalesce((select recipe_json from public.formulas f where f.id = p_formula_id), '[]'::jsonb)
    ) as x(ingredient_id text, ingredient_name text, qty_per_batch_kg numeric)
  ) rec
$$;

create or replace function public.fn_check_materials(
  p_formula_id uuid,
  p_batches int,
  p_schedule_date date,
  p_exclude_schedule_item_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shortages jsonb := '[]'::jsonb;
  v_ok boolean := true;
  req record;
  v_available numeric;
  v_scheduled numeric;
  v_result jsonb;
begin
  for req in select * from public.fn_formula_requirements(p_formula_id, p_batches) loop
    select coalesce(sum(l.quantity - l.qty_reserved_kg), 0) into v_available
    from public.raw_material_lots l
    where l.raw_material_id = req.ingredient_id;

    select coalesce(sum((rec.qty_per_batch_kg::numeric) * i.batches), 0) into v_scheduled
    from public.production_schedule_items i
    join public.production_schedules s on s.id = i.schedule_id
    join public.formulas f on f.id = i.formula_id
    cross join lateral jsonb_to_recordset(coalesce(f.recipe_json, '[]'::jsonb)) as rec(ingredient_id text, ingredient_name text, qty_per_batch_kg numeric)
    where s.schedule_date = p_schedule_date
      and coalesce(i.materials_ok, false) = true
      and coalesce(s.status, 'scheduled') <> 'completed'
      and (rec.ingredient_id::uuid) = req.ingredient_id
      and (p_exclude_schedule_item_id is null or i.id <> p_exclude_schedule_item_id);

    v_available := v_available - v_scheduled;

    if req.required_kg > v_available then
      v_ok := false;
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'ingredient_id', req.ingredient_id,
        'ingredient_name', req.ingredient_name,
        'required_kg', req.required_kg,
        'available_kg', greatest(v_available, 0),
        'shortfall_kg', greatest(req.required_kg - greatest(v_available, 0), 0)
      ));
    end if;
  end loop;

  v_result := jsonb_build_object('materials_ok', v_ok, 'shortages', v_shortages);
  return v_result;
end;
$$;

create or replace function public.fn_reserve_materials(p_schedule_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_req record;
  v_remaining numeric;
  v_reservations jsonb := '[]'::jsonb;
  v_take numeric;
  v_lot record;
begin
  select i.*, f.recipe_json from public.production_schedule_items i
  join public.formulas f on f.id = i.formula_id
  where i.id = p_schedule_item_id
  into v_item;

  if v_item.id is null then
    raise exception 'Schedule item not found';
  end if;

  for v_req in select * from public.fn_formula_requirements(v_item.formula_id, v_item.batches) loop
    v_remaining := v_req.required_kg;

    for v_lot in
      select l.* from public.raw_material_lots l
      where l.raw_material_id = v_req.ingredient_id
        and (l.quantity - l.qty_reserved_kg) > 0
      order by l.created_at asc, l.id asc
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, (v_lot.quantity - v_lot.qty_reserved_kg));
      if v_take > 0 then
        update public.raw_material_lots
          set qty_reserved_kg = qty_reserved_kg + v_take
          where id = v_lot.id;

        insert into public.inventory_reservations(schedule_item_id, lot_id, reserved_kg)
        values (p_schedule_item_id, v_lot.id, v_take);

        v_reservations := v_reservations || jsonb_build_array(jsonb_build_object(
          'ingredient_id', v_req.ingredient_id,
          'lot_id', v_lot.id,
          'reserved_kg', v_take
        ));

        v_remaining := v_remaining - v_take;
      end if;
    end loop;

    if v_remaining > 0 then
      raise exception 'Insufficient inventory to reserve for ingredient % (remaining % kg)', v_req.ingredient_id, v_remaining;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'reservations', v_reservations);
end;
$$;

create or replace function public.fn_move_item_and_recheck(p_schedule_item_id uuid, p_new_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_check jsonb;
  v_ok boolean;
  v_sched_id uuid;
  v_result jsonb;
begin
  select i.*, f.id as f_id from public.production_schedule_items i
  join public.formulas f on f.id = i.formula_id
  where i.id = p_schedule_item_id
  into v_item;

  if v_item.id is null then
    raise exception 'Schedule item not found';
  end if;

  v_check := public.fn_check_materials(v_item.formula_id, v_item.batches, p_new_date, p_schedule_item_id);
  v_ok := coalesce((v_check->>'materials_ok')::boolean, false);

  if v_ok then
    v_sched_id := public.fn_upsert_schedule(p_new_date);
    update public.production_schedule_items
      set schedule_id = v_sched_id
      where id = p_schedule_item_id;
    v_result := jsonb_build_object('ok', true, 'schedule_id', v_sched_id);
  else
    v_result := jsonb_build_object('ok', false, 'shortages', v_check->'shortages');
  end if;

  return v_result;
end;
$$;

create or replace function public.fn_create_schedule_item(
  p_schedule_date date,
  p_formula_id uuid,
  p_batches int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check jsonb;
  v_sched_id uuid;
  v_item_id uuid;
  v_total_required numeric;
  v_formula_code text;
  v_res jsonb;
begin
  v_check := public.fn_check_materials(p_formula_id, p_batches, p_schedule_date, null);
  if coalesce((v_check->>'materials_ok')::boolean, false) is distinct from true then
    return jsonb_build_object('ok', false, 'shortages', v_check->'shortages');
  end if;

  v_sched_id := public.fn_upsert_schedule(p_schedule_date);

  select coalesce(default_batch_size_kg, 0), formula_code
  into v_total_required, v_formula_code
  from public.formulas where id = p_formula_id;
  v_total_required := coalesce(v_total_required, 0) * p_batches;

  insert into public.production_schedule_items(
    schedule_id, formula_id, formula_code, batches, total_required_kg, materials_ok, shortages_json
  ) values (
    v_sched_id, p_formula_id, v_formula_code, p_batches, v_total_required, true, '[]'::jsonb
  ) returning id into v_item_id;

  v_res := public.fn_reserve_materials(v_item_id);

  return jsonb_build_object('ok', true, 'schedule_id', v_sched_id, 'item_id', v_item_id, 'reservations', v_res->'reservations');
end;
$$;
