import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RecipeLibrary from '../RecipeLibrary'

const mockRecipe = (overrides = {}) => ({
  id: '1',
  name: 'Dal Tadka',
  meal_type: 'lunch',
  cuisine: 'North Indian',
  base_servings: 4,
  ...overrides,
})

let browseState
let favoritesState
let recentState

vi.mock('../../hooks/useRecipes', () => ({
  useRecipes: () => browseState,
  useFavoriteRecipes: () => favoritesState,
  useRecentlyCookedRecipes: () => recentState,
}))

beforeEach(() => {
  browseState = {
    recipes: [mockRecipe()],
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }
  favoritesState = { favoriteRecipes: [], isFavorite: () => false, toggleFavorite: vi.fn(), isLoading: false }
  recentState = { recipes: [], isLoading: false }
})

function renderPage() {
  return render(
    <MemoryRouter>
      <RecipeLibrary />
    </MemoryRouter>
  )
}

describe('RecipeLibrary', () => {
  it('renders recipes from the browse query', () => {
    renderPage()
    expect(screen.getByText('Dal Tadka')).toBeInTheDocument()
  })

  it('shows a loading skeleton while the browse query is pending', () => {
    browseState = { ...browseState, isLoading: true, recipes: [] }
    const { container } = renderPage()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('shows an empty state with a call-to-action for the Favorites tab', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Favorites' }))
    expect(screen.getByText(/No favorites yet/)).toBeInTheDocument()
  })

  it('shows an empty state for Recently Cooked with no history', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Recently Cooked' }))
    expect(screen.getByText(/Nothing cooked yet/)).toBeInTheDocument()
  })

  it('shows recipes already marked as favorites in the Favorites tab', () => {
    favoritesState = { favoriteRecipes: [mockRecipe({ id: '2', name: 'Rajma Masala' })], isFavorite: () => true, toggleFavorite: vi.fn(), isLoading: false }
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Favorites' }))
    expect(screen.getByText('Rajma Masala')).toBeInTheDocument()
  })
})
