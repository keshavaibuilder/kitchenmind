# KitchenMind: AI Copilot User Guide

**Document Version:** 1.0.0  
**Domain:** Conversational Intelligence / User Guide  
**Sprint:** Sprint 6C — AI Copilot Conversational Experience  

---

## 1. Overview

The **KitchenMind AI Copilot** is a production-certified conversational interface designed to answer natural language questions about your kitchen, pantry inventory, recipes, shopping needs, and depletion forecasts.

Unlike generic chatbots, the Copilot is **mechanically grounded** in your household's real database. Every factual claim (quantities, depletion dates, recipe suggestions, observations) is verified against raw tools before being presented to you.

---

## 2. Navigating to the Copilot

- Click on the **✨ Copilot** tab in the main navigation bar.
- On desktop, the left sidebar displays your active and past conversations.
- On mobile devices, tap the **💬 Conversations** button in the header to open the conversation drawer.

---

## 3. Conversation Management

- **Start a New Chat:** Tap the **✨ New Conversation** button.
- **Auto-Generated Titles:** Starting a conversation automatically assigns a descriptive title derived from your initial question.
- **Search History:** Use the search bar in the conversation list to filter sessions by title.
- **Rename Conversation:** Click the ✏️ icon on any active conversation item to edit its name.
- **Clear Messages:** Click the 🧹 icon to clear current session messages without deleting the conversation container.
- **Delete Conversation:** Click the 🗑️ icon to remove a conversation and its history.

---

## 4. Asking Questions & Sample Prompts

You can type any kitchen query or click one of the interactive prompt chips:

- *"What should I cook tonight?"* — Suggests recipes based on available stock and dietary preferences.
- *"What ingredients are running low?"* — Displays low-stock inventory items and thresholds.
- *"What should I buy this weekend?"* — Generates category-grouped shopping recommendations.
- *"Which vegetables will expire first?"* — Shows depletion dates and expiry forecasts.
- *"Why did my grocery bill increase?"* — Summarizes spending trends and category movement.
- *"Show recipes using tomatoes."* — Filters global and custom recipes for specific ingredients.

---

## 5. Transparency & Grounding Indicators

The Copilot provides full transparency into how every response was generated:

1. **Grounding Badge:**
   - 🛡️ **Grounded in Kitchen Data** (`PASS`): All factual assertions were verified against inventory/recipe/planning tools.
   - ⚠️ **Repaired for Grounding** (`REPAIR`): The response was automatically corrected to remove ungrounded assertions.
   - 🚫 **Grounded Fallback** (`BLOCK`): Unvalidated claims were blocked, substituting safe informational text.
2. **Citations Footer:** Click **Based on N kitchen intelligence sources** to view the exact tools invoked, source databases, and timestamps.
3. **Tool Execution Timeline:** Real-time indicator showing capability status while your response is generated.
4. **Rich Visualizer Cards:** Embedded interactive UI cards for Inventory status, Recipe recommendations, Shopping suggestions, and Depletion forecasts.

---

## 6. Actions & Keyboard Shortcuts

- **Send Message:** Press `Enter` (or click `➔`).
- **New Line:** Press `Shift + Enter`.
- **Stop Generation:** Click `⏹ Stop` in the header or beside the input box while a turn is streaming.
- **Retry Turn:** Click `🔄 Retry` on your user prompt or error banner.
- **Copy Response:** Click the 📋 icon on any assistant message.

---

## 7. Safety & Permissions

- **Read-Only Default Intelligence:** The Copilot runtime defaults to read-only queries.
- **Confirmation-Gated Write Operations:** Any proposed database modification (marking meal cooked, cooking a recipe, adding to planner, updating inventory stock) requires explicit, out-of-band user confirmation.
- **No Autonomous Write Execution:** The Copilot LLM can NEVER authorize or commit a database write independently.

---

## 8. Confirming & Executing AI Actions

When you ask the Copilot to perform an action (e.g. *"Mark my Dal Tadka as cooked"* or *"Schedule Rajma Chawal for tomorrow lunch"*):

1. **Structured Action Proposal Preview:** The Copilot presents an **Action Preview Card** displaying:
   - Action title & description
   - Affected items (recipes / ingredients)
   - Quantities to deduct or add
   - Household impact & expected result
   - Warning badge for irreversible stock deductions
2. **User Confirmation:** Click **✓ Confirm Action** to authorize execution. For high-impact operations, a secondary confirmation dialog appears.
3. **Execution Status:** Once authorized, the Copilot executes the authorized domain service/RPC and displays an **Action Execution Status Card**:
   - `✓ Action Executed Successfully`: Confirms database changes and automatically refreshes application views.
   - `❌ Action Failed`: Honestly reports any backend issues (e.g. insufficient pantry stock).
   - `🚫 Action Cancelled`: Displayed if you click **Cancel**.

