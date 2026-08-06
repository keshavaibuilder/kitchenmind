# KitchenMind Enterprise Documentation

## Document 15: Security, Authentication, and Row Level Security (RLS) Policies

---

### 1. Executive Summary & Security Architecture

KitchenMind operates under a multi-tenant security architecture where each household functions as an isolated tenant boundary. Multi-tenancy is enforced natively at the database tier using Postgres **Row Level Security (RLS)** in tandem with **Supabase Authentication**. 

The fundamental security principle of KitchenMind is **Zero Cross-Household Data Leakage**. Regardless of frontend state mutations or API call origins, no database query can read, modify, or delete records belonging to another household.

```mermaid
flowchart TD
    Client[React Client / Web Application] -->|JWT Bearer Token| SupabaseAuth[Supabase Auth Engine]
    SupabaseAuth -->|Extract auth.uid()| Postgres[Postgres Database Engine]
    Postgres --> RLS[Row Level Security Engine]
    
    subgraph RLS Evaluation Boundary
        RLS -->|Executes| AuthFunc["auth_household_id()"]
        AuthFunc -->|Queries members table| HouseholdID[Retrieve Household ID]
        HouseholdID -->|Enforce Policy| Filter["USING (household_id = auth_household_id())"]
    end
    
    Filter -->|Matches| TenantData[(Household Isolated Data)]
    Filter -->|Mismatch| Blocked[403 Forbidden / Empty Resultset]
```

---

### 2. Supabase Auth Integration

#### 2.1 User vs. Household Binding
In KitchenMind, authentication is distinct from tenancy:
* **`auth.users`**: Managed by Supabase Auth (stores email, password hash, JWT claims).
* **`members`**: Domain entity linking an `auth.users` record to a specific `household`.
  * Adult family members who log in have a non-null `user_id` referencing `auth.users(id)`.
  * Child or non-account members have `user_id = NULL` while remaining linked to the household.

#### 2.2 Security Definer Helper Function
To evaluate tenancy efficiently without recursive policy definitions, KitchenMind uses a PostgreSQL `SECURITY DEFINER` function:

```sql
create or replace function auth_household_id()
returns uuid
language sql
stable
security definer
as $$
  select household_id 
  from members 
  where user_id = auth.uid() 
  limit 1;
$$;
```

> **Security Note**: Declaring `auth_household_id()` as `SECURITY DEFINER` allows it to query the `members` table bypassing RLS inside the function body, preventing infinite recursion when evaluating RLS policies on the `members` table itself.

---

### 3. RLS Policies Matrix

Every table in the KitchenMind schema is explicitly protected by RLS (`ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`). Below is the comprehensive policy matrix across all migrations (`0001_initial_schema`, `0002_custom_items`, `0003_tiffin_schema`).

| Table Name | Isolation Model | Access Scope | RLS Policy SQL Clause |
| :--- | :--- | :--- | :--- |
| **`household`** | Direct Tenant | `ALL` | `USING (id = auth_household_id())` |
| **`members`** | Direct Tenant | `ALL` | `USING (household_id = auth_household_id())` |
| **`preferences`** | Direct Tenant | `ALL` | `USING (household_id = auth_household_id())` |
| **`guests`** | Direct Tenant | `ALL` | `USING (household_id = auth_household_id())` |
| **`bills`** | Direct Tenant | `ALL` | `USING (household_id = auth_household_id())` |
| **`bill_items`** | Indirect Tenant (via `bills`) | `ALL` | `USING (bill_id IN (SELECT id FROM bills WHERE household_id = auth_household_id()))` |
| **`inventory`** | Direct Tenant | `ALL` | `USING (household_id = auth_household_id())` |
| **`andaaza_profile`** | Direct Tenant | `ALL` | `USING (household_id = auth_household_id())` |
| **`meal_log`** | Direct Tenant | `ALL` | `USING (household_id = auth_household_id())` |
| **`stock_deductions`** | Indirect Tenant (via `meal_log`) | `ALL` | `USING (meal_log_id IN (SELECT id FROM meal_log WHERE household_id = auth_household_id()))` |
| **`budget_monthly`** | Direct Tenant | `ALL` | `USING (household_id = auth_household_id())` |
| **`custom_items`** | Direct Tenant | `ALL` | `USING (household_id = auth_household_id())` |
| **`recipes`** | Global Reference | `SELECT` | `USING (auth.role() = 'authenticated')` |
| **`ingredient_aliases`** | Global Reference | `SELECT` | `USING (auth.role() = 'authenticated')` |

---

### 4. Row Isolation & Permission Boundaries

#### 4.1 Global vs. Household Data Isolation
* **Global Tables (`recipes`, `ingredient_aliases`)**: Read-only for authenticated users (`auth.role() = 'authenticated'`). Write operations are strictly restricted to database superusers or service-role edge functions.
* **Tenant Tables**: Any insert, update, delete, or select operation MUST evaluate against `auth_household_id()`. 

#### 4.2 Cascading Foreign Keys & Data Integrity
Foreign keys are defined with `ON DELETE CASCADE` to ensure strict referential integrity without orphan records:
* `household` deletion cascades down to `members`, `preferences`, `inventory`, `bills`, `meal_log`, `custom_items`, and `budget_monthly`.
* `bills` deletion cascades to `bill_items`.
* `meal_log` deletion cascades to `stock_deductions`.

---

### 5. API Key Protection & Defense-in-Depth Strategy

#### 5.1 Environment Variable Scoping
KitchenMind adheres to least-privilege principles regarding client environment variables:
* **`VITE_SUPABASE_URL`**: Public API endpoint endpoint URL.
* **`VITE_SUPABASE_ANON_KEY`**: Public Anonymous API Key. Safe for browser exposure because PostgreSQL RLS policies restrict all table access.
* **`SUPABASE_SERVICE_ROLE_KEY`**: **NEVER** exposed in Vite frontend bundles. Reserved exclusively for backend administrative tasks or serverless functions.
* **`VITE_GEMINI_API_KEY`**: Client-side API key for Google Gemini (bill OCR scanning and AI recipe generation).

#### 5.2 Gemini API Protection & Client-Side Rate Limiting
To prevent abuse of `VITE_GEMINI_API_KEY`:
1. **Domain Restricted Keys**: Google Cloud Console HTTP referrer restrictions limit API key usage strictly to authorized production domains (`*.vercel.app` and custom domain).
2. **Debounced Requests**: Client-side AI triggers (recipe recommendations and OCR parsers) use local debouncing and status gating to avoid rapid repeated invocations.
3. **Payload Sanitization**: User inputs sent to Gemini prompts are stripped of special control characters and structured into deterministic JSON format templates.
