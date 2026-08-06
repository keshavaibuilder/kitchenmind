import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthService } from '@/services/AuthService'
import { HouseholdService } from '@/services/HouseholdService'
import useAuthStore from '@/store/authStore'

export function useAuth() {
  const { setSession, setHouseholdId, signOut } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    // Bootstrap: check existing session on mount
    AuthService.getSession().then(async (res) => {
      const session = res?.session ?? null
      setSession(session)
      if (session) {
        await resolveHousehold(session, setHouseholdId, navigate)
      } else {
        navigate('/login', { replace: true })
      }
      useAuthStore.setState({ loading: false })
    }).catch(() => {
      useAuthStore.setState({ loading: false })
    })

    // Listen for auth changes (magic link callback, sign out, etc.)
    const subscription = AuthService.onAuthStateChange(async (event, payload) => {
      const session = payload?.session ?? null
      setSession(session)
      if (event === 'SIGNED_IN' && session) {
        await resolveHousehold(session, setHouseholdId, navigate)
      } else if (event === 'SIGNED_OUT') {
        signOut()
        navigate('/login', { replace: true })
      }
      useAuthStore.setState({ loading: false })
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

async function resolveHousehold(session, setHouseholdId, navigate) {
  try {
    const householdId = await HouseholdService.getHouseholdIdByUserId(session.user.id)

    if (householdId) {
      setHouseholdId(householdId)
      navigate('/', { replace: true })
    } else {
      navigate('/onboarding', { replace: true })
    }
  } catch (err) {
    console.error('Failed to resolve household:', err)
    navigate('/onboarding', { replace: true })
  }
}
