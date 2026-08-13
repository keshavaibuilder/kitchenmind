import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../hooks/useDashboard'
import { useProactiveInsights } from '../hooks/useProactiveInsights'
import { useWorkflows } from '../hooks/useWorkflows'
import HouseholdSnapshotHeader from '../components/dashboard/HouseholdSnapshotHeader'
import InsightsSection from '../components/dashboard/InsightsSection'
import { WorkflowSection } from '../components/workflow/WorkflowSection'
import PantryHealthCard from '../components/dashboard/PantryHealthCard'
import LowStockList from '../components/dashboard/LowStockList'
import ExpiryRiskList from '../components/dashboard/ExpiryRiskList'
import ShoppingIntelligenceCard from '../components/dashboard/ShoppingIntelligenceCard'
import CookingSuggestionsCard from '../components/dashboard/CookingSuggestionsCard'
import PantryInsightsCard from '../components/dashboard/PantryInsightsCard'
import HouseholdTrendsCard from '../components/dashboard/HouseholdTrendsCard'
import ObservationTimeline from '../components/dashboard/ObservationTimeline'
import QuickActionsBar from '../components/dashboard/QuickActionsBar'
import { DashboardSkeleton } from '../components/Skeleton'

/**
 * Kitchen Intelligence Dashboard — answers "what should this household do today?" Every module
 * is derived (src/utils/dashboardInsights.js) from a small fixed set of aggregated reads via
 * useDashboard; no page-level Supabase access, no duplicated prediction/scoring logic.
 */
export default function Dashboard() {
  const dashboard = useDashboard()
  const navigate = useNavigate()

  const proactive = useProactiveInsights({
    householdId: dashboard.household_id,
    pantryItems: dashboard.inventoryItems,
    predictions: dashboard.predictions,
    expiringBatches: dashboard.expiringBatches,
    mealLogs: dashboard.recentMealLogs,
    recipes: dashboard.recipes,
    observations: dashboard.observations,
  })

  const { workflows, dismissWorkflow, completeWorkflow } = useWorkflows({
    householdId: dashboard.household_id,
    activeInsights: proactive.insights,
  })

  if (dashboard.isLoading) {
    return <DashboardSkeleton />
  }

  if (dashboard.isError) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-lg font-bold text-[#1E3A5F] mb-2">Couldn't load your kitchen intelligence</h2>
          <button
            onClick={dashboard.refetch}
            className="h-12 px-6 rounded-xl bg-[#1E3A5F] text-white font-semibold active:scale-95 transition-transform mt-4"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] px-4 pt-8 pb-8 max-w-md mx-auto space-y-4">
      <HouseholdSnapshotHeader snapshot={dashboard.snapshot} onRefresh={dashboard.refetch} />

      <InsightsSection
        insights={proactive.insights}
        criticalCount={proactive.criticalCount}
        warningCount={proactive.warningCount}
        infoCount={proactive.infoCount}
        onDismiss={proactive.dismissInsight}
        householdId={dashboard.household_id}
      />

      <WorkflowSection
        workflows={workflows}
        onDismiss={dismissWorkflow}
        onComplete={completeWorkflow}
        householdId={dashboard.household_id}
      />

      {/* Phase 5B entry point — deliberately not a 6th BottomNav tab (crowds mobile nav);
          the Planner gets its own always-visible card here instead of competing for one of
          QuickActionsBar's 4 contextual slots. */}
      <button
        onClick={() => navigate('/planner')}
        className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 text-left active:scale-95 transition-transform"
      >
        <span className="text-2xl" aria-hidden="true">
          📅
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#1E3A5F]">Plan your meals</p>
          <p className="text-xs text-gray-400">AI-assisted suggestions with shopping intelligence</p>
        </div>
        <span className="text-gray-300 ml-auto" aria-hidden="true">
          →
        </span>
      </button>

      <QuickActionsBar actions={dashboard.quickActions} />
      <PantryHealthCard pantryHealth={dashboard.pantryHealth} />
      <LowStockList items={dashboard.lowStock} />
      <ExpiryRiskList items={dashboard.expiryRisk} />
      <ShoppingIntelligenceCard items={dashboard.shoppingIntelligence} />
      <CookingSuggestionsCard suggestions={dashboard.cookingSuggestions} />
      <PantryInsightsCard insights={dashboard.pantryInsights} />
      <HouseholdTrendsCard trends={dashboard.householdTrends} />
      <ObservationTimeline observations={dashboard.observationTimeline} />
    </div>
  )
}
