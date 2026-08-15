import { supabaseClient } from './supabaseClient.js'
import { AndaazaLearningService } from './AndaazaLearningService.js'
import { AIObservationService } from './AIObservationService.js'
import { AndaazaLearningEngine } from './AndaazaLearningEngine.js'
import { normalizeError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'
import { convertToUnitGrams, deriveBaseUnit } from '../utils/units.js'

/**
 * BillPersistenceService
 * Coordinates receipt persistence, validation, RPC execution, structured logging, and async post-commit AI hooks.
 */
export const BillPersistenceService = {
  /**
   * Validates reviewed bill data and commits it to the database via PostgreSQL RPC.
   * 
   * @param {string} householdId - Household UUID
   * @param {Object} reviewedBillData - Reviewed bill payload from UI
   * @returns {Promise<Object>} Commit summary object
   */
  async commitBill(householdId, reviewedBillData) {
    const startTime = performance.now()
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    if (!householdId) {
      throw normalizeError('Missing household_id for bill persistence', 'PERSISTENCE_VALIDATION_ERROR')
    }

    if (!reviewedBillData || typeof reviewedBillData !== 'object') {
      throw normalizeError('Invalid reviewed bill payload', 'PERSISTENCE_VALIDATION_ERROR')
    }

    const {
      idempotencyKey,
      merchant,
      billDate,
      totalAmount,
      source = 'scan',
      items = [],
    } = reviewedBillData

    // Filter active items (excluding removed ones)
    const activeItems = items.filter((i) => i.status !== 'removed')

    if (activeItems.length === 0) {
      throw normalizeError('Cannot commit bill with zero items', 'PERSISTENCE_VALIDATION_ERROR')
    }

    // Validate item values and format RPC payload
    const formattedItems = activeItems.map((item, index) => {
      const userEdits = item.userEdits || {}
      const ocr = item.ocr || {}
      const match = item.match || {}

      const itemName = userEdits.itemName || ocr.itemName || 'Grocery Item'
      const canonicalName = userEdits.canonicalName || match.canonicalName || itemName
      const rawQty = userEdits.quantity !== undefined && userEdits.quantity !== '' ? userEdits.quantity : ocr.quantity
      const quantityValue = Number(rawQty)
      const unit = (userEdits.unit || ocr.unit || 'g').toLowerCase().trim()
      const category = userEdits.category || match.category || 'Miscellaneous'
      const price = userEdits.price !== undefined && userEdits.price !== '' ? Number(userEdits.price) : null

      if (!canonicalName.trim()) {
        throw normalizeError(`Item #${index + 1} has an empty canonical name`, 'PERSISTENCE_VALIDATION_ERROR')
      }

      if (isNaN(quantityValue) || quantityValue <= 0) {
        throw normalizeError(`Item "${canonicalName}" must have a quantity greater than 0`, 'PERSISTENCE_VALIDATION_ERROR')
      }

      const unitGrams = convertToUnitGrams(quantityValue, unit)

      // Semantic quantity fields (audit: these were being computed correctly all the way
      // through OCR/review and then silently dropped here before reaching the RPC payload).
      // packSize/purchaseQuantity are OCR-native primitives — see OCRService.js — carried
      // through userEdits unchanged; never recomputed or fabricated in this layer.
      const rawPurchaseQuantity =
        userEdits.purchaseQuantity !== undefined && userEdits.purchaseQuantity !== ''
          ? userEdits.purchaseQuantity
          : ocr.purchaseQuantity
      const purchaseQuantity =
        rawPurchaseQuantity !== undefined && rawPurchaseQuantity !== null && rawPurchaseQuantity !== ''
          ? Number(rawPurchaseQuantity)
          : null

      const rawPackSize = userEdits.packSize !== undefined ? userEdits.packSize : ocr.packSize
      const packSize = rawPackSize === null || rawPackSize === undefined || rawPackSize === '' ? null : Number(rawPackSize)
      const hasPackSize = typeof packSize === 'number' && !isNaN(packSize) && packSize > 0

      // A packaged item's purchaseQuantity is a pack COUNT ('pcs'), even though `unit` here
      // is the pack's own unit (e.g. 'g' for a 110g pouch) — matches ScanBill's review-time
      // "N packs × Punit" display, which already treats purchaseQuantity as a count whenever
      // packSize is present.
      const purchaseUnit = hasPackSize ? 'pcs' : unit
      const packUnit = hasPackSize ? unit : null
      const baseUnit = deriveBaseUnit(unit)

      return {
        item_name: itemName,
        canonical_name: canonicalName,
        category: category,
        quantity_value: quantityValue,
        unit: unit,
        unit_grams: unitGrams,
        cost: price,
        purchase_quantity: purchaseQuantity,
        purchase_unit: purchaseUnit,
        pack_size: hasPackSize ? packSize : null,
        pack_unit: packUnit,
        base_unit: baseUnit,
      }
    })

    const effectiveIdempotencyKey = idempotencyKey || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const rpcPayload = {
      household_id: householdId,
      idempotency_key: effectiveIdempotencyKey,
      merchant: merchant || null,
      bill_date: billDate || new Date().toISOString().slice(0, 10),
      total_amount: totalAmount !== null && totalAmount !== undefined && totalAmount !== '' ? Number(totalAmount) : null,
      source: source,
      items: formattedItems,
    }

    // TEMPORARY DIAGNOSTIC — remove once the HTTP 400 root cause is confirmed.
    // Redacted: no household UUID, no item names/prices, just shape/presence.
    console.info('[BillCommit] RPC payload shape', {
      topLevelKeys: Object.keys(rpcPayload),
      billKeys: ['household_id', 'idempotency_key', 'merchant', 'bill_date', 'total_amount', 'source'].filter(
        (k) => rpcPayload[k] !== undefined
      ),
      itemCount: rpcPayload.items.length,
      firstItemKeys: rpcPayload.items[0] ? Object.keys(rpcPayload.items[0]) : [],
      householdIdPresent: Boolean(rpcPayload.household_id),
      idempotencyKeyPresent: Boolean(rpcPayload.idempotency_key),
    })

    // Execute atomic PostgreSQL RPC commit
    let rpcResult
    try {
      const { data, error } = await supabaseClient.rpc('commit_scanned_bill', {
        p_payload: rpcPayload,
      })

      if (error) {
        // TEMPORARY DIAGNOSTIC — remove once the HTTP 400 root cause is confirmed.
        // normalizeError() below overwrites `code` with 'BILL_COMMIT_FAILED' (its defaultCode
        // param takes precedence over err.code), which is why the real Postgres/PostgREST
        // code, message, details, and hint have been invisible downstream until now.
        console.error('[BillCommit] RPC error', {
          code: error?.code,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          status: error?.status,
        })
        throw normalizeError(error, 'BILL_COMMIT_FAILED')
      }

      rpcResult = data
    } catch (err) {
      const execTime = performance.now() - startTime
      logger.logCommitTelemetry('BILL_COMMIT_FAILED', {
        requestId,
        householdId,
        executionTime: execTime,
        rollbackReason: err.message,
        aiHookStatus: 'SKIPPED',
      })
      throw normalizeError(err, 'BILL_COMMIT_FAILED')
    }

    const totalExecutionTime = performance.now() - startTime

    logger.logCommitTelemetry('BILL_COMMIT_SUCCESS', {
      requestId,
      householdId: rpcResult.household_id,
      billId: rpcResult.bill_id,
      commitId: rpcResult.commit_id,
      executionTime: totalExecutionTime,
      isDuplicate: Boolean(rpcResult.is_duplicate),
      aiHookStatus: 'INITIATED',
    })

    // Trigger Non-blocking Asynchronous Post-Commit Hooks (Andaaza Engine & AI Observations)
    this._triggerAsyncPostCommitHooks(requestId, householdId, activeItems, { billId: rpcResult.bill_id, billDate, merchant }).catch((err) => {
      logger.warn('Async post-commit hooks failed silently:', { requestId, error: err.message })
    })

    return {
      success: true,
      commitId: rpcResult.commit_id,
      billId: rpcResult.bill_id,
      householdId: rpcResult.household_id,
      idempotencyKey: rpcResult.idempotency_key,
      isDuplicate: Boolean(rpcResult.is_duplicate),
      metrics: {
        billItemsCreated: rpcResult.metrics?.bill_items_created ?? 0,
        inventoryUpdated: rpcResult.metrics?.inventory_updated ?? 0,
        batchesCreated: rpcResult.metrics?.batches_created ?? 0,
        transactionsRecorded: rpcResult.metrics?.transactions_recorded ?? 0,
      },
      committedAt: rpcResult.committed_at || new Date().toISOString(),
    }
  },

  /**
   * Internal asynchronous post-commit hooks execution.
   * Runs non-blocking after main ACID transaction completes.
   * @private
   */
  async _triggerAsyncPostCommitHooks(requestId, householdId, activeItems, billMeta = {}) {
    try {
      if (typeof AndaazaLearningService?.recordObservations === 'function') {
        await AndaazaLearningService.recordObservations(householdId, activeItems)
      }
      if (typeof AIObservationService?.recordPostCommitObservations === 'function') {
        await AIObservationService.recordPostCommitObservations(householdId, activeItems)
      }
      if (typeof AndaazaLearningEngine?.processPostCommitLearning === 'function') {
        await AndaazaLearningEngine.processPostCommitLearning(householdId, activeItems, billMeta)
      }
      logger.info('Async post-commit AI hooks & Andaaza engine completed successfully', { requestId, householdId })
    } catch (err) {
      logger.warn('Andaaza AI observation logging caught in async post-hook:', { requestId, error: err.message })
    }
  },
}
