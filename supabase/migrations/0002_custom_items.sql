-- custom_items: household-specific dishes not in the global recipes catalogue
create table custom_items (
  id             uuid primary key default uuid_generate_v4(),
  household_id   uuid not null references household(id) on delete cascade,
  name           text not null,
  meal_type      text not null check (meal_type in ('breakfast','lunch','dinner','tiffin','snack')),
  cuisine_region text,
  cuisine_sub    text,
  ingredients    jsonb not null default '[]',
  created_at     timestamptz not null default now()
);

create index custom_items_household_id_idx on custom_items(household_id);

alter table custom_items enable row level security;

create policy "custom_items: household access"
  on custom_items for all
  using (household_id = auth_household_id());

-- extend recipes table with cuisine fields
alter table recipes add column if not exists cuisine_region text;
alter table recipes add column if not exists cuisine_sub    text;

-- extend preferences with tiffin fields
alter table preferences
  add column if not exists tiffin_type    text    not null default 'none',
  add column if not exists tiffin_options jsonb   not null default '[]',
  add column if not exists tiffin_count   integer not null default 0;
