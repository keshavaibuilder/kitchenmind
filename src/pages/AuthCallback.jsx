import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseClient } from '../services/supabaseClient'
import { HouseholdService } from '../services/HouseholdService'
import useAuthStore from '../store/authStore'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { setSession, setHouseholdId } = useAuthStore()

  useEffect(() => {
    supabaseClient.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate('/login', { replace: true })
        return
      }
      setSession(session)

      const householdId = await HouseholdService.getHouseholdIdByUserId(session.user.id)

      if (householdId) {
        setHouseholdId(householdId)
        navigate('/', { replace: true })
      } else {
        navigate('/onboarding', { replace: true })
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#2E86AB] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#1E3A5F] font-medium">Signing you in…</p>
        <p className="text-gray-400 text-sm mt-1">Just a moment</p>
      </div>
    </div>
  )
}
