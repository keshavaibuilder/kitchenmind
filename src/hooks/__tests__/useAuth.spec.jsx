import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuth } from '../useAuth'
import { AuthService } from '@/services/AuthService'
import { HouseholdService } from '@/services/HouseholdService'
import useAuthStore from '@/store/authStore'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('@/services/AuthService', () => ({
  AuthService: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
}))

vi.mock('@/services/HouseholdService', () => ({
  HouseholdService: {
    getHouseholdIdByUserId: vi.fn(),
  },
}))

describe('useAuth — sign-out lifecycle race safety', () => {
  let authChangeCallback

  beforeEach(() => {
    vi.clearAllMocks()
    navigateMock.mockClear()
    useAuthStore.setState({ user: null, session: null, household_id: null, loading: true })
    AuthService.getSession.mockResolvedValue({ session: null })
    AuthService.onAuthStateChange.mockImplementation((cb) => {
      authChangeCallback = cb
      return { unsubscribe: vi.fn() }
    })
  })

  it('does not let a stale SIGNED_IN household lookup navigate back to "/" after SIGNED_OUT', async () => {
    let resolveHouseholdLookup
    HouseholdService.getHouseholdIdByUserId.mockReturnValue(
      new Promise((resolve) => { resolveHouseholdLookup = resolve })
    )

    renderHook(() => useAuth())

    // Mount-time bootstrap (no existing session) settles and navigates to /login once —
    // isolate the assertions below to just the SIGNED_IN -> SIGNED_OUT race that follows.
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true }))
    navigateMock.mockClear()

    // SIGNED_IN starts household resolution, which does not resolve yet.
    authChangeCallback('SIGNED_IN', { session: { user: { id: 'u1' } } })
    await waitFor(() => expect(HouseholdService.getHouseholdIdByUserId).toHaveBeenCalledWith('u1'))

    // SIGNED_OUT occurs before that household resolution completes.
    await authChangeCallback('SIGNED_OUT', null)
    expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true })
    navigateMock.mockClear()

    // The stale SIGNED_IN's household lookup now finally resolves.
    resolveHouseholdLookup('household-1')
    await new Promise((resolve) => setTimeout(resolve, 0))

    // It must not navigate back to "/" (or "/onboarding"), and must not resurrect a
    // household id into the store that SIGNED_OUT already cleared.
    expect(navigateMock).not.toHaveBeenCalledWith('/', { replace: true })
    expect(navigateMock).not.toHaveBeenCalledWith('/onboarding', { replace: true })
    expect(useAuthStore.getState().household_id).toBeNull()
  })

  it('still navigates to "/" for a non-stale SIGNED_IN with an existing household (unaffected by the guard)', async () => {
    HouseholdService.getHouseholdIdByUserId.mockResolvedValue('household-1')

    renderHook(() => useAuth())
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true }))
    navigateMock.mockClear()

    await authChangeCallback('SIGNED_IN', { session: { user: { id: 'u1' } } })

    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true })
    expect(useAuthStore.getState().household_id).toBe('household-1')
  })
})
