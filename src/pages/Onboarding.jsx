import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HouseholdService } from '../services/HouseholdService'
import useAuthStore from '../store/authStore'

import StepHouseholdName from '../components/onboarding/StepHouseholdName'
import StepMembers       from '../components/onboarding/StepMembers'
import StepBreakfast     from '../components/onboarding/StepBreakfast'
import StepDal           from '../components/onboarding/StepDal'
import StepExcludeVeg    from '../components/onboarding/StepExcludeVeg'
import StepNonVeg        from '../components/onboarding/StepNonVeg'
import StepFasting       from '../components/onboarding/StepFasting'
import StepTiffin        from '../components/onboarding/StepTiffin'

const TOTAL_STEPS = 8

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, setHouseholdId } = useAuthStore()

  const [step, setSte] = useState(1)
  const setStep = setSte

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // ── per-step state ────────────────────────────────────────
  const [householdName, setHouseholdName] = useState('')
  const [members,       setMembers]       = useState({ adults: 2, children: 0, rotiPerAdult: 3 })
  const [breakfast,     setBreakfast]     = useState([])
  const [customBreakfast, setCustomBreakfast] = useState([])
  const [dalOrder,      setDalOrder]      = useState([])
  const [excludedVeg,   setExcludedVeg]   = useState([])
  const [nonVeg,        setNonVeg]        = useState({ eatsNonVeg: null, days: [] })
  const [fasting,       setFasting]       = useState([])
  const [tiffin,        setTiffin]        = useState({ tiffinDefault: null, box1: [], box2: [], requiresSambhar: false })
  const [customTiffin,  setCustomTiffin]  = useState([])

  function next() { setStep((s) => Math.min(s + 1, TOTAL_STEPS)) }
  function back() { setStep((s) => Math.max(s - 1, 1)) }

  // ── save custom breakfast item (saved to DB after household exists) ──
  function addCustomBreakfast(name) {
    if (!customBreakfast.includes(name)) setCustomBreakfast((p) => [...p, name])
  }
  function addCustomTiffin(name) {
    if (!customTiffin.includes(name)) setCustomTiffin((p) => [...p, name])
  }

  // ── final save ──────────────────────────────────────────
  async function handleFinish() {
    setSaving(true)
    setError('')
    try {
      const { household } = await HouseholdService.createHouseholdWithMembersAndPreferences({
        userId: user.id,
        householdName,
        members,
        breakfast,
        customBreakfast,
        dalOrder,
        excludedVeg,
        nonVeg,
        fasting,
        tiffin,
        customTiffin,
      })

      setHouseholdId(household.id)
      navigate('/', { replace: true })
    } catch (err) {
      console.error(err)
      setError('Something went wrong saving your preferences. Please try again.')
      setSaving(false)
    }
  }

  if (saving) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2E86AB] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#1E3A5F] font-medium">Setting up your kitchen…</p>
          <p className="text-gray-400 text-sm mt-1">This only takes a second</p>
        </div>
      </div>
    )
  }

  const progress = (step / TOTAL_STEPS) * 100

  const stepComponents = {
    1: (
      <StepHouseholdName
        value={householdName}
        onChange={setHouseholdName}
        onNext={next}
      />
    ),
    2: (
      <StepMembers
        value={members}
        onChange={setMembers}
        onNext={next}
      />
    ),
    3: (
      <StepBreakfast
        value={breakfast}
        onChange={setBreakfast}
        customItems={customBreakfast}
        onAddCustom={addCustomBreakfast}
        onNext={next}
      />
    ),
    4: (
      <StepDal
        value={dalOrder}
        onChange={setDalOrder}
        onNext={next}
      />
    ),
    5: (
      <StepExcludeVeg
        value={excludedVeg}
        onChange={setExcludedVeg}
        onNext={next}
      />
    ),
    6: (
      <StepNonVeg
        value={nonVeg}
        onChange={setNonVeg}
        onNext={next}
      />
    ),
    7: (
      <StepFasting
        value={fasting}
        onChange={setFasting}
        onNext={next}
      />
    ),
    8: (
      <StepTiffin
        value={tiffin}
        onChange={setTiffin}
        customItems={customTiffin}
        onAddCustom={addCustomTiffin}
        onNext={handleFinish}
      />
    ),
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-gray-200">
        <div
          className="h-full bg-[#2E86AB] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={back}
          className={`w-10 h-10 flex items-center justify-center rounded-full text-[#1E3A5F] font-bold text-lg
            ${step === 1 ? 'invisible' : ''}`}
        >
          ←
        </button>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Step {step} of {TOTAL_STEPS}
        </span>
        <div className="w-10" />
      </div>

      {/* Step content */}
      <div className="flex-1 px-4 pb-6 pt-2 flex flex-col max-w-md mx-auto w-full">
        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded-xl text-red-600 text-sm">{error}</div>
        )}
        <div className="flex-1 flex flex-col animate-fadeIn" key={step}>
          {stepComponents[step]}
        </div>
      </div>
    </div>
  )
}
