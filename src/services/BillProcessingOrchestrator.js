import { OCRService } from './OCRService'
import { IngredientMatchingService } from './IngredientMatchingService'
import { normalizeError } from '@/utils/errors'

/**
 * BillProcessingOrchestrator
 * Framework-agnostic workflow orchestrator for receipt image processing.
 * Coordinates OCR extraction and ingredient matching without performing DB writes or UI operations.
 */
export const BillProcessingOrchestrator = {
  /**
   * Processes a bill image by running OCR extraction followed by ingredient alias resolution.
   * Type: Orchestrator Workflow
   * 
   * @param {string} base64Image - Base64 encoded image string
   * @param {string} [mimeType='image/jpeg'] - Image MIME type
   * @returns {Promise<{ merchant: string|null, billDate: string|null, totalAmount: number|null, items: Array<{ ocr: { itemName: string, purchaseQuantity: number, packSize: number|null, quantity: number, unit: string, price: number|null }, match: Object }>, processingSummary: { totalItems: number, matchedItems: number, manualReviewItems: number } }>}
   */
  async processBillImage(base64Image, mimeType = 'image/jpeg') {
    if (!base64Image) {
      throw normalizeError('No bill image provided for processing', 'ORCHESTRATOR_INVALID_INPUT')
    }

    // Step 1: Execute OCR extraction (Stops processing if OCR fails)
    let ocrResult
    try {
      ocrResult = await OCRService.scanBill(base64Image, mimeType)
    } catch (err) {
      // TEMPORARY DIAGNOSTIC — remove after the ScanBill review-state bug is confirmed/fixed.
      console.info('[Orchestrator] OCR call threw', { code: err.code, message: err.message })
      throw normalizeError(err, 'BILL_PROCESSING_OCR_FAILED')
    }

    // TEMPORARY DIAGNOSTIC — remove after the ScanBill review-state bug is confirmed/fixed.
    console.info('[Orchestrator] OCR result received', {
      keys: Object.keys(ocrResult || {}),
      itemCount: Array.isArray(ocrResult?.items) ? ocrResult.items.length : 'not-an-array',
    })

    const { merchant, billDate, totalAmount, items: ocrItems } = ocrResult

    if (!Array.isArray(ocrItems) || ocrItems.length === 0) {
      throw normalizeError('No items extracted from bill image', 'BILL_PROCESSING_NO_ITEMS')
    }

    // Step 2: Execute Ingredient Matching with per-item resilience and separate OCR/Match schemas
    let manualReviewCount = 0
    let matchedCount = 0

    const processedItems = await Promise.all(
      ocrItems.map(async (item) => {
        let matchResult
        try {
          matchResult = await IngredientMatchingService.matchItem(item)
        } catch (err) {
          matchResult = {
            ingredientId: null,
            canonicalName: item.canonicalName || item.itemName || 'Unknown Item',
            matchedAlias: null,
            confidence: 'LOW',
            confidenceScore: 0.0,
            requiresManualReview: true,
            originalItem: item,
            error: normalizeError(err).message,
          }
        }

        if (matchResult.requiresManualReview) {
          manualReviewCount++
        } else {
          matchedCount++
        }

        return {
          ocr: {
            itemName: item.itemName,
            purchaseQuantity: item.purchaseQuantity,
            packSize: item.packSize,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
          },
          match: {
            ingredientId: matchResult.ingredientId ?? null,
            canonicalName: matchResult.canonicalName,
            category: item.category || 'Miscellaneous',
            confidence: matchResult.confidence,
            matchedAlias: matchResult.matchedAlias ?? null,
            requiresManualReview: matchResult.requiresManualReview,
          },
        }
      })
    )

    // Step 3: Return normalized business result object
    const finalResult = {
      merchant: merchant ?? null,
      billDate: billDate ?? null,
      totalAmount: totalAmount !== null ? Number(totalAmount) : null,
      items: processedItems,
      processingSummary: {
        totalItems: ocrItems.length,
        matchedItems: matchedCount,
        manualReviewItems: manualReviewCount,
      },
    }
    // TEMPORARY DIAGNOSTIC — remove after the ScanBill review-state bug is confirmed/fixed.
    console.info('[Orchestrator] final result', { itemCount: finalResult.items.length, processingSummary: finalResult.processingSummary })
    return finalResult
  },
}
