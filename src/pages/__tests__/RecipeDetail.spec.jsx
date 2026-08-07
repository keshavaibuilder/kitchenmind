import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RecipeDetail from '../RecipeDetail'

let recipeState
const mockToggleFavorite = vi.fn()
const mockDeleteRecipe = vi.fn()
const mockDuplicateRecipe = vi.fn()

vi.mock('../../hooks/useRecipes', () => ({
  useRecipeById: () => recipeState,
  useRecipeMutations: () => ({ deleteRecipe: mockDeleteRecipe, duplicateRecipe: mockDuplicateRecipe, createRecipe: vi.fn(), updateRecipe: vi.fn() }),
  useFavoriteRecipes: () => ({ isFavorite: () => false, toggleFavorite: mockToggleFavorite }),
}))

vi.mock('../../hooks/useMealHistory', () => ({
  useRecipeCookingHistory: () => ({ recentCooks: [], lastCookedAt: null, isLoading: false }),
}))

vi.mock('../../components/recipes/CookMealFlow', () => ({
  default: ({ onClose }) => (
    <div data-testid="cook-flow">
      <button onClick={onClose}>close-flow</button>
    </div>
  ),
}))

const recipe = {
  id: 'r1',
  household_id: 'hh_test',
  name: 'Dal Tadka',
  meal_type: 'lunch',
  base_servings: 4,
  ingredients: [{ canonical_name: 'Toor Dal', base_quantity_grams: 200 }],
  cuisine: 'North Indian',
  prep_time_mins: 10,
  cook_time_mins: 25,
  difficulty: 'easy',
}

beforeEach(() => {
  vi.clearAllMocks()
  recipeState = { recipe, isLoading: false, isError: false, refetch: vi.fn() }
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/recipe/r1']}>
      <Routes>
        <Route path="/recipe/:id" element={<RecipeDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('RecipeDetail', () => {
  it('renders recipe info and base-serving ingredients', () => {
    renderPage()
    expect(screen.getByText('Dal Tadka')).toBeInTheDocument()
    expect(screen.getByText('Toor Dal')).toBeInTheDocument()
    expect(screen.getByText('200g')).toBeInTheDocument()
  })

  it('opens the cook flow when "Cook This Recipe" is tapped', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Cook This Recipe/ }))
    expect(screen.getByTestId('cook-flow')).toBeInTheDocument()
  })

  it('shows a retry affordance when the recipe fails to load', () => {
    recipeState = { recipe: null, isLoading: false, isError: true, refetch: vi.fn() }
    renderPage()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('toggles favorite state when the star is tapped', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Add to favorites' }))
    expect(mockToggleFavorite).toHaveBeenCalledWith('r1')
  })

  it('only shows Edit/Delete for household-owned custom recipes', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('hides Edit/Delete for global recipes (household_id is null)', () => {
    recipeState = { recipe: { ...recipe, household_id: null }, isLoading: false, isError: false, refetch: vi.fn() }
    renderPage()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('requires a second confirming tap before actually deleting', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(mockDeleteRecipe).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument()
  })
})
