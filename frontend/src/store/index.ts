import { create } from 'zustand'
import { createAuthSlice, type AuthSlice } from './authSlice'

export type StoreState = AuthSlice

export const useStore = create<StoreState>()((...args) => ({
  ...createAuthSlice(...args),
}))
