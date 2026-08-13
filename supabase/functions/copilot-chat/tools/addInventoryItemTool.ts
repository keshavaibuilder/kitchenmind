import type { ActionProposal, ToolContext, ToolResult } from '../types.ts'
import { okResult, errResult } from '../types.ts'

interface AddInventoryItemInput {
  canonicalName: string
  quantityGrams: number
  category?: string
  lowStockThresholdGrams?: number
}

export function addInventoryItemTool(
  input: AddInventoryItemInput,
  _ctx: ToolContext
): Promise<ToolResult<ActionProposal>> {
  if (!input || !input.canonicalName || !input.quantityGrams) {
    return Promise.resolve(errResult<ActionProposal>('INVALID_INPUT', 'Missing canonicalName or quantityGrams', 'inventory'))
  }

  const category = input.category || 'Pantry'
  const lowStockThresholdGrams = input.lowStockThresholdGrams || 500

  const proposal: ActionProposal = {
    capabilityId: 'inventory.add_item',
    actionName: 'Add / Update Inventory Stock',
    payload: {
      canonicalName: input.canonicalName,
      quantityGrams: input.quantityGrams,
      category,
      lowStockThresholdGrams,
    },
    preview: {
      action: `Add ${input.quantityGrams}g of "${input.canonicalName}" to inventory`,
      affectedItems: [input.canonicalName],
      quantities: [`+${input.quantityGrams}g`],
      householdImpact: `Increases pantry stock balance and creates an active FIFO batch for ${input.canonicalName}.`,
      expectedResult: `Inventory item and batch updated in household database.`,
      irreversible: false,
    },
  }

  return Promise.resolve(okResult(proposal, 'inventory'))
}
