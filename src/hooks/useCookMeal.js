import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RecipeService } from '@/services/RecipeService'
import { MealLogService } from '@/services/MealLogService'
import { HouseholdService } from '@/services/HouseholdService'
import { useInventory } from '@/hooks/useInventory'
import useAuthStore from '@/store/authStore'
import { computeIngredientAvailability, summarizeAvailability } from '../utils/ingredientAvailability.js'
import { calculateRotiRequirement } from '../utils/rotiCalculator.js'

const SERVING_PRESETS = [1, 2, 4, 6, 8]

/**
 * Orchestrates the whole Recipe Detail cooking experience: serving scale -> scaled ingredients
 * -> availability against real inventory -> inventory impact preview -> cook confirmation via
 * mark_meal_cooked(). No Supabase access in the page component — this hook and the services it
 * calls are the only things that touch the network.
 *
 * @param {Object|null} recipe
 */
export function useCookMeal(recipe) {
  const { household_id } = useAuthStore()
  const queryClient = useQueryClient()
  const { items: inventoryItems } = useInventory()

  const [servings, setServings] = useState(recipe?.base_servings || 4)
  const [includeRoti, setIncludeRoti] = useState(false)

  // Members/guests power the roti calculator (see rotiCalculator.js) — only fetched when the
  // roti toggle is actually used, since most recipes won't need it.
  const membersQuery = useQuery({
    queryKey: ['members', household_id],
    queryFn: () => HouseholdService.getMembers(household_id),
    enabled: !!household_id && includeRoti,
  })
  const householdQuery = useQuery({
    queryKey: ['household', household_id],
    queryFn: () => HouseholdService.getHouseholdDetails(household_id),
    enabled: !!household_id && includeRoti,
  })

  const scaledIngredients = useMemo(() => {
    if (!recipe) return []
    return RecipeService.scaleRecipeIngredients(recipe, servings)
  }, [recipe, servings])

  const rotiRequirement = useMemo(() => {
    if (!includeRoti || !householdQuery.data || !membersQuery.data) return null
    return calculateRotiRequirement({ members: membersQuery.data, household: householdQuery.data, guestCount: 0 })
  }, [includeRoti, householdQuery.data, membersQuery.data])

  // What actually gets deducted: scaled recipe ingredients plus roti flour, if opted in.
  const requiredIngredients = useMemo(() => {
    const base = [...scaledIngredients]
    if (rotiRequirement) {
      base.push({ canonical_name: 'Wheat Flour', quantity_grams: rotiRequirement.totalFlourGrams, is_optional: false })
    }
    return base
  }, [scaledIngredients, rotiRequirement])

  const availability = useMemo(
    () => computeIngredientAvailability(requiredIngredients, inventoryItems),
    [requiredIngredients, inventoryItems]
  )
  const availabilitySummary = useMemo(() => summarizeAvailability(availability), [availability])

  const cookMutation = useMutation({
    mutationFn: () =>
      MealLogService.cookRecipeNow(household_id, {
        recipeId: recipe.id,
        mealType: recipe.meal_type,
        servings,
        requiredIngredients,
      }),
    onSuccess: () => {
      // Cooking changes real inventory, so anything that reads it (or derives from it) must
      // refetch: inventory itself, this recipe's cooking history, and the Library's
      // "recently cooked" shelf. Phase 4A's learning-engine tables (ingredient_consumption_profile
      // etc.) update asynchronously server-side post-commit-style — there's no frontend query on
      // them yet to invalidate.
      queryClient.invalidateQueries({ queryKey: ['inventory', household_id] })
      queryClient.invalidateQueries({ queryKey: ['mealHistory'] })
      queryClient.invalidateQueries({ queryKey: ['recentlyCookedRecipeIds', household_id] })
    },
  })

  return {
    servings,
    setServings,
    servingPresets: SERVING_PRESETS,
    includeRoti,
    setIncludeRoti,
    rotiRequirement,
    scaledIngredients,
    requiredIngredients,
    availability,
    availabilitySummary,
    cookNow: cookMutation.mutateAsync,
    isCooking: cookMutation.isPending,
    cookError: cookMutation.error,
    cookResult: cookMutation.data,
    resetCookResult: cookMutation.reset,
  }
}
