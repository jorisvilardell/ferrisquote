import { create } from "zustand"
import { persist } from "zustand/middleware"

type FlowStore = {
  lastFlowId: string | null
  setLastFlowId: (id: string) => void
}

export const useFlowStore = create<FlowStore>()(
  persist(
    (set) => ({
      lastFlowId: null,
      setLastFlowId: (id) => set({ lastFlowId: id }),
    }),
    { name: "flow-store" }
  )
)
