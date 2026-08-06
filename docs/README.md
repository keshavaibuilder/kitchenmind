# KitchenMind — Enterprise Documentation Suite Index

Welcome to the **KitchenMind Enterprise Documentation Suite**. This directory contains the complete technical, architectural, operational, and domain documentation for the KitchenMind platform.

---

## 📚 Document Index

| # | Document Title | Description | Link |
| :--- | :--- | :--- | :--- |
| **01** | Executive Summary & Product Vision | Overview, domain challenges, core value propositions, and tech stack | [`01_EXECUTIVE_SUMMARY_AND_VISION.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/01_EXECUTIVE_SUMMARY_AND_VISION.md) |
| **02** | System Architecture Specification | Layered architecture, data flow diagrams, and Architecture Decision Records (ADRs) | [`02_SYSTEM_ARCHITECTURE.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/02_SYSTEM_ARCHITECTURE.md) |
| **03** | Database ERD & Schema Specification | Complete Entity-Relationship Diagram, table column definitions, RLS, and indexes | [`03_DATABASE_ERD_AND_SCHEMA.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/03_DATABASE_ERD_AND_SCHEMA.md) |
| **04** | Domain Model & Glossary | Domain entities, ubiquitous language (Andaaza, Roti Index, Canonical Name), contexts | [`04_DOMAIN_MODEL_AND_GLOSSARY.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/04_DOMAIN_MODEL_AND_GLOSSARY.md) |
| **05** | Bill Processing Pipeline | Receipt image capture, Gemini 2.5 Vision OCR, ingredient matching, review UI | [`05_BILL_PROCESSING_PIPELINE.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/05_BILL_PROCESSING_PIPELINE.md) |
| **06** | Bill Persistence RPC Specification | Authoritative specification for `commit_scanned_bill()` RPC, ACID boundaries, and idempotency | [`06_BILL_PERSISTENCE_RPC_SPECIFICATION.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/06_BILL_PERSISTENCE_RPC_SPECIFICATION.md) |
| **07** | Andaaza AI Learning Engine | Bayesian learning model, post-commit async hooks, volumetric calibration | [`07_ANDAAZA_AI_LEARNING_ENGINE.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/07_ANDAAZA_AI_LEARNING_ENGINE.md) |
| **08** | Inventory Management Specification | Real-time stock tracking, display unit conversions, FIFO batch expiry management | [`08_INVENTORY_MANAGEMENT_SPECIFICATION.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/08_INVENTORY_MANAGEMENT_SPECIFICATION.md) |
| **09** | Recipe & Meal Logging Specification | Global recipe catalogue, custom items, headcount roti scaling, stock deduction pipeline | [`09_RECIPE_AND_MEAL_LOGGING_SPECIFICATION.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/09_RECIPE_AND_MEAL_LOGGING_SPECIFICATION.md) |
| **10** | Household & Tiffin Specification | Household onboarding, member demographics, fasting rules, tiffin box options | [`10_HOUSEHOLD_AND_TIFFIN_PREFERENCES_SPECIFICATION.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/10_HOUSEHOLD_AND_TIFFIN_PREFERENCES_SPECIFICATION.md) |
| **11** | Budget & Financial Analytics | Monthly budgets, category allocation breakdown, outside food tracking | [`11_BUDGET_AND_FINANCIAL_ANALYTICS.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/11_BUDGET_AND_FINANCIAL_ANALYTICS.md) |
| **12** | API & Services Catalogue | JavaScript domain services contracts, method signatures, parameters, and errors | [`12_API_AND_SERVICES_CATALOGUE.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/12_API_AND_SERVICES_CATALOGUE.md) |
| **13** | Custom Hooks & State Management | React hooks (`useBillProcessing`, `useInventory`), Zustand stores, React Query policies | [`13_CUSTOM_HOOKS_AND_STATE_MANAGEMENT.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/13_CUSTOM_HOOKS_AND_STATE_MANAGEMENT.md) |
| **14** | Frontend UI/UX & Component Hierarchy | Route sitemap, visual design system tokens (HSL, Tailwind), page & modal tree | [`14_FRONTEND_UI_UX_AND_COMPONENT_HIERARCHY.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/14_FRONTEND_UI_UX_AND_COMPONENT_HIERARCHY.md) |
| **15** | Security, Auth & RLS Policies | Supabase Auth integration, RLS policy matrix, tenant isolation rules | [`15_SECURITY_AUTHENTICATION_AND_RLS_POLICIES.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/15_SECURITY_AUTHENTICATION_AND_RLS_POLICIES.md) |
| **16** | Error Handling & Monitoring | `normalizeError` framework, domain error codes, client-side resilience patterns | [`16_ERROR_HANDLING_LOGGING_AND_MONITORING.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/16_ERROR_HANDLING_LOGGING_AND_MONITORING.md) |
| **17** | Testing & QA Strategy | Unit test patterns, integration protocols, E2E scan-and-review verification | [`17_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/17_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md) |
| **18** | Deployment, DevOps & CI/CD | Vite production build config, Vercel deployment, environment matrix, migration sequence | [`18_DEPLOYMENT_DEVOPS_AND_CI_CD.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/18_DEPLOYMENT_DEVOPS_AND_CI_CD.md) |
| **19** | Implementation Status & Roadmap | Phase 1 to Phase 5 audit matrix, completed features vs pending milestones | [`19_IMPLEMENTATION_STATUS_AND_ROADMAP.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/19_IMPLEMENTATION_STATUS_AND_ROADMAP.md) |
| **20** | Development Standards & Contribution Guide | Coding style, file naming, git workflow, PR criteria, zero-guessing policy | [`20_DEVELOPMENT_STANDARDS_AND_CONTRIBUTION_GUIDE.md`](file:///mnt/c/Users/keysh/github/kitchenmind/docs/20_DEVELOPMENT_STANDARDS_AND_CONTRIBUTION_GUIDE.md) |

---

## 🎯 Purpose & Audience

This documentation suite makes KitchenMind **100% self-documenting**. Any senior engineer, cloud architect, product owner, or AI coding agent can inspect this directory to understand the exact data models, API signatures, business constraints, UI flows, and deployment steps without requiring prior chat context.
