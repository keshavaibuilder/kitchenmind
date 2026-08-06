-- KitchenMind — initial schema
-- Run in Supabase SQL editor or via `supabase db push`

-- ─────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- household
-- ─────────────────────────────────────────────────────────────
create table household (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  baseline_members  int  not null default 4,
  roti_per_adult    int  not null default 3,
  roti_per_child    int  not null default 2,
  created_at        timestamptz not null default now()
);

alter table household enable row level security;

-- policy deferred — added after members table is created below

-- ─────────────────────────────────────────────────────────────
-- members
-- user_id links a family member to a Supabase auth account.
-- Adults who log in will have user_id set; children won't.
-- ─────────────────────────────────────────────────────────────
create table members (
  id               uuid primary key default uuid_generate_v4(),
  household_id     uuid not null references household(id) on delete cascade,
  user_id          uuid references auth.users(id) on delete set null,
  name             text not null,
  role             text not null check (role in ('adult', 'child', 'elder')),
  roti_preference  int,
  created_at       timestamptz not null default now()
);

create index members_household_id_idx on members(household_id);
create index members_user_id_idx      on members(user_id);

-- ─────────────────────────────────────────────────────────────
-- Helper: returns the household_id for the current auth user.
-- Defined here so the members table already exists.
-- ─────────────────────────────────────────────────────────────
create or replace function auth_household_id()
returns uuid
language sql
stable
security definer
as $$
  select household_id from members where user_id = auth.uid() limit 1
$$;

-- now safe: household policy can reference members
create policy "household: member access"
  on household for all
  using (id = auth_household_id());

alter table members enable row level security;

create policy "members: same household"
  on members for all
  using (household_id = auth_household_id());

-- ─────────────────────────────────────────────────────────────
-- preferences
-- ─────────────────────────────────────────────────────────────
create table preferences (
  id                   uuid primary key default uuid_generate_v4(),
  household_id         uuid not null references household(id) on delete cascade,
  breakfast_rotation   jsonb not null default '[]',
  non_veg_days         jsonb not null default '[]',
  fasting_days         jsonb not null default '[]',
  dal_order            jsonb not null default '[]',
  excluded_vegetables  jsonb not null default '[]'
);

create index preferences_household_id_idx on preferences(household_id);

alter table preferences enable row level security;

create policy "preferences: same household"
  on preferences for all
  using (household_id = auth_household_id());

-- ─────────────────────────────────────────────────────────────
-- guests
-- ─────────────────────────────────────────────────────────────
create table guests (
  id             uuid primary key default uuid_generate_v4(),
  household_id   uuid not null references household(id) on delete cascade,
  count          int  not null default 1,
  duration_type  text not null check (duration_type in ('single_meal', 'full_day', 'multi_day')),
  days_count     int,
  meal_scope     text not null check (meal_scope in ('breakfast', 'lunch', 'dinner', 'all')),
  date           date not null default current_date
);

create index guests_household_id_idx on guests(household_id);

alter table guests enable row level security;

create policy "guests: same household"
  on guests for all
  using (household_id = auth_household_id());

-- ─────────────────────────────────────────────────────────────
-- bills
-- ─────────────────────────────────────────────────────────────
create table bills (
  id            uuid primary key default uuid_generate_v4(),
  household_id  uuid not null references household(id) on delete cascade,
  bill_date     date not null default current_date,
  total_amount  numeric(10, 2) not null default 0,
  source        text not null check (source in ('scan', 'manual'))
);

create index bills_household_id_idx on bills(household_id);

alter table bills enable row level security;

create policy "bills: same household"
  on bills for all
  using (household_id = auth_household_id());

-- ─────────────────────────────────────────────────────────────
-- bill_items
-- ─────────────────────────────────────────────────────────────
create table bill_items (
  id              uuid primary key default uuid_generate_v4(),
  bill_id         uuid not null references bills(id) on delete cascade,
  item_name       text not null,
  category        text,
  quantity_value  numeric(10, 3),
  andaaza_unit    text,
  unit_grams      numeric(10, 3),
  cost            numeric(10, 2),
  purchase_date   date
);

create index bill_items_bill_id_idx on bill_items(bill_id);

alter table bill_items enable row level security;

