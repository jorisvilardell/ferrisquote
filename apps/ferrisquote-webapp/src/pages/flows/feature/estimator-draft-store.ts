import { create } from "zustand"
import type { Schemas } from "@/api/api.client"

/**
 * Ephemeral draft state for the estimator currently being edited in the
 * sidenav. Shared via Zustand so the canvas can overlay uncommitted edits
 * (variable adds/deletes/patches, name, description) onto the server data
 * before building the graph — the map stays "live" as the user types.
 *
 * On Save / Cancel / estimator switch, the panel calls `clear()`.
 */

export const TEMP_PREFIX = "__new__:"

export type EstimatorDraftState = {
  estimatorId: string | null
  nameDraft: string | null
  descDraft: string | null
  variableEdits: Record<string, Partial<Schemas.VariableResponse>>
  pendingAdds: Schemas.VariableResponse[]
  pendingDeletes: Set<string>

  setActive: (id: string | null) => void
  setName: (name: string | null) => void
  setDesc: (desc: string | null) => void
  patchVariable: (id: string, patch: Partial<Schemas.VariableResponse>) => void
  dropVariableEdit: (id: string) => void
  addPending: (v: Schemas.VariableResponse) => void
  removePending: (id: string) => void
  markDelete: (id: string) => void
  clear: () => void
}

const empty = {
  estimatorId: null,
  nameDraft: null,
  descDraft: null,
  variableEdits: {},
  pendingAdds: [],
  pendingDeletes: new Set<string>(),
}

export const useEstimatorDraftStore = create<EstimatorDraftState>((set) => ({
  ...empty,

  setActive: (id) =>
    set((s) =>
      s.estimatorId === id ? s : { ...empty, estimatorId: id },
    ),
  setName: (name) => set({ nameDraft: name }),
  setDesc: (desc) => set({ descDraft: desc }),
  patchVariable: (id, patch) =>
    set((s) => ({
      variableEdits: {
        ...s.variableEdits,
        [id]: { ...(s.variableEdits[id] ?? {}), ...patch },
      },
    })),
  dropVariableEdit: (id) =>
    set((s) => {
      if (!(id in s.variableEdits)) return s
      const next = { ...s.variableEdits }
      delete next[id]
      return { variableEdits: next }
    }),
  addPending: (v) => set((s) => ({ pendingAdds: [...s.pendingAdds, v] })),
  removePending: (id) =>
    set((s) => ({ pendingAdds: s.pendingAdds.filter((v) => v.id !== id) })),
  markDelete: (id) =>
    set((s) => {
      const next = new Set(s.pendingDeletes)
      next.add(id)
      const edits = { ...s.variableEdits }
      delete edits[id]
      return { pendingDeletes: next, variableEdits: edits }
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

    const variables: Schemas.VariableResponse[] = [
      ...e.variables
        .filter((v) => !drafts.pendingDeletes.has(v.id))
        .map((v) => ({ ...v, ...(drafts.variableEdits[v.id] ?? {}) })),
      ...drafts.pendingAdds,
    ]

    const name =
      drafts.nameDraft != null
        ? drafts.nameDraft.trim().replace(/\s+/g, "_") || e.name
        : e.name
    const description = drafts.descDraft != null ? drafts.descDraft : e.description

    return { ...e, name, description, variables }
  })
}
