-- KitchenMind — Migration 0005: Andaaza Intelligence Engine Schema & Profiles

-- 1. Household Learning Profile Table
CREATE TABLE IF NOT EXISTS public.household_learning_profile (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id            uuid NOT NULL REFERENCES public.household(id) ON DELETE CASCADE,
  pantry_diversity_score  int NOT NULL DEFAULT 0,
  shopping_frequency_days numeric(6,2) DEFAULT 7.00,
  top_categories          jsonb DEFAULT '[]'::jsonb,
  preferred_shopping_day  text DEFAULT 'Sunday',
  total_bills_analyzed    int NOT NULL DEFAULT 0,
  last_analyzed_at        timestamptz DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id)
);

CREATE INDEX IF NOT EXISTS household_learning_profile_hh_idx ON public.household_learning_profile(household_id);
ALTER TABLE public.household_learning_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household_learning_profile: household isolation" ON public.household_learning_profile;
CREATE POLICY "household_learning_profile: household isolation"
  ON public.household_learning_profile FOR ALL
  USING (household_id = auth_household_id());

-- 2. Ingredient Consumption Profile Table
CREATE TABLE IF NOT EXISTS public.ingredient_consumption_profile (
  id                              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id                    uuid NOT NULL REFERENCES public.household(id) ON DELETE CASCADE,
  canonical_name                  text NOT NULL,
  category                        text DEFAULT 'Miscellaneous',
  avg_interval_days               numeric(6,2) DEFAULT 14.00,
  avg_purchase_grams              numeric(10,3) DEFAULT 1000.00,
  consumption_velocity_g_per_day numeric(10,3) DEFAULT 50.00,
  preferred_brand                 text,
  preferred_unit                  text DEFAULT 'g',
  confidence_score                numeric(4,3) NOT NULL DEFAULT 0.500,
  sample_count                    int NOT NULL DEFAULT 1,
  last_purchased_at               timestamptz DEFAULT now(),
  predicted_depletion_date        date,
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, canonical_name)
);

CREATE INDEX IF NOT EXISTS ingredient_consumption_profile_hh_canonical_idx ON public.ingredient_consumption_profile(household_id, canonical_name);
ALTER TABLE public.ingredient_consumption_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ingredient_consumption_profile: household isolation" ON public.ingredient_consumption_profile;
CREATE POLICY "ingredient_consumption_profile: household isolation"
  ON public.ingredient_consumption_profile FOR ALL
  USING (household_id = auth_household_id());

-- 3. Append-Only Purchase Patterns Table
CREATE TABLE IF NOT EXISTS public.purchase_patterns (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id      uuid NOT NULL REFERENCES public.household(id) ON DELETE CASCADE,
  canonical_name    text NOT NULL,
  bill_id           uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  purchase_date     date NOT NULL DEFAULT current_date,
  quantity_grams    numeric(10,3) NOT NULL,
  brand             text,
  interval_days     int,
  cost              numeric(10,2),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_patterns_hh_canonical_idx ON public.purchase_patterns(household_id, canonical_name);
ALTER TABLE public.purchase_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_patterns: household isolation" ON public.purchase_patterns;
CREATE POLICY "purchase_patterns: household isolation"
  ON public.purchase_patterns FOR ALL
  USING (household_id = auth_household_id());

-- 4. Prediction Cache Table
CREATE TABLE IF NOT EXISTS public.prediction_cache (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id             uuid NOT NULL REFERENCES public.household(id) ON DELETE CASCADE,
  canonical_name           text NOT NULL,
  predicted_depletion_date date NOT NULL,
  days_until_depletion     int NOT NULL,
  is_low_stock_risk        boolean DEFAULT false,
  confidence_score         numeric(4,3) NOT NULL DEFAULT 0.500,
  calculated_at            timestamptz NOT NULL DEFAULT now(),
  ttl_expires_at           timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (household_id, canonical_name)
);

CREATE INDEX IF NOT EXISTS prediction_cache_hh_idx ON public.prediction_cache(household_id);
ALTER TABLE public.prediction_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prediction_cache: household isolation" ON public.prediction_cache;
CREATE POLICY "prediction_cache: household isolation"
  ON public.prediction_cache FOR ALL
  USING (household_id = auth_household_id());
