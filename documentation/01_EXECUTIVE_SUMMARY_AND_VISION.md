# KitchenMind — Executive Summary & Product Vision

---

## 1. Executive Summary

**KitchenMind** is an intelligent, privacy-first, household-centric kitchen management and AI grocery ecosystem tailored specifically for Indian households. It solves the everyday logistical complexity of managing kitchen inventory, tracking grocery spending, parsing physical receipts via multimodal AI, and automating meal/recipe planning based on cultural dietary patterns (e.g. Roti Index, Tiffin boxes, fasting days, and regional dal rotations).

Built on top of a modern Web Architecture (**React + Vite + TailwindCSS + Supabase + Gemini 2.5 Vision**), KitchenMind replaces manual, error-prone spreadsheets with an intuitive, mobile-optimized Progressive Web Application (PWA) that converts unstructured paper receipts into structured inventory batches and actionable household insights.

---

## 2. Problem Statement & Core Challenges

Managing an Indian household kitchen presents unique domain challenges that generic global grocery trackers fail to address:

1. **Unstructured & Localized Receipts**: Supermarkets and kirana stores issue printed or handwritten bills in mixed English, Hindi, or regional text (e.g., "TATA SALT 1KG", "FORTUNE SUNFLOWER OIL 1L", "ARHAR DAL 500G").
2. **Abstract Culinary Units ("Andaaza")**: Indian cooking relies heavily on informal, volumetric, or count-based measures (e.g., "1 katori dal", "3 rotis", "1 pinch hing") rather than precise metric weights.
3. **Complex Dietary Schedules**: Indian weekly menus follow strict cultural and religious constraints (e.g., No non-veg on Tuesdays/Thursdays/Saturdays, fasting menus on Ekadashi/Navratri, daily tiffin box packing for school/office).
4. **Perishable Inventory & Expiry Loss**: Without batch-level tracking, high-value perishables (dairy, fresh produce, meat) spoil unnoticed, leading to financial waste.

---

## 3. Key Value Propositions

- **Zero-Friction Receipt Scanning**: Snap a photo of any grocery bill. Gemini 2.5 Flash extracts line items, normalizes canonical ingredient names, and detects quantities in seconds.
- **Human-in-the-Loop Review UI**: Transparent review screen allows users to edit quantities, canonical matches, prices, and categories before any database writes occur.
- **ACID Transaction Commit**: A single PostgreSQL RPC (`commit_scanned_bill`) handles stock increments, batch creation, transaction logging, and de-duplication atomically.
- **Roti Index & Headcount Scaling**: Dynamically computes roti dough (flour) requirements based on adult vs child headcount and custom household consumption ratios.
- **Andaaza Learning Engine**: Machine-learning observation feedback loop that continuously calibrates volumetric expressions ("1 katori") into precise gram/milliliter estimates over time.
- **Household-Isolated Multi-Tenancy**: Built with PostgreSQL Row-Level Security (RLS) guaranteeing 100% data isolation between households.

---

## 4. Target Audience & Personas

- **Primary Persona**: Primary household manager / home cook in urban/semi-urban Indian households.
- **Secondary Persona**: Family members contributing to grocery purchases or reviewing meal options.
- **User Goals**: Reduce monthly food waste, minimize time spent on grocery planning, automate meal selection, and maintain budget control.

---

## 5. Technology Stack Overview

| Layer | Technology Choice | Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 + Vite | Fast HMR, lightweight bundle size, modern component architecture. |
| **Styling & Design System** | TailwindCSS + Vanilla CSS | Vibrant HSL color palette, dark mode glassmorphism, responsive mobile-first UI. |
| **State & Caching** | Zustand + TanStack React Query | React Query for async server state; Zustand for local auth & UI session. |
| **Backend & Database** | Supabase (PostgreSQL + Auth + RLS) | Managed Postgres with built-in JWT authentication and Row-Level Security. |
| **Multimodal Vision AI** | Gemini 2.5 Flash API | High-accuracy OCR extraction of Indian receipt formatting at ultra-low latency. |
| **Deployment & Hosting** | Vercel | Seamless edge deployment with automatic preview environments. |

---

## 6. Document Suite Architecture

This document is part of the **KitchenMind Enterprise Documentation Suite**. The complete suite consists of 20 authoritative specifications:

1. `01_EXECUTIVE_SUMMARY_AND_VISION.md` (This document)
2. `02_SYSTEM_ARCHITECTURE.md`
3. `03_DATABASE_ERD_AND_SCHEMA.md`
4. `04_DOMAIN_MODEL_AND_GLOSSARY.md`
5. `05_BILL_PROCESSING_PIPELINE.md`
6. `06_BILL_PERSISTENCE_RPC_SPECIFICATION.md`
7. `07_ANDAAZA_AI_LEARNING_ENGINE.md`
8. `08_INVENTORY_MANAGEMENT_SPECIFICATION.md`
9. `09_RECIPE_AND_MEAL_LOGGING_SPECIFICATION.md`
10. `10_HOUSEHOLD_AND_TIFFIN_PREFERENCES_SPECIFICATION.md`
11. `11_BUDGET_AND_FINANCIAL_ANALYTICS.md`
12. `12_API_AND_SERVICES_CATALOGUE.md`
13. `13_CUSTOM_HOOKS_AND_STATE_MANAGEMENT.md`
14. `14_FRONTEND_UI_UX_AND_COMPONENT_HIERARCHY.md`
15. `15_SECURITY_AUTHENTICATION_AND_RLS_POLICIES.md`
16. `16_ERROR_HANDLING_LOGGING_AND_MONITORING.md`
17. `17_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md`
18. `18_DEPLOYMENT_DEVOPS_AND_CI_CD.md`
19. `19_IMPLEMENTATION_STATUS_AND_ROADMAP.md`
20. `20_DEVELOPMENT_STANDARDS_AND_CONTRIBUTION_GUIDE.md`
