import { create } from 'zustand'

let idCounter = 0

/**
 * Global toast store (zustand, matching the existing authStore pattern rather than
 * introducing a React Context + provider for what's otherwise the same kind of global state).
 */
const useToastStore = create((set) => ({
  toasts: [],
  showToast: (message, { type = 'info', duration = 3000 } = {}) => {
    const id = ++idCounter
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
    return id
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export function useToast() {
  const showToast = useToastStore((state) => state.showToast)
  const dismissToast = useToastStore((state) => state.dismissToast)
  return { showToast, dismissToast }
}

export default useToastStore
