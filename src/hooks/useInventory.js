import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { InventoryService } from '@/services/InventoryService'
import { InventoryConsumptionService } from '@/services/InventoryConsumptionService'
import { gramsToAndaaza } from '@/lib/andaaza'
import { formatInventoryQuantity } from '@/lib/quantityFormat'
import useAuthStore from '@/store/authStore'

function enrichItem(item) {
  // Scanned-bill items (and any item that has been reconciled with real purchase data)
  // carry base_unit — use the deterministic, real-unit formatter for those. Only fall back
  // to the legacy qualitative buckets for rows with no semantic data at all (pre-migration
  // records, or manual AddItem entries that never had a real unit to begin with).
  const semantic = formatInventoryQuantity(item)
  if (semantic) {
    return { ...item, display_quantity: semantic.primary, display_quantity_detail: semantic.secondary }
  }

  // Eggs and piece-counted items: display count directly
  if (item.display_unit === 'pcs') {
    return { ...item, display_quantity: `${item.quantity_grams} pcs`, display_quantity_detail: null }
  }
  return {
    ...item,
    display_quantity: gramsToAndaaza(item.quantity_grams, item.category),
    display_quantity_detail: null,
  }
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    const aLow = a.low_stock_threshold > 0 && a.quantity_grams <= a.low_stock_threshold
    const bLow = b.low_stock_threshold > 0 && b.quantity_grams <= b.low_stock_threshold
    if (aLow && !bLow) return -1
    if (!aLow && bLow) return  1
    return a.canonical_name.localeCompare(b.canonical_name)
  })
}

export function useInventory() {
  const queryClient = useQueryClient()
  const { household_id } = useAuthStore()

  // 1. Fetch inventory items via InventoryService
  const query = useQuery({
    queryKey: ['inventory', household_id],
    queryFn: async () => {
      const data = await InventoryService.getInventory(household_id)
      return sortItems((data || []).map(enrichItem))
    },
    enabled: !!household_id,
  })

  // 2. Add/Upsert item mutation with automatic query invalidation
  const addItemMutation = useMutation({
    mutationFn: (itemPayload) => InventoryService.addOrUpdateItem(household_id, itemPayload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', household_id] })
    },
  })

  // 3. Update item mutation with automatic query invalidation
  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, updates }) => InventoryService.updateItem(itemId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', household_id] })
    },
  })

  // 4. Delete item mutation with automatic query invalidation
  const deleteItemMutation = useMutation({
    mutationFn: (itemId) => InventoryService.deleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', household_id] })
    },
  })

  // 5. Manual consumption mutation ("I used 500ml mustard oil") with automatic invalidation
  const consumeItemMutation = useMutation({
    mutationFn: ({ itemId, item, quantity, unit }) =>
      InventoryConsumptionService.consumeItem(household_id, { itemId, item, quantity, unit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', household_id] })
    },
  })

  return {
    items:     query.data ?? [],
    isLoading: query.isLoading,
    error:     query.error,
    refetch:   query.refetch,

    // Mutation operations & states
    addItem:     addItemMutation.mutateAsync,
    isAdding:    addItemMutation.isPending,
    updateItem:  updateItemMutation.mutateAsync,
    isUpdating:  updateItemMutation.isPending,
    deleteItem:  deleteItemMutation.mutateAsync,
    isDeleting:  deleteItemMutation.isPending,
    consumeItem:   consumeItemMutation.mutateAsync,
    isConsuming:   consumeItemMutation.isPending,
    consumeError:  consumeItemMutation.error,
  }
}

export function useInventoryByCategory(category) {
  const { items, isLoading, error, refetch } = useInventory()

  const filtered =
    !category || category === 'All'
      ? items
      : items.filter((i) => i.category === category)

  return { items: filtered, isLoading, error, refetch }
}
