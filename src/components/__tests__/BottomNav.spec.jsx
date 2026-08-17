import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BottomNav from '../BottomNav'
import { AuthService } from '@/services/AuthService'

vi.mock('@/services/AuthService', () => ({
  AuthService: { signOut: vi.fn() },
}))

describe('BottomNav — Sign out', () => {
  beforeEach(() => {
    AuthService.signOut.mockReset()
  })

  it('renders a clearly labeled "Sign out" control', () => {
    render(<MemoryRouter><BottomNav /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('calls AuthService.signOut() when clicked and disables itself while the request is in flight', async () => {
    let resolveSignOut
    AuthService.signOut.mockReturnValue(new Promise((resolve) => { resolveSignOut = resolve }))

    render(<MemoryRouter><BottomNav /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(AuthService.signOut).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDisabled()

    // On success the component intentionally stays disabled rather than re-enabling — in the
    // real app useAuth.js's SIGNED_OUT listener redirects to /login immediately afterward,
    // unmounting this component, so there is no user-visible moment where it needs to recover.
    resolveSignOut({ success: true })
    await Promise.resolve()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDisabled()
  })

  it('prevents duplicate sign-out calls while a request is in flight', async () => {
    let resolveSignOut
    AuthService.signOut.mockReturnValue(new Promise((resolve) => { resolveSignOut = resolve }))

    render(<MemoryRouter><BottomNav /></MemoryRouter>)
    const button = screen.getByRole('button', { name: 'Sign out' })

    fireEvent.click(button)
    expect(button).toBeDisabled()
    fireEvent.click(button)
    fireEvent.click(button)

    expect(AuthService.signOut).toHaveBeenCalledTimes(1)
    resolveSignOut({ success: true })
  })

  it('re-enables the button if signOut rejects, so the user can retry', async () => {
    AuthService.signOut.mockRejectedValue(new Error('network error'))
    render(<MemoryRouter><BottomNav /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign out' })).not.toBeDisabled())
  })
})