create policy "bill_items: same household via bills"
  on bill_items for all
  using (
    bill_id in (
      select id from bills where household_id = auth_household_id()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- inventory
-- ─────────────────────────────────────────────────────────────
create table inventory (
  id                  uuid primary key default uuid_generate_v4(),
  household_id        uuid not null references household(id) on delete cascade,
  item_name           text not null,
  canonical_name      text not null,
  category            text,
  quantity_grams      numeric(10, 3) not null default 0,
  display_unit        text not null default 'g',
  low_stock_threshold numeric(10, 3) not null default 0,
  last_updated        timestamptz not null default now()
);

create index inventory_household_id_idx on inventory(household_id);

alter table inventory enable row level security;

create policy "inventory: same household"
  on inventory for all
  using (household_id = auth_household_id());

-- ─────────────────────────────────────────────────────────────
-- andaaza_profile
-- ─────────────────────────────────────────────────────────────
create table andaaza_profile (
  id              uuid primary key default uuid_generate_v4(),
  household_id    uuid not null references household(id) on delete cascade,
  ingredient_id   uuid not null references inventory(id) on delete cascade,
  expression      text not null,
  grams_assumed   numeric(10, 3) not null,
  grams_observed  numeric(10, 3),
  confidence      numeric(4, 3) not null default 0.5,
  sample_count    int  not null default 0,
  last_calibrated timestamptz,
  unique (household_id, ingredient_id, expression)
);

create index andaaza_profile_household_id_idx on andaaza_profile(household_id);

alter table andaaza_profile enable row level security;

create policy "andaaza_profile: same household"
  on andaaza_profile for all
  using (household_id = auth_household_id());

-- ─────────────────────────────────────────────────────────────
-- ingredient_aliases  (global lookup table, no household scoping)
-- ─────────────────────────────────────────────────────────────
create table ingredient_aliases (
  id              uuid primary key default uuid_generate_v4(),
  alias_name      text not null unique,
  canonical_name  text not null
);

create index ingredient_aliases_canonical_name_idx on ingredient_aliases(canonical_name);

alter table ingredient_aliases enable row level security;

-- all authenticated users can read; writes go via service role only
create policy "ingredient_aliases: authenticated read"
  on ingredient_aliases for select
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- recipes  (global catalogue, household-agnostic)
-- ─────────────────────────────────────────────────────────────
create table recipes (
  id             uuid primary key default uuid_generate_v4(),
  name           text not null,
  meal_type      text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  cuisine        text,
  base_servings  int  not null default 4,
  ingredients    jsonb not null default '[]',
  instructions   text
);

alter table recipes enable row level security;

create policy "recipes: authenticated read"
  on recipes for select
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- meal_log
-- ─────────────────────────────────────────────────────────────
create table meal_log (
  id            uuid primary key default uuid_generate_v4(),
  household_id  uuid not null references household(id) on delete cascade,
  date          date not null default current_date,
  meal_type     text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id     uuid references recipes(id) on delete set null,
  headcount     int  not null default 4,
  status        text not null check (status in ('planned', 'cooked', 'skipped')) default 'planned',
  notes         text
);

create index meal_log_household_id_idx on meal_log(household_id);
create index meal_log_date_idx         on meal_log(date);

alter table meal_log enable row level security;

create policy "meal_log: same household"
  on meal_log for all
  using (household_id = auth_household_id());

-- ─────────────────────────────────────────────────────────────
-- stock_deductions
-- ─────────────────────────────────────────────────────────────
create table stock_deductions (
  id                  uuid primary key default uuid_generate_v4(),
  meal_log_id         uuid not null references meal_log(id) on delete cascade,
  inventory_id        uuid not null references inventory(id) on delete cascade,
  andaaza_expression  text,
  grams_deducted      numeric(10, 3) not null,
  deducted_at         timestamptz not null default now()
);

create index stock_deductions_meal_log_id_idx   on stock_deductions(meal_log_id);
create index stock_deductions_inventory_id_idx  on stock_deductions(inventory_id);

alter table stock_deductions enable row level security;

create policy "stock_deductions: same household via meal_log"
  on stock_deductions for all
  using (
    meal_log_id in (
      select id from meal_log where household_id = auth_household_id()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- budget_monthly
-- ─────────────────────────────────────────────────────────────
create table budget_monthly (
  id                  uuid primary key default uuid_generate_v4(),
  household_id        uuid not null references household(id) on delete cascade,
  month               int  not null check (month between 1 and 12),
  year                int  not null,
  total               numeric(10, 2) not null default 0,
  by_category         jsonb not null default '{}',
  misc_total          numeric(10, 2) not null default 0,
  outside_food_total  numeric(10, 2) not null default 0,
  unique (household_id, month, year)
);

create index budget_monthly_household_id_idx on budget_monthly(household_id);

alter table budget_monthly enable row level security;

create policy "budget_monthly: same household"
  on budget_monthly for all
  using (household_id = auth_household_id());
