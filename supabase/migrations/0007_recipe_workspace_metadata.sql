-- KitchenMind — Migration 0007: Recipe Workspace metadata columns + starter global recipes
--
-- Discovered defect: the committed `recipes` table (0001) has no image, description, timing,
-- difficulty, vegetarian flag, or tags — fields the Recipe Detail page and Library filters
-- explicitly require (Phase 4C). Purely additive (nullable / defaulted columns), no RLS or
-- deduction-RPC changes.

ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS prep_time_mins int;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS cook_time_mins int;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS difficulty text CHECK (difficulty IN ('easy', 'medium', 'hard'));
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS is_vegetarian boolean;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS recipes_meal_type_idx ON public.recipes(meal_type);
CREATE INDEX IF NOT EXISTS recipes_cuisine_idx ON public.recipes(cuisine);

-- Starter global catalogue so the Recipe Library isn't empty by default. Guarded so this only
-- runs once (idempotent across repeated `supabase db push`) — checks for zero existing global
-- recipes rather than adding a new unique constraint the schema doesn't otherwise need.
-- Ingredient canonical_names match src/pages/AddItem.jsx's curated list so inventory
-- availability checks against a real household's pantry actually resolve.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.recipes WHERE household_id IS NULL) THEN
    INSERT INTO public.recipes (name, meal_type, cuisine, base_servings, ingredients, instructions, description, prep_time_mins, cook_time_mins, difficulty, is_vegetarian, tags) VALUES
    (
      'Dal Tadka', 'lunch', 'North Indian', 4,
      '[{"canonical_name":"Toor Dal","base_quantity_grams":200},{"canonical_name":"Onion","base_quantity_grams":100},{"canonical_name":"Tomato","base_quantity_grams":100},{"canonical_name":"Ginger","base_quantity_grams":15},{"canonical_name":"Garlic","base_quantity_grams":10},{"canonical_name":"Turmeric","base_quantity_grams":5},{"canonical_name":"Cooking Oil","base_quantity_grams":30},{"canonical_name":"Cumin Seeds","base_quantity_grams":5,"is_optional":true}]'::jsonb,
      'Pressure-cook dal with turmeric until soft. Prepare a tadka of cumin, onion, ginger-garlic and tomato in hot oil, then pour over the dal and simmer 5 minutes.',
      'A comforting everyday lentil curry, tempered with cumin and aromatics.',
      10, 25, 'easy', true, '["comfort food","everyday","protein-rich"]'::jsonb
    ),
    (
      'Aloo Gobi', 'lunch', 'North Indian', 4,
      '[{"canonical_name":"Potato","base_quantity_grams":300},{"canonical_name":"Cauliflower","base_quantity_grams":300},{"canonical_name":"Onion","base_quantity_grams":80},{"canonical_name":"Tomato","base_quantity_grams":80},{"canonical_name":"Turmeric","base_quantity_grams":5},{"canonical_name":"Red Chilli Powder","base_quantity_grams":5},{"canonical_name":"Cooking Oil","base_quantity_grams":30}]'::jsonb,
      'Saute potato and cauliflower with onion, tomato, and spices until tender.',
      'A dry North Indian vegetable stir-fry, mild and family-friendly.',
      15, 20, 'easy', true, '["dry sabzi","everyday"]'::jsonb
    ),
    (
      'Rajma Masala', 'dinner', 'North Indian', 4,
      '[{"canonical_name":"Kidney Beans","base_quantity_grams":250},{"canonical_name":"Onion","base_quantity_grams":120},{"canonical_name":"Tomato","base_quantity_grams":150},{"canonical_name":"Ginger","base_quantity_grams":15},{"canonical_name":"Garlic","base_quantity_grams":15},{"canonical_name":"Garam Masala","base_quantity_grams":8},{"canonical_name":"Cooking Oil","base_quantity_grams":30}]'::jsonb,
      'Pressure-cook soaked rajma until soft. Cook a tomato-onion masala base, add rajma and simmer until thick.',
      'Punjabi kidney bean curry, classically served with rice.',
      20, 40, 'medium', true, '["weekend","protein-rich"]'::jsonb
    ),
    (
      'Chicken Curry', 'dinner', 'North Indian', 4,
      '[{"canonical_name":"Chicken","base_quantity_grams":600},{"canonical_name":"Onion","base_quantity_grams":150},{"canonical_name":"Tomato","base_quantity_grams":150},{"canonical_name":"Ginger","base_quantity_grams":20},{"canonical_name":"Garlic","base_quantity_grams":20},{"canonical_name":"Garam Masala","base_quantity_grams":10},{"canonical_name":"Red Chilli Powder","base_quantity_grams":8},{"canonical_name":"Cooking Oil","base_quantity_grams":40}]'::jsonb,
      'Brown onions, add ginger-garlic and spices, then chicken and tomato. Simmer until cooked through.',
      'A home-style chicken curry with a rich onion-tomato gravy.',
      20, 35, 'medium', false, '["non-vegetarian","weekend"]'::jsonb
    ),
    (
      'Vegetable Poha', 'breakfast', 'Maharashtrian', 4,
      '[{"canonical_name":"Flattened Rice","base_quantity_grams":250},{"canonical_name":"Onion","base_quantity_grams":80},{"canonical_name":"Potato","base_quantity_grams":100},{"canonical_name":"Green Chilli","base_quantity_grams":5},{"canonical_name":"Mustard Seeds","base_quantity_grams":5},{"canonical_name":"Cooking Oil","base_quantity_grams":20},{"canonical_name":"Coriander Leaves","base_quantity_grams":10,"is_optional":true}]'::jsonb,
      'Rinse and soften poha. Temper mustard seeds, onion, potato and chilli, then fold in the poha and cook briefly.',
      'A light, quick Maharashtrian breakfast of flattened rice.',
      10, 15, 'easy', true, '["breakfast","quick","light"]'::jsonb
    ),
    (
      'Paneer Butter Masala', 'dinner', 'North Indian', 4,
      '[{"canonical_name":"Paneer","base_quantity_grams":300},{"canonical_name":"Tomato","base_quantity_grams":250},{"canonical_name":"Onion","base_quantity_grams":100},{"canonical_name":"Butter","base_quantity_grams":40},{"canonical_name":"Cream","base_quantity_grams":50},{"canonical_name":"Garam Masala","base_quantity_grams":8},{"canonical_name":"Ginger","base_quantity_grams":10},{"canonical_name":"Garlic","base_quantity_grams":10}]'::jsonb,
      'Simmer a tomato-onion-butter gravy, blend smooth, add cream and garam masala, then fold in paneer cubes.',
      'A rich, restaurant-style paneer curry in a creamy tomato gravy.',
      15, 30, 'medium', true, '["vegetarian","weekend","rich"]'::jsonb
    ),
    (
      'Vegetable Khichdi', 'lunch', 'North Indian', 4,
      '[{"canonical_name":"Rice","base_quantity_grams":150},{"canonical_name":"Moong Dal","base_quantity_grams":100},{"canonical_name":"Carrot","base_quantity_grams":80},{"canonical_name":"Green Peas","base_quantity_grams":80},{"canonical_name":"Turmeric","base_quantity_grams":5},{"canonical_name":"Ghee","base_quantity_grams":20}]'::jsonb,
      'Pressure-cook rice, dal, and vegetables together with turmeric until soft. Finish with a spoon of ghee.',
      'A simple, easily digestible one-pot rice and lentil dish.',
      10, 20, 'easy', true, '["comfort food","light","one-pot"]'::jsonb
    ),
    (
      'Egg Bhurji', 'breakfast', 'North Indian', 4,
      '[{"canonical_name":"Eggs","base_quantity_grams":6,"is_optional":false},{"canonical_name":"Onion","base_quantity_grams":80},{"canonical_name":"Tomato","base_quantity_grams":80},{"canonical_name":"Green Chilli","base_quantity_grams":5},{"canonical_name":"Turmeric","base_quantity_grams":3},{"canonical_name":"Cooking Oil","base_quantity_grams":20}]'::jsonb,
      'Saute onion, tomato, and chilli, then add beaten eggs and scramble until cooked.',
      'Spiced Indian-style scrambled eggs.',
      5, 10, 'easy', false, '["breakfast","quick","non-vegetarian"]'::jsonb
    );
  END IF;
END $$;
