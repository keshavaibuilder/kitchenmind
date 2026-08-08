import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import QuickActionsBar from '../QuickActionsBar'

describe('QuickActionsBar', () => {
  it('navigates to the action path when tapped', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={<QuickActionsBar actions={[{ id: 'restock', label: 'Restock 2 low items', path: '/scan', emoji: '📷' }]} />}
          />
          <Route path="/scan" element={<p>scan-page</p>} />
        </Routes>
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('Restock 2 low items'))
    expect(screen.getByText('scan-page')).toBeInTheDocument()
  })

  it('renders every provided action', () => {
    render(
      <MemoryRouter>
        <QuickActionsBar
          actions={[
            { id: 'browse', label: 'Browse recipes', path: '/recipes', emoji: '📖' },
            { id: 'kitchen', label: 'View kitchen', path: '/inventory', emoji: '🧺' },
          ]}
        />
      </MemoryRouter>
    )
    expect(screen.getByText('Browse recipes')).toBeInTheDocument()
    expect(screen.getByText('View kitchen')).toBeInTheDocument()
  })
})
