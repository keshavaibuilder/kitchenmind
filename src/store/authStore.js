import { create } from 'zustand'

const useAuthStore = create((set) => ({
  user: null,
  session: null,
  household_id: null,
  loading: true,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setHouseholdId: (household_id) => set({ household_id }),
  signOut: () => set({ user: null, session: null, household_id: null }),
}))

export default useAuthStore
