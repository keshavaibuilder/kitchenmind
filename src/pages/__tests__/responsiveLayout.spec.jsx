import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RecipeLibrary from '../RecipeLibrary'
import MealHistory from '../MealHistory'

let browseState

vi.mock('../../hooks/useRecipes', () => ({
  useRecipes: () => browseState,
  useFavoriteRecipes: () => ({ favoriteRecipes: [], isFavorite: () => false, toggleFavorite: vi.fn(), isLoading: false }),
  useRecentlyCookedRecipes: () => ({ recipes: [], isLoading: false }),
}))

beforeEach(() => {
  browseState = { recipes: [], isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn() }
})

vi.mock('../../hooks/useMealHistory', () => ({
  useMealHistory: () => ({ mealLogs: [], isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn() }),
  useMealDeductions: () => ({ deductions: [], isLoading: false }),
  useRecipeCookingHistory: () => ({ recentCooks: [], lastCookedAt: null, isLoading: false }),
}))

/**
 * True cross-device visual testing needs a real browser (Playwright), not available in this
 * environment. This is a regression check on the mobile-first-with-desktop-centering container
 * convention every existing page in the codebase already uses (`max-w-md mx-auto`) — it catches
 * a page silently dropping that convention, not pixel-level layout correctness.
 */
describe('Recipe Workspace responsive container convention', () => {
  it('RecipeLibrary uses the shared mobile-first max-width + centering shell', () => {
    const { container } = render(
      <MemoryRouter>
        <RecipeLibrary />
      </MemoryRouter>
    )
    const shell = container.querySelector('.max-w-md')
    expect(shell).not.toBeNull()
    expect(shell.className).toMatch(/mx-auto/)
  })

  it('MealHistory uses the shared mobile-first max-width + centering shell', () => {
    const { container } = render(
      <MemoryRouter>
        <MealHistory />
      </MemoryRouter>
    )
    const shell = container.querySelector('.max-w-md')
    expect(shell).not.toBeNull()
    expect(shell.className).toMatch(/mx-auto/)
  })

  it('the recipe grid uses a 2-column layout at the base (mobile) breakpoint', () => {
    browseState = {
      ...browseState,
      recipes: [{ id: '1', name: 'Dal Tadka', meal_type: 'lunch', cuisine: 'North Indian', base_servings: 4 }],
    }
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<RecipeLibrary />} />
        </Routes>
      </MemoryRouter>
    )
    // grid-cols-2 with no responsive prefix applies at all widths in this codebase's mobile-first
    // Tailwind setup (no sm:/md: override exists for these pages), which is the deliberate
    // "always render as a phone-width column" choice used throughout the app.
    const grid = document.querySelector('.grid-cols-2')
    expect(grid).not.toBeNull()
  })
})
