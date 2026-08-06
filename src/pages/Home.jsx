import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'

const QUICK_ACTIONS = [
  { label: 'Scan a Bill',    emoji: '📄', path: '/scan'      },
  { label: 'View Inventory', emoji: '🧺', path: '/inventory' },
  { label: "Today's Meals",  emoji: '🍽️', path: '/meals'     },
  { label: 'Budget',         emoji: '💰', path: '/budget'    },
]

const TODAY = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

export default function Home() {
  const navigate = useNavigate()
  const { household_id } = useAuthStore()

  const [householdName,   setHouseholdName]   = useState('')
  const [tiffinDefault,   setTiffinDefault]   = useState(null)   // 'none'|'1box'|'2boxes'|'varies'|null
  const [tiffinDecision,  setTiffinDecision]  = useState(null)   // null = undecided, 'planned'|'skipped'
  const [savingTiffin,    setSavingTiffin]    = useState(false)

  // ── fetch household name + preferences ──────────────────
  useEffect(() => {
    if (!household_id) return

    supabase
      .from('household')
      .select('name')
      .eq('id', household_id)
      .single()
      .then(({ data }) => { if (data) setHouseholdName(data.name) })

    supabase
      .from('preferences')
      .select('tiffin_default')
      .eq('household_id', household_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setTiffinDefault(data.tiffin_default ?? 'none')
      })
  }, [household_id])

  // ── check if today's tiffin has already been decided ────
  useEffect(() => {
    if (!household_id || tiffinDefault === null || tiffinDefault === 'none') return

    supabase
      .from('meal_log')
      .select('status')
      .eq('household_id', household_id)
      .eq('meal_type', 'tiffin')
      .eq('date', TODAY)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setTiffinDecision(data.status)
      })
  }, [household_id, tiffinDefault])

  // ── write tiffin decision to meal_log ───────────────────
  async function decideTiffin(choice) {
    // choice: '1box' | '2boxes' | 'skip'
    setSavingTiffin(true)
    const status = choice === 'skip' ? 'skipped' : 'planned'
    const notes  = choice === 'skip' ? null : choice

    await supabase.from('meal_log').insert({
      household_id,
      date: TODAY,
      meal_type: 'tiffin',
      headcount: 1,
      status,
      notes,
    })

    setTiffinDecision(status)
    setSavingTiffin(false)

    if (status === 'planned') {
      navigate('/meals')   // tiffin suggestion screen (Phase 4 placeholder)
    }
  }

  const showTiffinCard = tiffinDefault && tiffinDefault !== 'none' && tiffinDecision === null

  return (
    <div className="min-h-screen bg-[#F5F7FA] px-4 pt-12 pb-8 max-w-md mx-auto">

      {/* Greeting */}
      <div className="mb-6">
        <p className="text-sm text-[#2E86AB] font-semibold uppercase tracking-wide mb-1">
          Welcome back
        </p>
        <h1 className="text-2xl font-bold text-[#1E3A5F] leading-snug">
          {householdName || 'Your Kitchen'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          What would you like to do today?
        </p>
      </div>

      {/* ── Tiffin card ──────────────────────────────────── */}
      {showTiffinCard && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🍱</span>
            <h2 className="text-base font-bold text-[#1E3A5F]">Tiffin today?</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">Decide now so we can plan ingredients</p>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => decideTiffin('2boxes')}
              disabled={savingTiffin}
              className="h-12 rounded-xl border-2 border-[#2E86AB] text-[#2E86AB] font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
            >
              Yes — 2 boxes
            </button>
            <button
              onClick={() => decideTiffin('1box')}
              disabled={savingTiffin}
              className="h-12 rounded-xl border-2 border-[#2E86AB] text-[#2E86AB] font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
            >
              Yes — 1 box
            </button>
            <button
              onClick={() => decideTiffin('skip')}
              disabled={savingTiffin}
              className="h-12 rounded-xl bg-gray-100 text-gray-500 font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
            >
              No tiffin today
            </button>
          </div>
        </div>
      )}

      {/* ── Quick actions ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.path}
            onClick={() => navigate(action.path)}
            className="bg-white rounded-2xl shadow-sm p-5 text-left border border-gray-100 active:scale-95 transition-transform"
          >
            <div className="text-3xl mb-3">{action.emoji}</div>
            <p className="text-sm font-semibold text-[#1E3A5F]">{action.label}</p>
          </button>
        ))}
      </div>

    </div>
  )
}
