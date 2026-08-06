import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBillProcessing } from '@/hooks/useBillProcessing'

const CATEGORIES = ['Staples', 'Fresh & Vegetables', 'Non-Veg', 'Dairy', 'Spices', 'Miscellaneous']
const UNITS = ['g', 'kg', 'ml', 'L', 'pcs']
const TODAY = new Date().toISOString().slice(0, 10)

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = reader.result.split(',')[1]
      resolve(b64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function uid() {
  return Math.random().toString(36).slice(2)
}

export default function ScanBill() {
  const navigate = useNavigate()
  const { processBill, isProcessing, error: processError } = useBillProcessing()

  const cameraRef = useRef()
  const galleryRef = useRef()

  const [phase, setPhase] = useState('upload') // upload | preview | scanning | review | ready_preview | error
  const [previewUrl, setPreviewUrl] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const [imageMime, setImageMime] = useState('image/jpeg')
  const [errorMsg, setErrorMsg] = useState('')

  // ── Local Editable State for Bill & Items ───────────────────
  const [merchant, setMerchant] = useState('')
  const [billDate, setBillDate] = useState(TODAY)
  const [totalAmount, setTotalAmount] = useState('')
  const [items, setItems] = useState([]) // Array of items with ocr, match, userEdits, status

  // ── Image Selection Handler ──────────────────────────────────
  const handleFileSelected = useCallback(async (file) => {
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
    const b64 = await fileToBase64(file)
    setImageBase64(b64)
    setImageMime(file.type || 'image/jpeg')
    setPhase('preview')
  }, [])

  // ── Trigger Bill Processing Pipeline ────────────────────────
  async function handleScan() {
    setPhase('scanning')
    setErrorMsg('')
    try {
      const result = await processBill(imageBase64, imageMime)

      setMerchant(result.merchant || '')
      setBillDate(result.billDate || TODAY)
      setTotalAmount(result.totalAmount !== null ? String(result.totalAmount) : '')

      const initializedItems = (result.items || []).map((item) => ({
        id: uid(),
        ocr: item.ocr,
        match: item.match,
        userEdits: {
          itemName: item.ocr.itemName,
          canonicalName: item.match.canonicalName,
          category: item.match.category,
          quantity: item.ocr.quantity,
          unit: item.ocr.unit,
          price: item.ocr.price !== null ? String(item.ocr.price) : '',
        },
        status: item.match.requiresManualReview ? 'pending' : 'confirmed',
      }))

      setItems(initializedItems)
      setPhase('review')
    } catch (err) {
      setErrorMsg(err.message || 'Could not process this bill. Please try again.')
      setPhase('error')
    }
  }

  // ── Local Item Edits ─────────────────────────────────────────
  function updateItemField(id, field, value) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, userEdits: { ...i.userEdits, [field]: value } } : i
      )
    )
  }

  function confirmItem(id) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'confirmed' } : i))
    )
  }

  function removeItem(id) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'removed' } : i))
    )
  }

  // ── Active Item Computations ─────────────────────────────────
  const activeItems = items.filter((i) => i.status !== 'removed')
  const pendingReviewItems = activeItems.filter((i) => i.status === 'pending')

  // ═════════════════════════════════════════════════════════════
  // RENDER PHASES
  // ═════════════════════════════════════════════════════════════

  // ── Error Phase ──────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">📸</div>
          <h2 className="text-lg font-bold text-[#1E3A5F] mb-2">
            Could not process bill
          </h2>
          <p className="text-gray-500 text-sm mb-6">{errorMsg || processError?.message}</p>
          <button
            onClick={() => {
              setPhase('upload')
              setPreviewUrl(null)
              setImageBase64(null)
            }}
            className="w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold active:scale-95 transition-transform"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── Processing Spinner ───────────────────────────────────────
  if (phase === 'scanning' || isProcessing) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2E86AB] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#1E3A5F] font-medium">Processing bill through AI pipeline…</p>
          <p className="text-gray-400 text-sm mt-1">Running OCR & Ingredient Alias Matching</p>
        </div>
      </div>
    )
  }

  // ── Ready Preview (Local State Simulation - No DB Persistence)
  if (phase === 'ready_preview') {
    return (
      <div className="min-h-screen bg-[#F5F7FA] px-4 pt-8 pb-24 max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔍</div>
          <h1 className="text-xl font-bold text-[#1E3A5F]">Review Complete</h1>
          <p className="text-xs text-gray-500 mt-1">
            All edits saved in local React state. (Persistence deferred to Phase 3G).
          </p>
        </div>

        {/* Bill Summary Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase">Merchant</span>
            <span className="text-sm font-semibold text-[#1E3A5F]">{merchant || 'Not set'}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase">Date</span>
            <span className="text-sm text-gray-600">{billDate}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase">Total Amount</span>
            <span className="text-base font-bold text-[#2E86AB]">
              {totalAmount ? `₹${totalAmount}` : 'Unspecified'}
            </span>
          </div>
        </div>

        {/* Items List Preview */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
            Items Ready for Kitchen ({activeItems.length})
          </h2>
          <div className="divide-y divide-gray-100">
            {activeItems.map((item) => (
              <div key={item.id} className="py-2.5 flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold text-[#1E3A5F]">{item.userEdits.canonicalName}</p>
                  <p className="text-xs text-gray-400">
                    Bill text: "{item.ocr.itemName}" · {item.userEdits.quantity} {item.userEdits.unit}
                  </p>
                </div>
                <span className="text-xs font-bold text-[#2E86AB]">
                  {item.userEdits.price ? `₹${item.userEdits.price}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setPhase('review')}
          className="w-full h-12 rounded-xl border-2 border-[#1E3A5F] text-[#1E3A5F] font-semibold text-sm mb-3"
        >
          ← Back to Edit
        </button>
        <button
          onClick={() => navigate('/inventory')}
          className="w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold text-sm active:scale-95 transition-transform"
        >
          Done (Return to Inventory)
        </button>
      </div>
    )
  }

  // ── Review & Edit Phase ──────────────────────────────────────
  if (phase === 'review') {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col max-w-md mx-auto">
        <div className="px-4 pt-8 pb-3 flex-shrink-0">
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Review Scanned Bill</h1>
          <p className="text-gray-500 text-xs mt-1">
            Review OCR extractions and edit matched ingredients before finalizing
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-4">
          {/* Header Metadata Section */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Receipt Details</h2>
            
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Merchant / Store</label>
              <input
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="e.g. Reliance Fresh"
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Date</label>
                <input
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Total (₹)</label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
                />
              </div>
            </div>
          </div>

          {/* Pending Review Section */}
          {pendingReviewItems.length > 0 && (
            <div>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <span>⚠️</span> Requires Review ({pendingReviewItems.length})
              </p>
              <div className="space-y-3">
                {pendingReviewItems.map((item) => (
                  <div key={item.id} className="bg-amber-50/50 border-2 border-amber-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-xs text-amber-800 font-semibold">Read from bill:</p>
                        <p className="text-sm font-bold text-[#1E3A5F]">"{item.ocr.itemName}"</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                        {item.match.confidence} MATCH
                      </span>
                    </div>

                    <div className="space-y-2 mt-3">
                      <div>
                        <label className="text-[11px] font-medium text-gray-600 block">Matched Ingredient</label>
                        <input
                          type="text"
                          value={item.userEdits.canonicalName}
                          onChange={(e) => updateItemField(item.id, 'canonicalName', e.target.value)}
                          className="w-full h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-500 block">Qty</label>
                          <input
                            type="number"
                            value={item.userEdits.quantity}
                            onChange={(e) => updateItemField(item.id, 'quantity', e.target.value)}
                            className="w-full h-8 px-2 rounded-lg border border-gray-200 bg-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block">Unit</label>
                          <select
                            value={item.userEdits.unit}
                            onChange={(e) => updateItemField(item.id, 'unit', e.target.value)}
                            className="w-full h-8 px-1 rounded-lg border border-gray-200 bg-white text-xs"
                          >
                            {UNITS.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block">Price (₹)</label>
                          <input
                            type="number"
                            value={item.userEdits.price}
                            onChange={(e) => updateItemField(item.id, 'price', e.target.value)}
                            placeholder="0"
                            className="w-full h-8 px-2 rounded-lg border border-gray-200 bg-white text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-500 block">Category</label>
                        <select
                          value={item.userEdits.category}
                          onChange={(e) => updateItemField(item.id, 'category', e.target.value)}
                          className="w-full h-8 px-2 rounded-lg border border-gray-200 bg-white text-xs"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3 pt-2 border-t border-amber-200/50">
                      <button
                        onClick={() => confirmItem(item.id)}
                        className="flex-1 h-9 rounded-xl bg-green-600 text-white text-xs font-semibold active:scale-95 transition-transform"
                      >
                        ✓ Confirm
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="h-9 px-3 rounded-xl border border-red-200 text-red-600 text-xs font-semibold active:scale-95 transition-transform"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auto-Confirmed Items Section */}
          {activeItems.filter((i) => i.status === 'confirmed').length > 0 && (
            <div>
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                <span>✓</span> Auto-Confirmed ({activeItems.filter((i) => i.status === 'confirmed').length})
              </p>
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {activeItems
                  .filter((i) => i.status === 'confirmed')
                  .map((item) => (
                    <div key={item.id} className="p-3 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-[#1E3A5F]">{item.userEdits.canonicalName}</p>
                        <p className="text-[11px] text-gray-400">
                          Raw: "{item.ocr.itemName}" · {item.userEdits.quantity} {item.userEdits.unit}
                          {item.userEdits.price ? ` · ₹${item.userEdits.price}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-xs text-red-500 font-medium px-2 py-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Review Action Bar */}
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-[#F5F7FA] pt-4 max-w-md mx-auto">
          <button
            onClick={() => setPhase('ready_preview')}
            disabled={pendingReviewItems.length > 0}
            className="w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold disabled:opacity-40 active:scale-95 transition-transform text-sm"
          >
            {pendingReviewItems.length > 0
              ? `Please review ${pendingReviewItems.length} pending item${pendingReviewItems.length > 1 ? 's' : ''}`
              : `Review Complete (${activeItems.length} items)`}
          </button>
        </div>
      </div>
    )
  }

  // ── Upload / Photo Selection Phase ─────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F7FA] px-4 pt-10 pb-24 max-w-md mx-auto flex flex-col">
      <h1 className="text-2xl font-bold text-[#1E3A5F] mb-1">Scan a bill</h1>
      <p className="text-gray-500 text-sm mb-6">
        Take a photo of your grocery bill — AI will extract and match ingredients
      </p>

      {/* Image Preview */}
      {previewUrl && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4 flex-shrink-0">
          <img src={previewUrl} alt="Bill preview" className="w-full max-h-72 object-contain" />
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelected(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelected(e.target.files?.[0])}
      />

      {/* Action Buttons */}
      {!previewUrl ? (
        <div className="flex flex-col gap-3 mt-auto">
          <button
            onClick={() => cameraRef.current?.click()}
            className="w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold flex items-center justify-center gap-3 active:scale-95 transition-transform"
          >
            <span className="text-xl">📷</span> Take a photo
          </button>
          <button
            onClick={() => galleryRef.current?.click()}
            className="w-full h-14 rounded-xl border-2 border-[#1E3A5F] text-[#1E3A5F] font-semibold flex items-center justify-center gap-3 active:scale-95 transition-transform"
          >
            <span className="text-xl">🖼</span> Choose from gallery
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mt-auto">
          <button
            onClick={handleScan}
            className="w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold active:scale-95 transition-transform"
          >
            Read this bill →
          </button>
          <button
            onClick={() => {
              setPreviewUrl(null)
              setImageBase64(null)
              setPhase('upload')
            }}
            className="w-full h-12 rounded-xl border-2 border-gray-200 text-gray-500 font-medium text-sm active:scale-95 transition-transform"
          >
            Choose a different photo
          </button>
        </div>
      )}
    </div>
  )
}
