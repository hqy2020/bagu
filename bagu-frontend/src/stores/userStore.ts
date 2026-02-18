import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BaguUser } from '../api'

interface UserState {
  currentUser: BaguUser | null
  setCurrentUser: (user: BaguUser | null) => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),
    }),
    { name: 'bagu-user' }
  )
)
