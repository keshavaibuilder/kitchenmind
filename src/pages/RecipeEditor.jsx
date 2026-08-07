import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRecipeById, useRecipeMutations } from '../hooks/useRecipes'
import { useToast } from '../hooks/useToast'
import { convertToUnitGrams } from '../utils/units.js'
import { CURATED_INGREDIENTS, INGREDIENT_GROUP_ORDER } from '../config/ingredients.js'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'tiffin']
const DIFFICULTIES = ['easy', 'medium', 'hard']
const UNITS = ['g', 'kg', 'ml', 'L', 'pcs']

const EMPTY_RECIPE = {
  name: '',
  meal_type: 'dinner',
  cuisine: '',
  base_servings: 4,
  description: '',
  prep_time_mins: '',
  cook_time_mins: '',
  difficulty: 'easy',
  is_vegetarian: true,
  tags: [],
  ingredients: [],
  instructions: '',
}

function toFormIngredient(ing) {
  // Editor works in whichever unit is convenient for input; storage is always grams.
  return { canonical_name: ing.canonical_name, amount: ing.base_quantity_grams, unit: 'g', is_optional: Boolean(ing.is_optional) }
}

export default function RecipeEditor() {
  const { id } = useParams()
  const isEditMode = Boolean(id)
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { recipe, isLoading } = useRecipeById(id)
  const { createRecipe, updateRecipe } = useRecipeMutations()

  const [form, setForm] = useState(EMPTY_RECIPE)
  const [ingredientPickerOpen, setIngredientPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEditMode && recipe) {
      setForm({
        ...EMPTY_RECIPE,
        ...recipe,
        prep_time_mins: recipe.prep_time_mins ?? '',
        cook_time_mins: recipe.cook_time_mins ?? '',
        tags: Array.isArray(recipe.tags) ? recipe.tags : [],
        ingredients: (recipe.ingredients || []).map(toFormIngredient),
      })
    }
  }, [isEditMode, recipe])

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function addIngredient(canonicalName) {
    if (form.ingredients.some((i) => i.canonical_name === canonicalName)) {
      setIngredientPickerOpen(false)
      setPickerSearch('')
      return
    }
    setField('ingredients', [...form.ingredients, { canonical_name: canonicalName, amount: 100, unit: 'g', is_optional: false }])
    setIngredientPickerOpen(false)
    setPickerSearch('')
  }

  function updateIngredient(index, updates) {
    setField(
      'ingredients',
      form.ingredients.map((ing, i) => (i === index ? { ...ing, ...updates } : ing))
    )
  }

  function removeIngredient(index) {
    setField(
      'ingredients',
      form.ingredients.filter((_, i) => i !== index)
    )
  }

  const filteredPickerItems = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim()
    const pool = q ? CURATED_INGREDIENTS.filter((i) => i.label.toLowerCase().includes(q)) : CURATED_INGREDIENTS
    const map = {}
    pool.forEach((item) => {
      if (!map[item.category]) map[item.category] = []
      map[item.category].push(item)
    })
    return INGREDIENT_GROUP_ORDER.filter((g) => map[g]).map((g) => ({ group: g, items: map[g] }))
  }, [pickerSearch])

  function validate() {
    const next = {}
    if (!form.name.trim()) next.name = 'Recipe name is required'
    if (!form.meal_type) next.meal_type = 'Meal type is required'
    if (!form.base_servings || Number(form.base_servings) <= 0) next.base_servings = 'Servings must be greater than 0'
    if (form.ingredients.length === 0) next.ingredients = 'Add at least one ingredient'
    form.ingredients.forEach((ing) => {
      if (!ing.amount || Number(ing.amount) <= 0) next.ingredients = 'Every ingredient needs a quantity greater than 0'
    })
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        meal_type: form.meal_type,
        cuisine: form.cuisine.trim() || null,
        base_servings: Number(form.base_servings),
        description: form.description.trim() || null,
        prep_time_mins: form.prep_time_mins === '' ? null : Number(form.prep_time_mins),
        cook_time_mins: form.cook_time_mins === '' ? null : Number(form.cook_time_mins),
        difficulty: form.difficulty || null,
        is_vegetarian: form.is_vegetarian,
        tags: form.tags,
        instructions: form.instructions.trim() || null,
        ingredients: form.ingredients.map((ing) => ({
          canonical_name: ing.canonical_name,
          base_quantity_grams: convertToUnitGrams(ing.amount, ing.unit),
          is_optional: ing.is_optional,
        })),
      }

      if (isEditMode) {
        await updateRecipe(id, payload)
        showToast('Recipe updated.', { type: 'success' })
        navigate(`/recipe/${id}`)
      } else {
        const created = await createRecipe(payload)
        showToast('Recipe created.', { type: 'success' })
        navigate(`/recipe/${created.id}`)
      }
    } catch (err) {
      showToast(err.message || 'Could not save this recipe.', { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (isEditMode && isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#2E86AB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] max-w-md mx-auto pb-28">
      <div className="sticky top-0 bg-[#F5F7FA] px-4 pt-8 pb-3 z-10 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-[#2E86AB] text-sm font-semibold">
          ← Back
        </button>
        <h1 className="text-lg font-bold text-[#1E3A5F]">{isEditMode ? 'Edit Recipe' : 'New Recipe'}</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 space-y-5">
        <Field label="Recipe name" error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="e.g. Dal Tadka"
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Meal type" error={errors.meal_type}>
            <select
              value={form.meal_type}
              onChange={(e) => setField('meal_type', e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm capitalize bg-white"
            >
              {MEAL_TYPES.map((mt) => (
                <option key={mt} value={mt} className="capitalize">
                  {mt}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cuisine">
            <input
              type="text"
              value={form.cuisine}
              onChange={(e) => setField('cuisine', e.target.value)}
              placeholder="e.g. North Indian"
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Servings" error={errors.base_servings}>
            <input
              type="number"
              min={1}
              value={form.base_servings}
              onChange={(e) => setField('base_servings', e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm"
            />
          </Field>
          <Field label="Prep (min)">
            <input
              type="number"
              min={0}
              value={form.prep_time_mins}
              onChange={(e) => setField('prep_time_mins', e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm"
            />
          </Field>
          <Field label="Cook (min)">
            <input
              type="number"
              min={0}
              value={form.cook_time_mins}
              onChange={(e) => setField('cook_time_mins', e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Difficulty">
            <select
              value={form.difficulty}
              onChange={(e) => setField('difficulty', e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm capitalize bg-white"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d} className="capitalize">
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Diet">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setField('is_vegetarian', true)}
                className={`flex-1 h-11 rounded-xl border-2 text-xs font-semibold ${form.is_vegetarian ? 'bg-[#1A7A4A] border-[#1A7A4A] text-white' : 'bg-white border-gray-200 text-gray-600'}`}
              >
                Veg
              </button>
              <button
                type="button"
                onClick={() => setField('is_vegetarian', false)}
                className={`flex-1 h-11 rounded-xl border-2 text-xs font-semibold ${!form.is_vegetarian ? 'bg-[#C0392B] border-[#C0392B] text-white' : 'bg-white border-gray-200 text-gray-600'}`}
              >
                Non-Veg
              </button>
            </div>
          </Field>
        </div>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={2}
            placeholder="A short description of this dish"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
          />
        </Field>

        {/* Ingredients */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Ingredients</p>
            <button
              type="button"
              onClick={() => setIngredientPickerOpen(true)}
              className="text-[#2E86AB] text-xs font-semibold"
            >
              + Add ingredient
            </button>
          </div>
          {errors.ingredients && <p className="text-xs text-[#C0392B] mb-2">{errors.ingredients}</p>}
          <div className="space-y-2">
            {form.ingredients.map((ing, index) => (
              <div key={ing.canonical_name} className="bg-white rounded-xl border border-gray-100 p-2 flex items-center gap-2">
                <span className="flex-1 text-sm text-gray-700 truncate">{ing.canonical_name}</span>
                <input
                  type="number"
                  min={0}
                  value={ing.amount}
                  onChange={(e) => updateIngredient(index, { amount: e.target.value })}
                  className="w-16 h-9 px-2 rounded-lg border border-gray-200 text-sm"
                  aria-label={`Quantity for ${ing.canonical_name}`}
                />
                <select
                  value={ing.unit}
                  onChange={(e) => updateIngredient(index, { unit: e.target.value })}
                  className="h-9 px-1 rounded-lg border border-gray-200 text-xs bg-white"
                  aria-label={`Unit for ${ing.canonical_name}`}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-[10px] text-gray-400">
                  <input
                    type="checkbox"
                    checked={ing.is_optional}
                    onChange={(e) => updateIngredient(index, { is_optional: e.target.checked })}
                    className="w-3.5 h-3.5"
                  />
                  opt.
                </label>
                <button
                  type="button"
                  onClick={() => removeIngredient(index)}
                  className="text-gray-300 text-lg w-6"
                  aria-label={`Remove ${ing.canonical_name}`}
                >
                  ✕
                </button>
              </div>
            ))}
            {form.ingredients.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4 bg-white rounded-xl border border-dashed border-gray-200">
                No ingredients added yet
              </p>
            )}
          </div>
        </div>

        <Field label="Instructions">
          <textarea
            value={form.instructions}
            onChange={(e) => setField('instructions', e.target.value)}
            rows={5}
            placeholder="Step-by-step cooking instructions"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
          />
        </Field>
      </div>

      {/* Save bar */}
      <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto px-4 pb-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold shadow-lg disabled:opacity-50 active:scale-95 transition-transform"
        >
          {saving ? 'Saving…' : isEditMode ? 'Save Changes' : 'Create Recipe'}
        </button>
      </div>

      {/* Ingredient picker sheet */}
      {ingredientPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setIngredientPickerOpen(false)}>
          <div
            className="bg-[#F5F7FA] w-full max-w-md rounded-t-3xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Pick an ingredient"
          >
            <div className="sticky top-0 bg-[#F5F7FA] px-4 pt-4 pb-2 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-[#1E3A5F]">Add ingredient</h2>
                <button onClick={() => setIngredientPickerOpen(false)} className="text-gray-400 text-xl" aria-label="Close">
                  ✕
                </button>
              </div>
              <input
                autoFocus
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search ingredients…"
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm"
              />
            </div>
            <div className="px-4 py-3 space-y-4">
              {filteredPickerItems.map(({ group, items }) => (
                <div key={group}>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">{group}</p>
                  <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
                    {items.map((item) => (
                      <button
                        key={item.canonical}
                        onClick={() => addIngredient(item.canonical)}
                        className="w-full flex items-center justify-between px-3 h-11 text-left text-sm text-gray-700 active:bg-gray-50"
                      >
                        {item.label}
                        <span className="text-gray-300">+</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filteredPickerItems.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">No ingredients found for "{pickerSearch}"</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-[#C0392B] mt-1">{error}</p>}
    </div>
  )
}
