import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OCRService } from '../OCRService.js'
import { GeminiModelRouter } from '../GeminiModelRouter.js'

function mockFetchOnce(response) {
  globalThis.fetch = vi.fn().mockResolvedValue(response)
}

function geminiResponse(text) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  }
}

describe('OCRService.scanBill', () => {
  beforeEach(() => {
    // The model router's health state is a module-level singleton (by design — it needs to
    // persist across scanBill() calls within a real session) so it must be reset between tests,
    // or an earlier test putting a model into cooldown would silently change which model a later
    // test's assertions expect.
    GeminiModelRouter._resetHealth()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    GeminiModelRouter._resetHealth()
  })

  it('calls the default primary pool model (gemini-3.7-flash), not the retired gemini-2.5-flash', async () => {
    mockFetchOnce(
      geminiResponse(
        JSON.stringify({ merchant: 'Test Store', billDate: '2026-01-01', totalAmount: 10, items: [
          { itemName: 'Salt', canonicalName: 'Salt', quantity: 1, unit: 'kg', price: 10, category: 'Staples', confidence: 'high' },
        ] })
      )
    )

    await OCRService.scanBill('base64data', 'image/jpeg')

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const calledUrl = globalThis.fetch.mock.calls[0][0]
    expect(calledUrl).toContain('models/gemini-3.7-flash:generateContent')
    expect(calledUrl).not.toContain('gemini-2.5-flash')
  })

  it('normalizes a successful response into the expected OCR output contract', async () => {
    mockFetchOnce(
      geminiResponse(
        JSON.stringify({
          merchant: 'Reliance Fresh',
          billDate: '2026-01-15',
          totalAmount: 50,
          items: [
            { itemName: 'TATA SALT 1KG', canonicalName: 'Salt', quantity: 1, unit: 'kg', price: 20, category: 'Staples', confidence: 'high' },
            { itemName: 'FORTUNE OIL 1L', canonicalName: 'Cooking Oil', quantity: 1, unit: 'L', price: 30, category: 'Staples', confidence: 'low' },
          ],
        })
      )
    )

    const result = await OCRService.scanBill('base64data', 'image/jpeg')

    expect(result.merchant).toBe('Reliance Fresh')
    expect(result.billDate).toBe('2026-01-15')
    expect(result.totalAmount).toBe(50)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({ canonicalName: 'Salt', quantity: 1, unit: 'kg', price: 20, confidence: 'high' })
  })

  it('strips markdown code fences before parsing', async () => {
    mockFetchOnce(
      geminiResponse(
        '```json\n' + JSON.stringify({ items: [{ itemName: 'Milk', canonicalName: 'Milk', quantity: 1, unit: 'L', price: 25, category: 'Dairy', confidence: 'high' }] }) + '\n```'
      )
    )

    const result = await OCRService.scanBill('base64data', 'image/jpeg')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].canonicalName).toBe('Milk')
  })

  it('throws a normalized OCR_API_ERROR on HTTP 404 without retrying', async () => {
    mockFetchOnce({ ok: false, status: 404, json: async () => ({}) })

    await expect(OCRService.scanBill('base64data', 'image/jpeg')).rejects.toMatchObject({
      code: 'OCR_API_ERROR',
      message: expect.stringContaining('404'),
    })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('throws a normalized error on other non-OK HTTP statuses without retrying', async () => {
    mockFetchOnce({ ok: false, status: 500, json: async () => ({}) })

    await expect(OCRService.scanBill('base64data', 'image/jpeg')).rejects.toMatchObject({
      code: 'OCR_API_ERROR',
      message: expect.stringContaining('500'),
    })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('throws OCR_JSON_PARSE_ERROR when Gemini returns non-JSON text', async () => {
    mockFetchOnce(geminiResponse('Sorry, I cannot read this bill.'))

    await expect(OCRService.scanBill('base64data', 'image/jpeg')).rejects.toMatchObject({
      code: 'OCR_JSON_PARSE_ERROR',
    })
  })

  it('throws OCR_NO_ITEMS_FOUND when Gemini returns an empty items array', async () => {
    mockFetchOnce(geminiResponse(JSON.stringify({ merchant: null, billDate: null, totalAmount: null, items: [] })))

    await expect(OCRService.scanBill('base64data', 'image/jpeg')).rejects.toMatchObject({
      code: 'OCR_NO_ITEMS_FOUND',
    })
  })

  it('throws OCR_INVALID_INPUT when no image is provided', async () => {
    await expect(OCRService.scanBill(null, 'image/jpeg')).rejects.toMatchObject({
      code: 'OCR_INVALID_INPUT',
    })
  })

  it('throws OCR_NETWORK_ERROR when fetch rejects, without retrying', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'))

    await expect(OCRService.scanBill('base64data', 'image/jpeg')).rejects.toMatchObject({
      code: 'OCR_NETWORK_ERROR',
    })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  describe('model pool failover on transient 429/503', () => {
    // Default pool order (src/config/geminiModels.config.js): 3.7-flash, 3.6-flash, 3.5-flash,
    // flash-latest, 3.1-flash-lite. Assertions below rely on this order to know which model each
    // attempt should hit.
    const POOL_ORDER = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite']

    function okResponse() {
      return geminiResponse(
        JSON.stringify({
          items: [{ itemName: 'Salt', canonicalName: 'Salt', purchaseQuantity: 1, unit: 'kg', price: 10, category: 'Staples', confidence: 'high' }],
        })
      )
    }

    function errResponse(status, bodyObj = {}) {
      return {
        ok: false,
        status,
        headers: { get: () => null },
        text: async () => JSON.stringify(bodyObj),
        json: async () => bodyObj,
      }
    }

    function urlAt(fetchMock, i) {
      return fetchMock.mock.calls[i][0]
    }

    // A
    it('first model succeeds -> exactly one request, no fallback', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(okResponse())
      globalThis.fetch = fetchMock

      const result = await OCRService.scanBill('base64data', 'image/jpeg')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(urlAt(fetchMock, 0)).toContain(POOL_ORDER[0])
      expect(result.items).toHaveLength(1)
    })

    // B
    it('first model 503 -> second model attempted, succeeds, stops there', async () => {
      vi.useFakeTimers()
      const fetchMock = vi.fn().mockResolvedValueOnce(errResponse(503)).mockResolvedValueOnce(okResponse())
      globalThis.fetch = fetchMock

      const promise = OCRService.scanBill('base64data', 'image/jpeg')
      await vi.advanceTimersByTimeAsync(500)
      const result = await promise

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(urlAt(fetchMock, 0)).toContain(POOL_ORDER[0])
      expect(urlAt(fetchMock, 1)).toContain(POOL_ORDER[1])
      expect(result.items).toHaveLength(1)
    })

    // C
    it('first model 429 -> second model attempted, succeeds, stops there', async () => {
      vi.useFakeTimers()
      const fetchMock = vi.fn().mockResolvedValueOnce(errResponse(429)).mockResolvedValueOnce(okResponse())
      globalThis.fetch = fetchMock

      const promise = OCRService.scanBill('base64data', 'image/jpeg')
      await vi.advanceTimersByTimeAsync(500)
      const result = await promise

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(urlAt(fetchMock, 1)).toContain(POOL_ORDER[1])
      expect(result.items).toHaveLength(1)
    })

    // D
    it('first two models fail (503 then 429) -> third model attempted and succeeds', async () => {
      vi.useFakeTimers()
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(errResponse(503))
        .mockResolvedValueOnce(errResponse(429))
        .mockResolvedValueOnce(okResponse())
      globalThis.fetch = fetchMock

      const promise = OCRService.scanBill('base64data', 'image/jpeg')
      await vi.advanceTimersByTimeAsync(500)
      await vi.advanceTimersByTimeAsync(500)
      const result = await promise

      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(urlAt(fetchMock, 2)).toContain(POOL_ORDER[2])
      expect(result.items).toHaveLength(1)
    })

    // E
    it('all three bounded attempts fail -> pool-exhausted error, no fourth request', async () => {
      vi.useFakeTimers()
      const fetchMock = vi.fn().mockResolvedValue(errResponse(503))
      globalThis.fetch = fetchMock

      const assertion = expect(OCRService.scanBill('base64data', 'image/jpeg')).rejects.toMatchObject({
        code: 'OCR_MODEL_POOL_EXHAUSTED',
      })
      await vi.advanceTimersByTimeAsync(500)
      await vi.advanceTimersByTimeAsync(500)
      await assertion

      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('pool-exhausted message does not name Gemini or leak the raw status code', async () => {
      vi.useFakeTimers()
      const fetchMock = vi.fn().mockResolvedValue(errResponse(503))
      globalThis.fetch = fetchMock

      const caught = OCRService.scanBill('base64data', 'image/jpeg').catch((err) => err)
      await vi.advanceTimersByTimeAsync(500)
      await vi.advanceTimersByTimeAsync(500)
      const err = await caught

      expect(err.message).not.toMatch(/gemini/i)
      expect(err.message).not.toContain('503')
      expect(err.message.toLowerCase()).toContain('temporarily unavailable')
    })

    // F
    it('404 -> no fallback, immediate failure, single request', async () => {
      mockFetchOnce(errResponse(404))

      await expect(OCRService.scanBill('base64data', 'image/jpeg')).rejects.toMatchObject({
        code: 'OCR_API_ERROR',
        message: expect.stringContaining('404'),
      })
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })

    // G
    it('400 -> no fallback', async () => {
      mockFetchOnce(errResponse(400))

      await expect(OCRService.scanBill('base64data', 'image/jpeg')).rejects.toMatchObject({ code: 'OCR_API_ERROR' })
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })

    // H
    it('401/403 -> no fallback', async () => {
      for (const status of [401, 403]) {
        GeminiModelRouter._resetHealth()
        mockFetchOnce(errResponse(status))

        await expect(OCRService.scanBill('base64data', 'image/jpeg')).rejects.toMatchObject({ code: 'OCR_API_ERROR' })
        expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      }
    })

    // I
    it('500 -> preserves explicit non-retry policy, no silent retry or failover added', async () => {
      mockFetchOnce(errResponse(500))

      await expect(OCRService.scanBill('base64data', 'image/jpeg')).rejects.toMatchObject({
        code: 'OCR_API_ERROR',
        message: expect.stringContaining('500'),
      })
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })

    // J
    it('network error -> preserves current documented behavior: immediate throw, no retry, no failover', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'))

      await expect(OCRService.scanBill('base64data', 'image/jpeg')).rejects.toMatchObject({ code: 'OCR_NETWORK_ERROR' })
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })

    // K
    it('successful fallback preserves purchaseQuantity/packSize/unit/quantity/price/product name', async () => {
      vi.useFakeTimers()
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(errResponse(503))
        .mockResolvedValueOnce(
          geminiResponse(
            JSON.stringify({
              items: [
                {
                  itemName: 'VIM DISHWASH B-110g',
                  canonicalName: 'Dishwash Bar',
                  purchaseQuantity: 9,
                  packSize: 110,
                  unit: 'g',
                  price: 83.7,
                  category: 'Miscellaneous',
                  confidence: 'high',
                },
              ],
            })
          )
        )
      globalThis.fetch = fetchMock

      const promise = OCRService.scanBill('base64data', 'image/jpeg')
      await vi.advanceTimersByTimeAsync(500)
      const result = await promise

      expect(result.items[0]).toMatchObject({
        itemName: 'VIM DISHWASH B-110g',
        purchaseQuantity: 9,
        packSize: 110,
        quantity: 990,
        unit: 'g',
        price: 83.7,
      })
    })

    // L
    it('a model that just failed is not immediately re-selected on the next scan within its cooldown', async () => {
      vi.useFakeTimers()
      let fetchMock = vi.fn().mockResolvedValueOnce(errResponse(503)).mockResolvedValueOnce(okResponse())
      globalThis.fetch = fetchMock

      let promise = OCRService.scanBill('base64data', 'image/jpeg')
      await vi.advanceTimersByTimeAsync(500)
      await promise
      expect(GeminiModelRouter.isInCooldown(POOL_ORDER[0])).toBe(true)

      // A second, separate bill scan started immediately after should skip the still-cooling-down
      // first model and go straight to the next eligible one.
      fetchMock = vi.fn().mockResolvedValueOnce(okResponse())
      globalThis.fetch = fetchMock
      const result = await OCRService.scanBill('base64data', 'image/jpeg')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(urlAt(fetchMock, 0)).toContain(POOL_ORDER[1])
      expect(result.items).toHaveLength(1)
    })

    // M
    it('429 with a server-provided retryDelay drives cooldown length, not the default backoff', async () => {
      vi.useFakeTimers()
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          errResponse(429, {
            error: {
              code: 429,
              message: 'rate limited',
              details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '2s' }],
            },
          })
        )
        .mockResolvedValueOnce(okResponse())
      globalThis.fetch = fetchMock

      const promise = OCRService.scanBill('base64data', 'image/jpeg')
      await vi.advanceTimersByTimeAsync(500)
      await promise

      const snapshot = GeminiModelRouter.getHealthSnapshot(POOL_ORDER[0])
      expect(snapshot.lastStatus).toBe(429)
      expect(snapshot.cooldownUntil - snapshot.lastFailureAt).toBe(2000)
    })

    // N
    it('never exceeds MAX_TOTAL_ATTEMPTS even though more eligible models remain in the pool', async () => {
      vi.useFakeTimers()
      const fetchMock = vi.fn().mockResolvedValue(errResponse(503))
      globalThis.fetch = fetchMock

      const assertion = expect(OCRService.scanBill('base64data', 'image/jpeg')).rejects.toMatchObject({
        code: 'OCR_MODEL_POOL_EXHAUSTED',
      })
      await vi.advanceTimersByTimeAsync(500)
      await vi.advanceTimersByTimeAsync(500)
      await assertion

      // pool has 5 models but only 3 attempts should ever be made for one OCR operation
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })
  })

  // Fixture values below are taken directly from a live OCR pass over the actual uploaded
  // bill.jpeg regression reference (not invented) — confirming the real bug this contract fixes:
  // pre-fix, every item with a pack size embedded in its printed name (e.g. "-5lt", "-110g")
  // collapsed to quantity:1 (or the receipt's raw purchase count) with the pack size silently
  // dropped, while genuinely loose/weighed items (no printed pack size) were already correct.
  describe('purchase quantity vs. pack size (bill.jpeg regression fixture)', () => {
    function billItem(overrides) {
      return {
        itemName: 'placeholder',
        canonicalName: 'placeholder',
        category: 'Staples',
        confidence: 'high',
        ...overrides,
      }
    }

    it('TATA MUSTARD OIL-5lt: 1 bottle of 5L -> total 5 L, not 1 L', async () => {
      mockFetchOnce(
        geminiResponse(
          JSON.stringify({
            items: [
              billItem({
                itemName: 'TATA MUSTARD OI-5lt',
                canonicalName: 'Mustard Oil',
                purchaseQuantity: 1,
                packSize: 5,
                unit: 'l',
                price: 999,
              }),
            ],
          })
        )
      )

      const result = await OCRService.scanBill('base64data', 'image/jpeg')
      expect(result.items[0]).toMatchObject({
        purchaseQuantity: 1,
        packSize: 5,
        quantity: 5,
        unit: 'l',
      })
    })

    it('SAFFOLA ACTI-4.18kg: 1 pack of 4.18kg -> total 4.18 kg, not 1 kg', async () => {
      mockFetchOnce(
        geminiResponse(
          JSON.stringify({
            items: [
              billItem({
                itemName: 'SAFFOLA ACTI-4.18kg',
                canonicalName: 'Cooking Oil',
                purchaseQuantity: 1,
                packSize: 4.18,
                unit: 'kg',
                price: 875,
              }),
            ],
          })
        )
      )

      const result = await OCRService.scanBill('base64data', 'image/jpeg')
      expect(result.items[0]).toMatchObject({
        purchaseQuantity: 1,
        packSize: 4.18,
        quantity: 4.18,
        unit: 'kg',
      })
    })

    it('TATA TEA GOLD-250g: 1 pack of 250g -> total 250 g, not 1 pcs', async () => {
      mockFetchOnce(
        geminiResponse(
          JSON.stringify({
            items: [
              billItem({
                itemName: 'TATA TEA GOLD-250g',
                canonicalName: 'Tea Leaves',
                purchaseQuantity: 1,
                packSize: 250,
                unit: 'g',
                price: 129.36,
              }),
            ],
          })
        )
      )

      const result = await OCRService.scanBill('base64data', 'image/jpeg')
      expect(result.items[0]).toMatchObject({
        purchaseQuantity: 1,
        packSize: 250,
        quantity: 250,
        unit: 'g',
      })
    })

    it('MAAZA MANGO-1200ml: 1 bottle of 1200ml -> total 1200 ml, not 1 pcs', async () => {
      mockFetchOnce(
        geminiResponse(
          JSON.stringify({
            items: [
              billItem({
                itemName: 'MAAZA MANGO -1200ml',
                canonicalName: 'Mango Juice',
                purchaseQuantity: 1,
                packSize: 1200,
                unit: 'ml',
                price: 61,
              }),
            ],
          })
        )
      )

      const result = await OCRService.scanBill('base64data', 'image/jpeg')
      expect(result.items[0]).toMatchObject({
        purchaseQuantity: 1,
        packSize: 1200,
        quantity: 1200,
        unit: 'ml',
      })
    })

    it('L SRI KHURNOOL RICE: loose/weighed item -> purchaseQuantity is the total, packSize null', async () => {
      mockFetchOnce(
        geminiResponse(
          JSON.stringify({
            items: [
              billItem({
                itemName: 'L SM KURNOOL RICE',
                canonicalName: 'Rice',
                purchaseQuantity: 5.036,
                packSize: null,
                unit: 'kg',
                price: 327.34,
              }),
            ],
          })
        )
      )

      const result = await OCRService.scanBill('base64data', 'image/jpeg')
      expect(result.items[0]).toMatchObject({
        purchaseQuantity: 5.036,
        packSize: null,
        quantity: 5.036,
        unit: 'kg',
      })
    })

    it('VIM DISHWASH B-110g x9: 9 packs of 110g -> total 990 g, not 9 pcs or 110 g', async () => {
      mockFetchOnce(
        geminiResponse(
          JSON.stringify({
            items: [
              billItem({
                itemName: 'VIM DISHWASH B-110g',
                canonicalName: 'Dishwash Bar',
                purchaseQuantity: 9,
                packSize: 110,
                unit: 'g',
                price: 83.7,
              }),
            ],
          })
        )
      )

      const result = await OCRService.scanBill('base64data', 'image/jpeg')
      expect(result.items[0]).toMatchObject({
        purchaseQuantity: 9,
        packSize: 110,
        quantity: 990,
        unit: 'g',
      })
    })

    it('treats packSize omitted entirely the same as packSize: null (loose item, no pack info)', async () => {
      mockFetchOnce(
        geminiResponse(
          JSON.stringify({
            items: [billItem({ itemName: 'LOOSE ONION', canonicalName: 'Onion', purchaseQuantity: 2.5, unit: 'kg', price: 80 })],
          })
        )
      )

      const result = await OCRService.scanBill('base64data', 'image/jpeg')
      expect(result.items[0]).toMatchObject({
        purchaseQuantity: 2.5,
        packSize: null,
        quantity: 2.5,
        unit: 'kg',
      })
    })

    it('treats packSize: 0 as no pack size (guards against division/multiplication by a bogus zero)', async () => {
      mockFetchOnce(
        geminiResponse(
          JSON.stringify({
            items: [billItem({ itemName: 'EDGE CASE', canonicalName: 'Edge Case', purchaseQuantity: 3, packSize: 0, unit: 'kg', price: 10 })],
          })
        )
      )

      const result = await OCRService.scanBill('base64data', 'image/jpeg')
      expect(result.items[0]).toMatchObject({
        purchaseQuantity: 3,
        packSize: null,
        quantity: 3,
        unit: 'kg',
      })
    })

    it('remains backward compatible with legacy payloads that only send a flat quantity (no purchaseQuantity/packSize)', async () => {
      mockFetchOnce(
        geminiResponse(
          JSON.stringify({
            items: [{ itemName: 'Legacy Salt', canonicalName: 'Salt', quantity: 1, unit: 'kg', price: 20, category: 'Staples', confidence: 'high' }],
          })
        )
      )

      const result = await OCRService.scanBill('base64data', 'image/jpeg')
      expect(result.items[0]).toMatchObject({
        purchaseQuantity: 1,
        packSize: null,
        quantity: 1,
        unit: 'kg',
      })
    })
  })
})
