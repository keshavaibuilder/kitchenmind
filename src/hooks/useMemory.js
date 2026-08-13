import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useHousehold } from './useHousehold.js'
import { MemoryService } from '../services/MemoryService.js'

export function useMemory() {
  const { household } = useHousehold()
  const householdId = household?.id
  const queryClient = useQueryClient()

  const memoriesQuery = useQuery({
    queryKey: ['copilot_memories', householdId],
    queryFn: () => MemoryService.loadMemories(householdId),
    enabled: Boolean(householdId),
    staleTime: 1000 * 60 * 5,
  })

  const saveMemoryMutation = useMutation({
    mutationFn: (memoryData) => MemoryService.saveMemory(householdId, memoryData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copilot_memories', householdId] })
    },
  })

  const updateMemoryMutation = useMutation({
    mutationFn: ({ memoryId, updates }) => MemoryService.updateMemory(householdId, memoryId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copilot_memories', householdId] })
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ memoryId, status }) => MemoryService.setMemoryStatus(householdId, memoryId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copilot_memories', householdId] })
    },
  })

  const deleteMemoryMutation = useMutation({
    mutationFn: (memoryId) => MemoryService.deleteMemory(householdId, memoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copilot_memories', householdId] })
    },
  })

  const clearAllMutation = useMutation({
    mutationFn: () => MemoryService.clearAllMemories(householdId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copilot_memories', householdId] })
    },
  })

  return {
    memories: memoriesQuery.data || [],
    isLoading: memoriesQuery.isLoading,
    isError: memoriesQuery.isError,
    error: memoriesQuery.error,
    saveMemory: saveMemoryMutation.mutateAsync,
    isSaving: saveMemoryMutation.isPending,
    updateMemory: updateMemoryMutation.mutateAsync,
    isUpdating: updateMemoryMutation.isPending,
    toggleMemoryStatus: toggleStatusMutation.mutateAsync,
    deleteMemory: deleteMemoryMutation.mutateAsync,
    clearAllMemories: clearAllMutation.mutateAsync,
    isClearing: clearAllMutation.isPending,
    refetch: memoriesQuery.refetch,
  }
}
