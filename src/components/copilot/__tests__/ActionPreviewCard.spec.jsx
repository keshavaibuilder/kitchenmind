import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ActionPreviewCard from '../ActionPreviewCard.jsx'

describe('ActionPreviewCard component', () => {
  const proposal = {
    capabilityId: 'meal.mark_cooked',
    actionName: 'Mark Meal as Cooked',
    payload: { mealLogId: 'ml-1' },
    preview: {
      action: 'Mark Dal Tadka cooked',
      affectedItems: ['Dal Tadka', 'Lentils'],
      quantities: ['Headcount: 2'],
      householdImpact: 'Deducts lentils from pantry stock via FIFO.',
      expectedResult: 'Meal log status updated to COOKED.',
      irreversible: true,
    },
  }

  it('renders structured action preview details correctly', () => {
    render(<ActionPreviewCard messageId="m1" proposal={proposal} onConfirm={() => {}} onCancel={() => {}} />)

    expect(screen.getByText('Mark Meal as Cooked')).toBeInTheDocument()
    expect(screen.getByText('Mark Dal Tadka cooked')).toBeInTheDocument()
    expect(screen.getByText('Dal Tadka, Lentils')).toBeInTheDocument()
    expect(screen.getByText('Deducts lentils from pantry stock via FIFO.')).toBeInTheDocument()
    expect(screen.getByText('Warning: This action will deduct physical inventory stock.')).toBeInTheDocument()
  })

  it('triggers onConfirm when confirm button is clicked', async () => {
    const onConfirmMock = vi.fn().mockResolvedValue(true)
    render(<ActionPreviewCard messageId="m1" proposal={{ ...proposal, preview: { ...proposal.preview, irreversible: false } }} onConfirm={onConfirmMock} onCancel={() => {}} />)

    const confirmBtn = screen.getByText('✓ Confirm Action')
    fireEvent.click(confirmBtn)

    expect(onConfirmMock).toHaveBeenCalledWith('m1', expect.objectContaining({ capabilityId: 'meal.mark_cooked' }))
  })

  it('triggers onCancel when cancel button is clicked', () => {
    const onCancelMock = vi.fn()
    render(<ActionPreviewCard messageId="m1" proposal={proposal} onConfirm={() => {}} onCancel={onCancelMock} />)

    const cancelBtn = screen.getByText('Cancel')
    fireEvent.click(cancelBtn)

    expect(onCancelMock).toHaveBeenCalledWith('m1')
  })
})
