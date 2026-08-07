import { useState } from 'react'
import ServingScaleSelector from './ServingScaleSelector'
import IngredientAvailabilityList from './IngredientAvailabilityList'
import InventoryImpactPreview from './InventoryImpactPreview'
import { useToast } from '../../hooks/useToast'
import { useCookMeal } from '../../hooks/useCookMeal'

/**
 * Review -> Confirm -> mark_meal_cooked() -> success workflow, rendered as a bottom sheet.
 * Owns its own useCookMeal() call so inventory/members are only fetched while this sheet is
 * actually open, not just from viewing the Recipe Detail page.
 *
 * @param {Object} recipe
 * @param {() => void} onClose
 */
export default function CookMealFlow({ recipe, onClose }) {
  const cookState = useCookMeal(recipe)
  const {
    servings,
    setServings,
    servingPresets,
    includeRoti,
    setIncludeRoti,
    rotiRequirement,
    availability,
    availabilitySummary,
    cookNow,
    isCooking,
    cookError,
    cookResult,
    resetCookResult,
  } = cookState
  const [step, setStep] = useState('review') // 'review' | 'success'
  const { showToast } = useToast()

  async function handleConfirm() {
    try {
      const result = await cookNow()
      setStep('success')
      showToast(
        result.hasShortfall ? `${recipe.name} marked as cooked — some ingredients ran short.` : `${recipe.name} marked as cooked!`,
        { type: result.hasShortfall ? 'warning' : 'success' }
      )
    } catch {
      showToast('Could not mark this meal as cooked. Please try again.', { type: 'error' })
    }
  }

  function handleClose() {
    resetCookResult()
    setStep('review')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={handleClose}>
      <div
        className="bg-[#F5F7FA] w-full max-w-md rounded-t-3xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Cook ${recipe.name}`}
      >
        <div className="sticky top-0 bg-[#F5F7FA] px-4 pt-4 pb-3 flex items-center justify-between border-b border-gray-100 z-10">
          <h2 className="text-lg font-bold text-[#1E3A5F]">{step === 'success' ? 'Meal Cooked!' : `Cook ${recipe.name}`}</h2>
          <button onClick={handleClose} className="text-gray-400 text-xl leading-none w-8 h-8" aria-label="Close">
            ✕
          </button>
        </div>

        {step === 'review' && (
          <div className="p-4 space-y-5">
            <ServingScaleSelector servings={servings} onChange={setServings} presets={servingPresets} />

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={includeRoti}
                onChange={(e) => setIncludeRoti(e.target.checked)}
                className="w-4 h-4 accent-[#2E86AB]"
              />
              Include roti flour for this meal
            </label>
            {includeRoti && rotiRequirement && (
              <p className="text-xs text-gray-500 -mt-3">
                ≈ {rotiRequirement.totalRotis} rotis · {rotiRequirement.totalFlourGrams}g flour
              </p>
            )}

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Ingredient availability</p>
              <IngredientAvailabilityList availability={availability} />
              {!availabilitySummary.canCookFully && (
                <p className="text-xs text-[#C0392B] mt-2">
                  Some required ingredients are missing. You can still cook — the shortfall will be recorded.
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Inventory impact</p>
              <InventoryImpactPreview availability={availability} />
            </div>

            {cookError && <p className="text-sm text-[#C0392B]">{cookError.message}</p>}

            <button
              onClick={handleConfirm}
              disabled={isCooking}
              className="w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold disabled:opacity-50 active:scale-95 transition-transform"
            >
              {isCooking ? 'Cooking…' : cookError ? 'Retry' : 'Confirm & Cook'}
            </button>
          </div>
        )}

        {step === 'success' && cookResult && (
          <div className="p-6 text-center">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-gray-500 text-sm mb-6">
              {cookResult.hasShortfall
                ? 'Marked as cooked. A few ingredients ran short — inventory was updated with what was available.'
                : 'Inventory has been updated.'}
            </p>
            <button
              onClick={handleClose}
              className="w-full h-12 rounded-xl bg-[#1E3A5F] text-white font-semibold active:scale-95 transition-transform"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
