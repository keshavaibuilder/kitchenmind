-- Extend preferences with new tiffin columns
alter table preferences
  add column if not exists tiffin_default      text    not null default 'none',
  add column if not exists tiffin_boxes        integer not null default 0,
  add column if not exists tiffin_box1_options jsonb   not null default '[]',
  add column if not exists tiffin_box2_options jsonb   not null default '[]';

-- Extend meal_log meal_type to include tiffin
alter table meal_log
  drop constraint if exists meal_log_meal_type_check;

alter table meal_log
  add constraint meal_log_meal_type_check
  check (meal_type in ('breakfast','lunch','dinner','tiffin','snack'));
