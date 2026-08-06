import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBillProcessing } from '../hooks/useBillProcessing.js'
import { useHousehold } from '../hooks/useHousehold.js'
import { BillPersistenceService } from '../services/BillPersistenceService.js'

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
  const { household } = useHousehold()

  const cameraRef = useRef()
  const galleryRef = useRef()

  const [phase, setPhase] = useState('upload') // upload | preview | scanning | review | confirm_persistence | success | error | commit_error
  const [previewUrl, setPreviewUrl] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const [imageMime, setImageMime] = useState('image/jpeg')
  const [errorMsg, setErrorMsg] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [commitSummary, setCommitSummary] = useState(null)

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

  // ── Handle Confirm & Save to Persistence Engine ──────────────
  async function handleConfirmAndSave() {
    setErrorMsg('')
    if (!household?.id) {
      // Fail loudly and visibly instead of silently committing against a shared placeholder
      // household — that would corrupt bill/inventory data for whatever real household (if
      // any) happens to own that fixed UUID.
      setErrorMsg('No household found for your account. Please complete household setup before saving a bill.')
      setPhase('commit_error')
      return
    }
    setIsCommitting(true)
    try {
      const summary = await BillPersistenceService.commitBill(household.id, {
        merchant,
        billDate,
        totalAmount,
        items,
      })
      setCommitSummary(summary)
      setPhase('success')
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save bill to kitchen inventory')
      setPhase('commit_error')
    } finally {
      setIsCommitting(false)
    }
  }

  // ── Active Item Computations ─────────────────────────────────
  const activeItems = items.filter((i) => i.status !== 'removed')
  const pendingReviewItems = activeItems.filter((i) => i.status === 'pending')

  // ═════════════════════════════════════════════════════════════
  // RENDER PHASES
  // ═════════════════════════════════════════════════════════════

  // ── Success Phase ────────────────────────────────────────────
  if (phase === 'success' && commitSummary) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
            ✓
          </div>
          <h2 className="text-xl font-bold text-[#1E3A5F] mb-1">Bill Saved to Kitchen!</h2>
          <p className="text-gray-500 text-xs mb-6">
            Inventory updated atomically. Transaction audit & batches created.
          </p>

          <div className="bg-gray-50 rounded-2xl p-4 text-left text-xs mb-6 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Commit ID:</span>
              <span className="font-mono text-gray-700">{commitSummary.commitId?.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Items Processed:</span>
              <span className="font-bold text-[#1E3A5F]">{commitSummary.metrics?.billItemsCreated} items</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Inventory Updated:</span>
              <span className="font-bold text-[#1E3A5F]">{commitSummary.metrics?.inventoryUpdated} ingredients</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span className="text-green-600 font-semibold">{commitSummary.isDuplicate ? 'Duplicate Repersisted' : 'Committed (ACID)'}</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/inventory')}
            className="w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold active:scale-95 transition-transform"
          >
            View Updated Inventory →
          </button>
        </div>
      </div>
    )
  }

  // ── Persistence Error Phase ─────────────────────────────────
  if (phase === 'commit_error' || phase === 'error') {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-[#1E3A5F] mb-2">
            {phase === 'commit_error' ? 'Persistence Failed' : 'Could not process bill'}
          </h2>
          <p className="text-gray-500 text-sm mb-6">{errorMsg || processError?.message}</p>
          <button
            onClick={() => {
              if (phase === 'commit_error') {
                setPhase('confirm_persistence')
              } else {
                setPhase('upload')
                setPreviewUrl(null)
                setImageBase64(null)
              }
            }}
            className="w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold active:scale-95 transition-transform mb-3"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── Processing Spinner ───────────────────────────────────────
  if (phase === 'scanning' || isProcessing || isCommitting) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2E86AB] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#1E3A5F] font-medium">
            {isCommitting ? 'Committing bill to kitchen inventory…' : 'Processing bill through AI pipeline…'}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {isCommitting ? 'Executing atomic PostgreSQL transaction' : 'Running OCR & Ingredient Alias Matching'}
          </p>
        </div>
      </div>
    )
  }

  // ── Confirm Persistence Final Review ─────────────────────────
  if (phase === 'confirm_persistence') {
    return (
      <div className="min-h-screen bg-[#F5F7FA] px-4 pt-10 pb-24 max-w-md mx-auto">
        <h1 className="text-xl font-bold text-[#1E3A5F] mb-1">Confirm Kitchen Entry</h1>
        <p className="text-xs text-gray-500 mb-6">Review final summary before updating inventory</p>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 space-y-3 text-xs">
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-400">Store / Merchant:</span>
            <span className="font-bold text-[#1E3A5F]">{merchant || 'Direct Scan'}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-400">Bill Date:</span>
            <span className="font-semibold text-gray-700">{billDate}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-400">Total Amount:</span>
            <span className="font-bold text-gray-800">{totalAmount ? `₹${totalAmount}` : 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Active Line Items:</span>
            <span className="font-bold text-green-700">{activeItems.length} items</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-6">
          <p className="text-xs font-bold text-[#1E3A5F] mb-3">Items to be Added/Updated:</p>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {activeItems.map((item) => (
              <div key={item.id} className="flex justify-between text-xs py-1 border-b border-gray-50">
                <span className="font-medium text-gray-800">{item.userEdits.canonicalName}</span>
                <span className="text-gray-500">{item.userEdits.quantity} {item.userEdits.unit}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleConfirmAndSave}
            disabled={isCommitting}
            className="w-full h-14 rounded-xl bg-green-700 text-white font-semibold active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <span>✓</span> Save & Update Inventory
          </button>
          <button
            onClick={() => setPhase('review')}
            className="w-full h-12 rounded-xl border border-gray-200 text-gray-600 font-medium text-xs"
          >
            ← Back to Item Review
          </button>
        </div>
      </div>
    )
  }

  // ── Item Review Phase ───────────────────────────────────────
  if (phase === 'review') {
    return (
      <div className="min-h-screen bg-[#F5F7FA] px-4 pt-8 pb-32 max-w-md mx-auto">
        <h1 className="text-xl font-bold text-[#1E3A5F] mb-1">Review Scanned Items</h1>
        <p className="text-xs text-gray-500 mb-4">
          Verify ingredient names, quantities, and units before saving
        </p>

        {/* Receipt Level Fields */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 space-y-3">
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase">Merchant / Store</label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="e.g. Reliance Fresh"
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-[#1E3A5F] font-medium"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase">Bill Date</label>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-gray-700"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase">Total (₹)</label>
              <input
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-gray-700 font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Pending Items */}
        {pendingReviewItems.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1">
              <span>⚠️</span> Needs Review ({pendingReviewItems.length})
            </p>
            <div className="space-y-3">
              {pendingReviewItems.map((item) => (
                <div key={item.id} className="bg-amber-50/60 rounded-2xl p-3 border border-amber-200">
                  <p className="text-[11px] text-amber-800 font-semibold mb-2">Scanned: "{item.ocr.itemName}"</p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={item.userEdits.canonicalName}
                      onChange={(e) => updateItemField(item.id, 'canonicalName', e.target.value)}
                      placeholder="Canonical ingredient name"
                      className="w-full h-9 px-3 rounded-xl border border-amber-300 text-xs font-bold text-[#1E3A5F] bg-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={item.userEdits.quantity}
                        onChange={(e) => updateItemField(item.id, 'quantity', e.target.value)}
                        className="h-9 px-2 rounded-xl border border-amber-300 text-xs bg-white"
                      />
                      <select
                        value={item.userEdits.unit}
                        onChange={(e) => updateItemField(item.id, 'unit', e.target.value)}
                        className="h-9 px-2 rounded-xl border border-amber-300 text-xs bg-white"
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3 pt-2 border-t border-amber-200/50">
                    <button
                      onClick={() => confirmItem(item.id)}
                      className="flex-1 h-9 rounded-xl bg-green-600 text-white text-xs font-semibold"
                    >
                      ✓ Confirm
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="h-9 px-3 rounded-xl border border-red-200 text-red-600 text-xs font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirmed Items */}
        {activeItems.filter((i) => i.status === 'confirmed').length > 0 && (
          <div>
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">
              ✓ Confirmed ({activeItems.filter((i) => i.status === 'confirmed').length})
            </p>
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
              {activeItems
                .filter((i) => i.status === 'confirmed')
                .map((item) => (
                  <div key={item.id} className="p-3 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-[#1E3A5F]">{item.userEdits.canonicalName}</p>
                      <p className="text-[11px] text-gray-400">
                        {item.userEdits.quantity} {item.userEdits.unit} {item.userEdits.price ? `· ₹${item.userEdits.price}` : ''}
                      </p>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-xs text-red-500 px-2 py-1">✕</button>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="fixed bottom-16 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-[#F5F7FA] pt-4 max-w-md mx-auto">
          <button
            onClick={() => setPhase('confirm_persistence')}
            disabled={pendingReviewItems.length > 0}
            className="w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold disabled:opacity-40 active:scale-95 transition-transform text-sm"
          >
            {pendingReviewItems.length > 0
              ? `Please review ${pendingReviewItems.length} pending item${pendingReviewItems.length > 1 ? 's' : ''}`
              : `Review Complete (${activeItems.length} items) →`}
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
