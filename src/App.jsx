import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth }   from './hooks/useAuth'
import useAuthStore  from './store/authStore'
import BottomNav     from './components/BottomNav'
import ToastContainer from './components/ToastContainer'
import ErrorBoundary  from './components/ErrorBoundary'

import Login         from './pages/Login'
import AuthCallback  from './pages/AuthCallback'
import Home          from './pages/Home'
import Onboarding    from './pages/Onboarding'
import ScanBill      from './pages/ScanBill'
import Inventory     from './pages/Inventory'
import AddItem       from './pages/AddItem'
import RecipeLibrary from './pages/RecipeLibrary'
import RecipeDetail  from './pages/RecipeDetail'
import RecipeEditor  from './pages/RecipeEditor'
import MealHistory   from './pages/MealHistory'
import Dashboard     from './pages/Dashboard'
import Planner       from './pages/Planner'
import Copilot       from './pages/Copilot'

const Soon = ({ name }) => (
  <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center text-gray-400">
    <p className="text-lg font-medium">{name} — coming soon</p>
  </div>
)

// Layout for all protected screens — shows bottom nav, guards session
function ProtectedLayout() {
  const { session, loading } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2E86AB] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#1E3A5F] font-medium">Loading your kitchen…</p>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="pb-16">   {/* space for fixed bottom nav */}
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      <BottomNav />
      <ToastContainer />
    </div>
  )
}

// Onboarding doesn't get a bottom nav
function OnboardingLayout() {
  const { session, loading } = useAuthStore()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

function AppRoutes() {
  useAuth()

  return (
    <Routes>
      {/* Public */}
      <Route path="/login"         element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Onboarding — no bottom nav */}
      <Route element={<OnboardingLayout />}>
        <Route path="/onboarding" element={<Onboarding />} />
      </Route>

      {/* Protected — with bottom nav */}
      <Route element={<ProtectedLayout />}>
        <Route path="/"                    element={<Home />} />
        <Route path="/copilot"             element={<Copilot />} />
        <Route path="/dashboard"           element={<Dashboard />} />
        <Route path="/planner"             element={<Planner />} />
        <Route path="/scan"                element={<ScanBill />} />
        <Route path="/inventory"           element={<Inventory />} />
        <Route path="/meals"               element={<Soon name="Today's Meals" />} />
        <Route path="/meals/history"       element={<MealHistory />} />
        <Route path="/recipes"             element={<RecipeLibrary />} />
        <Route path="/recipes/new"         element={<RecipeEditor />} />
        <Route path="/recipes/:id/edit"    element={<RecipeEditor />} />
        <Route path="/recipe/:id"          element={<RecipeDetail />} />
        <Route path="/cook-something-else" element={<Soon name="Cook Something Else" />} />
        <Route path="/household"           element={<Soon name="Household" />} />
        <Route path="/add-guest"           element={<Soon name="Add Guest" />} />
        <Route path="/budget"              element={<Soon name="Budget" />} />
        <Route path="/add-item"            element={<AddItem />} />
        <Route path="/reconciliation"      element={<Soon name="Reconciliation" />} />
        <Route path="/settings"            element={<Soon name="Settings" />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return <AppRoutes />
}
