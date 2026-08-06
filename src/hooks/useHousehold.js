import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HouseholdService } from '@/services/HouseholdService'
import useAuthStore from '@/store/authStore'

/**
 * Custom hook for household data and preferences.
 * Consumes HouseholdService and manages server state via React Query.
 */
export function useHousehold() {
  const queryClient = useQueryClient()
  const { household_id, user, setHouseholdId } = useAuthStore()

  // 1. Query household details
  const householdQuery = useQuery({
    queryKey: ['household', household_id],
    queryFn: () => HouseholdService.getHouseholdDetails(household_id),
    enabled: !!household_id,
  })

  // 2. Query household preferences
  const preferencesQuery = useQuery({
    queryKey: ['preferences', household_id],
    queryFn: () => HouseholdService.getPreferences(household_id),
    enabled: !!household_id,
  })

  // 3. Mutation for creating household with members & preferences
  const createHouseholdMutation = useMutation({
    mutationFn: (payload) =>
      HouseholdService.createHouseholdWithMembersAndPreferences({
        userId: user?.id,
        ...payload,
      }),
    onSuccess: (data) => {
      if (data?.household?.id) {
        setHouseholdId(data.household.id)
        queryClient.setQueryData(['household', data.household.id], data.household)
        queryClient.setQueryData(['preferences', data.household.id], data.preferences)
      }
    },
  })

  return {
    household: householdQuery.data ?? null,
    preferences: preferencesQuery.data ?? null,
    isLoading: householdQuery.isLoading || preferencesQuery.isLoading,
    isError: householdQuery.isError || preferencesQuery.isError,
    error: householdQuery.error || preferencesQuery.error,
    createHousehold: createHouseholdMutation.mutateAsync,
    isCreating: createHouseholdMutation.isPending,
    createError: createHouseholdMutation.error,
  }
}
