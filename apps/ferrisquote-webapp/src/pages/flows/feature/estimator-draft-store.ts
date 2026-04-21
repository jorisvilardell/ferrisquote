import { create } from "zustand"
import type { Schemas } from "@/api/api.client"

/**
 * Ephemeral draft state for the estimator currently being edited in the
 * sidenav. Shared via Zustand so the canvas can overlay uncommitted edits
 * (input/output adds, deletes, patches + name/description) onto the server
 * data before building the graph.
 *
 * On Save / Cancel / estimator switch, the panel calls `clear()`.
 */

export const TEMP_PREFIX = "__new__:"

export type EstimatorDraftState = {
  estimatorId: string | null
  nameDraft: string | null
  descDraft: string | null

  // Inputs
  inputEdits: Record<string, Partial<Schemas.InputResponse>>
  pendingInputAdds: Schemas.InputResponse[]
  pendingInputDeletes: Set<string>

  // Outputs
  outputEdits: Record<string, Partial<Schemas.OutputResponse>>
  pendingOutputAdds: Schemas.OutputResponse[]
  pendingOutputDeletes: Set<string>

  setActive: (id: string | null) => void
  setName: (name: string | null) => void
  setDesc: (desc: string | null) => void

  patchInput: (id: string, patch: Partial<Schemas.InputResponse>) => void
  dropInputEdit: (id: string) => void
  addPendingInput: (v: Schemas.InputResponse) => void
  removePendingInput: (id: string) => void
  markInputDelete: (id: string) => void

  patchOutput: (id: string, patch: Partial<Schemas.OutputResponse>) => void
  dropOutputEdit: (id: string) => void
  addPendingOutput: (v: Schemas.OutputResponse) => void
  removePendingOutput: (id: string) => void
  markOutputDelete: (id: string) => void

  clear: () => void
}

const empty = {
  estimatorId: null,
  nameDraft: null,
  descDraft: null,
  inputEdits: {},
  pendingInputAdds: [],
  pendingInputDeletes: new Set<string>(),
  outputEdits: {},
  pendingOutputAdds: [],
  pendingOutputDeletes: new Set<string>(),
}

export const useEstimatorDraftStore = create<EstimatorDraftState>((set) => ({
  ...empty,

  setActive: (id) =>
    set((s) => (s.estimatorId === id ? s : { ...empty, estimatorId: id })),
  setName: (name) => set({ nameDraft: name }),
  setDesc: (desc) => set({ descDraft: desc }),

  patchInput: (id, patch) =>
    set((s) => ({
      inputEdits: { ...s.inputEdits, [id]: { ...(s.inputEdits[id] ?? {}), ...patch } },
    })),
  dropInputEdit: (id) =>
    set((s) => {
      if (!(id in s.inputEdits)) return s
      const next = { ...s.inputEdits }
      delete next[id]
      return { inputEdits: next }
    }),
  addPendingInput: (v) => set((s) => ({ pendingInputAdds: [...s.pendingInputAdds, v] })),
  removePendingInput: (id) =>
    set((s) => ({ pendingInputAdds: s.pendingInputAdds.filter((v) => v.id !== id) })),
  markInputDelete: (id) =>
    set((s) => {
      const next = new Set(s.pendingInputDeletes)
      next.add(id)
      const edits = { ...s.inputEdits }
      delete edits[id]
      return { pendingInputDeletes: next, inputEdits: edits }
    }),

  patchOutput: (id, patch) =>
    set((s) => ({
      outputEdits: { ...s.outputEdits, [id]: { ...(s.outputEdits[id] ?? {}), ...patch } },
    })),
  dropOutputEdit: (id) =>
    set((s) => {
      if (!(id in s.outputEdits)) return s
      const next = { ...s.outputEdits }
      delete next[id]
      return { outputEdits: next }
    }),
  addPendingOutput: (v) => set((s) => ({ pendingOutputAdds: [...s.pendingOutputAdds, v] })),
  removePendingOutput: (id) =>
    set((s) => ({ pendingOutputAdds: s.pendingOutputAdds.filter((v) => v.id !== id) })),
  markOutputDelete: (id) =>
    set((s) => {
      const next = new Set(s.pendingOutputDeletes)
      next.add(id)
      const edits = { ...s.outputEdits }
      delete edits[id]
      return { pendingOutputDeletes: next, outputEdits: edits }
    }),

  clear: () => set({ ...empty }),
}))

/** Apply pending drafts onto a server estimators array. Used by the canvas
 *  to render the "live" graph. */
export function overlayEstimators(
  estimators: Schemas.EstimatorResponse[],
  drafts: EstimatorDraftState,
): Schemas.EstimatorResponse[] {
  if (!drafts.estimatorId) return estimators
  return estimators.map((e) => {
    if (e.id !== drafts.estimatorId) return e

    const inputs: Schemas.InputResponse[] = [
      ...e.inputs
        .filter((v) => !drafts.pendingInputDeletes.has(v.id))
        .map((v) => ({ ...v, ...(drafts.inputEdits[v.id] ?? {}) })),
      ...drafts.pendingInputAdds,
    ]

    const outputs: Schemas.OutputResponse[] = [
      ...e.outputs
        .filter((v) => !drafts.pendingOutputDeletes.has(v.id))
        .map((v) => ({ ...v, ...(drafts.outputEdits[v.id] ?? {}) })),
      ...drafts.pendingOutputAdds,
    ]

    const name =
      drafts.nameDraft != null
        ? drafts.nameDraft.trim().replace(/\s+/g, "_") || e.name
        : e.name
    const description = drafts.descDraft != null ? drafts.descDraft : e.description

    return { ...e, name, description, inputs, outputs }
  })
}
