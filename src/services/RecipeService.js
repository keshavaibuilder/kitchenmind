import { supabaseClient } from './supabaseClient.js'
import { normalizeError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

/**
 * RecipeService
 * Recipe catalogue service: global master recipes (household_id IS NULL) plus household-owned
 * custom recipes. `recipes.ingredients` is a jsonb array of
 * { canonical_name, base_quantity_grams, is_optional? } scaled for `base_servings`.
 */
export const RecipeService = {
  /**
   * Fetches global recipes plus this household's own custom recipes.
   * @param {string} householdId
   * @param {Object} [filters] - { mealType?: string, cuisine?: string }
   * @returns {Promise<Array<Object>>}
   */
  async getRecipes(householdId, filters = {}) {
    try {
      let query = supabaseClient.from('recipes').select('*')
      query = householdId ? query.or(`household_id.is.null,household_id.eq.${householdId}`) : query.is('household_id', null)
      if (filters.mealType) query = query.eq('meal_type', filters.mealType)
      if (filters.cuisine) query = query.eq('cuisine', filters.cuisine)

      const { data, error } = await query
      if (error) throw normalizeError(error, 'RECIPE_FETCH_FAILED')
      return data ?? []
    } catch (err) {
      throw normalizeError(err, 'RECIPE_FETCH_FAILED')
    }
  },

  /**
   * @param {string} recipeId
   * @returns {Promise<Object|null>}
   */
  async getRecipeById(recipeId) {
    if (!recipeId) return null
    try {
      const { data, error } = await supabaseClient.from('recipes').select('*').eq('id', recipeId).maybeSingle()
      if (error) throw normalizeError(error, 'RECIPE_FETCH_FAILED')
      return data
    } catch (err) {
      logger.warn('Failed to fetch recipe by id:', err)
      return null
    }
  },

  /**
   * @param {string} householdId
   * @param {Object} recipePayload - { name, meal_type, cuisine?, base_servings, ingredients, instructions? }
   * @returns {Promise<Object>}
   */
  async createCustomRecipe(householdId, recipePayload) {
    if (!householdId) throw normalizeError('Missing household_id', 'RECIPE_CREATE_FAILED')
    try {
      const { data, error } = await supabaseClient
        .from('recipes')
        .insert({ ...recipePayload, household_id: householdId })
        .select()
        .single()
      if (error) throw normalizeError(error, 'RECIPE_CREATE_FAILED')
      return data
    } catch (err) {
      throw normalizeError(err, 'RECIPE_CREATE_FAILED')
    }
  },

  /**
   * Pure function: scales a recipe's base-servings ingredient list to a target serving count.
   * @param {{ base_servings: number, ingredients: Array<{canonical_name: string, base_quantity_grams: number, is_optional?: boolean}> }} recipe
   * @param {number} targetServings
   * @returns {Array<{ canonical_name: string, quantity_grams: number, is_optional: boolean }>}
   */
  scaleRecipeIngredients(recipe, targetServings) {
    const baseServings = Number(recipe?.base_servings) || 1
    const multiplier = (Number(targetServings) || baseServings) / baseServings
    const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : []

    return ingredients
      .filter((ing) => ing && ing.canonical_name)
      .map((ing) => ({
        canonical_name: ing.canonical_name,
        quantity_grams: Number((Number(ing.base_quantity_grams) * multiplier).toFixed(3)),
        is_optional: Boolean(ing.is_optional),
      }))
  },
}
