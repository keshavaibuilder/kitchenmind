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
   * Fetches global recipes plus this household's own custom recipes, paginated.
   * @param {string} householdId
   * @param {Object} [filters] - { mealType?, cuisine?, isVegetarian?: boolean, search?: string, limit?: number, offset?: number }
   * @param {import('@supabase/supabase-js').SupabaseClient} [client] - Injectable client; see
   *   InventoryService.getInventory for why.
   * @returns {Promise<{ recipes: Array<Object>, hasMore: boolean }>}
   */
  async getRecipes(householdId, filters = {}, client = supabaseClient) {
    const { mealType, cuisine, isVegetarian, search, limit = 20, offset = 0 } = filters
    try {
      let query = client.from('recipes').select('*')
      query = householdId ? query.or(`household_id.is.null,household_id.eq.${householdId}`) : query.is('household_id', null)
      if (mealType) query = query.eq('meal_type', mealType)
      if (cuisine) query = query.eq('cuisine', cuisine)
      if (typeof isVegetarian === 'boolean') query = query.eq('is_vegetarian', isVegetarian)
      if (search) query = query.ilike('name', `%${search}%`)

      // Fetch one extra row to detect whether another page exists, without a separate COUNT query.
      const { data, error } = await query.order('name', { ascending: true }).range(offset, offset + limit)
      if (error) throw normalizeError(error, 'RECIPE_FETCH_FAILED')

      const rows = data ?? []
      const hasMore = rows.length > limit
      return { recipes: hasMore ? rows.slice(0, limit) : rows, hasMore }
    } catch (err) {
      throw normalizeError(err, 'RECIPE_FETCH_FAILED')
    }
  },

  /**
   * Resolves a set of recipe IDs to full recipe objects, preserving the input order (e.g.
   * most-recently-cooked-first) since PostgREST's `.in()` doesn't guarantee row order.
   * @param {Array<string>} ids
   * @returns {Promise<Array<Object>>}
   */
  async getRecipesByIds(ids = []) {
    if (!ids.length) return []
    try {
      const { data, error } = await supabaseClient.from('recipes').select('*').in('id', ids)
      if (error) throw normalizeError(error, 'RECIPE_FETCH_FAILED')
      const byId = new Map((data ?? []).map((r) => [r.id, r]))
      return ids.map((id) => byId.get(id)).filter(Boolean)
    } catch (err) {
      logger.warn('Failed to fetch recipes by ids:', err)
      return []
    }
  },

  /**
   * @param {string} recipeId
   * @param {import('@supabase/supabase-js').SupabaseClient} [client] - Injectable client; see
   *   InventoryService.getInventory for why.
   * @returns {Promise<Object|null>}
   */
  async getRecipeById(recipeId, client = supabaseClient) {
    if (!recipeId) return null
    try {
      const { data, error } = await client.from('recipes').select('*').eq('id', recipeId).maybeSingle()
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
   * Updates a household-owned custom recipe. RLS already prevents editing global recipes or
   * another household's recipes; householdId is passed as a defense-in-depth query filter too.
   * @param {string} householdId
   * @param {string} recipeId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateRecipe(householdId, recipeId, updates) {
    if (!householdId || !recipeId) throw normalizeError('Missing household_id or recipe_id', 'RECIPE_UPDATE_FAILED')
    try {
      const { data, error } = await supabaseClient
        .from('recipes')
        .update(updates)
        .eq('id', recipeId)
        .eq('household_id', householdId)
        .select()
        .single()
      if (error) throw normalizeError(error, 'RECIPE_UPDATE_FAILED')
      return data
    } catch (err) {
      throw normalizeError(err, 'RECIPE_UPDATE_FAILED')
    }
  },

  /**
   * @param {string} householdId
   * @param {string} recipeId
   * @returns {Promise<{ success: boolean }>}
   */
  async deleteRecipe(householdId, recipeId) {
    if (!householdId || !recipeId) throw normalizeError('Missing household_id or recipe_id', 'RECIPE_DELETE_FAILED')
    try {
      const { error } = await supabaseClient.from('recipes').delete().eq('id', recipeId).eq('household_id', householdId)
      if (error) throw normalizeError(error, 'RECIPE_DELETE_FAILED')
      return { success: true }
    } catch (err) {
      throw normalizeError(err, 'RECIPE_DELETE_FAILED')
    }
  },

  /**
   * Copies any visible recipe (global or another household's — RLS already scopes what's
   * visible via getRecipes) into this household as an editable custom recipe.
   * @param {string} householdId
   * @param {Object} sourceRecipe
   * @returns {Promise<Object>}
   */
  async duplicateRecipe(householdId, sourceRecipe) {
    if (!householdId || !sourceRecipe) throw normalizeError('Missing household_id or source recipe', 'RECIPE_DUPLICATE_FAILED')
    const { id, household_id, created_at, ...copyable } = sourceRecipe
    return this.createCustomRecipe(householdId, { ...copyable, name: `${sourceRecipe.name} (Copy)` })
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
