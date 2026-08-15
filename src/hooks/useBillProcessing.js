import { useMutation } from '@tanstack/react-query'
import { BillProcessingOrchestrator } from '@/services/BillProcessingOrchestrator'

/**
 * Custom hook for orchestrating bill receipt processing (OCR + Ingredient Matching).
 * Serves as the UI interface to BillProcessingOrchestrator.
 * Read-only pipeline execution with zero direct DB or Gemini dependencies.
 */
export function useBillProcessing() {
  const mutation = useMutation({
    mutationFn: ({ base64Image, mimeType = 'image/jpeg' }) =>
      BillProcessingOrchestrator.processBillImage(base64Image, mimeType),
  })

  return {
    processBill: async (base64Image, mimeType = 'image/jpeg') => {
      const result = await mutation.mutateAsync({ base64Image, mimeType })
      // TEMPORARY DIAGNOSTIC — remove after the ScanBill review-state bug is confirmed/fixed.
      console.info('[useBillProcessing] process result', {
        keys: Object.keys(result || {}),
        itemCount: Array.isArray(result?.items) ? result.items.length : 'not-an-array',
      })
      return result
    },
    isProcessing: mutation.isPending,
    error: mutation.error ?? null,
    result: mutation.data ?? null,
    reset: mutation.reset,
  }
}
