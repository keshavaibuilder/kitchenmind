import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthService } from '@/services/AuthService'
import { HouseholdService } from '@/services/HouseholdService'
import useAuthStore from '@/store/authStore'

export function useAuth() {
  const { setSession, setHouseholdId, signOut } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true
    // Bumped on every auth lifecycle event (bootstrap, INITIAL_SESSION, SIGNED_IN, SIGNED_OUT,
    // ...). Each event captures the generation current at the moment it starts; any in-flight
    // resolveHousehold() from an earlier generation checks this after its await and no-ops if a
    // later event has since superseded it. This is what stops a stale household lookup — started
    // by an earlier SIGNED_IN — from navigating back to "/" after a subsequent SIGNED_OUT has
    // already navigated to "/login".
    let currentGeneration = 0
    const isStale = (generation) => !isMounted || generation !== currentGeneration

    // Bootstrap: check existing session on mount
    const bootstrapGeneration = ++currentGeneration
    AuthService.getSession().then(async (res) => {
      if (isStale(bootstrapGeneration)) return
      const session = res?.session ?? null
      setSession(session)
      if (session) {
        await resolveHousehold(session, setHouseholdId, navigate, bootstrapGeneration, isStale)
      } else {
        navigate('/login', { replace: true })
      }
      if (isStale(bootstrapGeneration)) return
      useAuthStore.setState({ loading: false })
    }).catch(() => {
      if (isStale(bootstrapGeneration)) return
      useAuthStore.setState({ loading: false })
    })

    // Listen for auth changes (magic link callback, sign out, etc.)
    const subscription = AuthService.onAuthStateChange(async (event, payload) => {
      const eventGeneration = ++currentGeneration
      const session = payload?.session ?? null
      setSession(session)
      if (event === 'SIGNED_IN' && session) {
        await resolveHousehold(session, setHouseholdId, navigate, eventGeneration, isStale)
      } else if (event === 'SIGNED_OUT') {
        // Bumping currentGeneration above already invalidated any earlier in-flight
        // resolveHousehold() (e.g. from a SIGNED_IN that hasn't resolved yet) before this
        // synchronous branch even runs, so there is no race window for it to navigate back to
        // "/" after this.
        signOut()
        navigate('/login', { replace: true })
      }
      if (isStale(eventGeneration)) return
      useAuthStore.setState({ loading: false })
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

async function resolveHousehold(session, setHouseholdId, navigate, generation, isStale) {
  try {
    const householdId = await HouseholdService.getHouseholdIdByUserId(session.user.id)
    if (isStale(generation)) return

    if (householdId) {
      setHouseholdId(householdId)
      navigate('/', { replace: true })
    } else {
      navigate('/onboarding', { replace: true })
    }
  } catch (err) {
    if (isStale(generation)) return
    console.error('Failed to resolve household:', err)
    navigate('/onboarding', { replace: true })
  }
}
