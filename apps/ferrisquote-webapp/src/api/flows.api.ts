import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Schemas } from "@/api/api.client"

// ─── Flows ────────────────────────────────────────────────────────────────────

export const useListFlows = () =>
  useQuery({
    ...window.tanstackApi.get("/api/v1/flows").queryOptions,
  })

export const useGetFlow = (flowId: string) =>
  useQuery({
    ...window.tanstackApi.get("/api/v1/flows/{flow_id}", {
      path: { flow_id: flowId },
    }).queryOptions,
    enabled: !!flowId,
  })

export const useCreateFlow = () => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("post", "/api/v1/flows").mutationOptions,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: window.tanstackApi.get("/api/v1/flows").queryKey,
      }),
  })
}

export const useUpdateFlow = (flowId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("put", "/api/v1/flows/{flow_id}").mutationOptions,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({
          queryKey: window.tanstackApi.get("/api/v1/flows").queryKey,
        }),
        qc.invalidateQueries({
          queryKey: window.tanstackApi.get("/api/v1/flows/{flow_id}", {
            path: { flow_id: flowId },
          }).queryKey,
        }),
      ]),
  })
}

export const useDeleteFlow = () => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("delete", "/api/v1/flows/{flow_id}").mutationOptions,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: window.tanstackApi.get("/api/v1/flows").queryKey,
      }),
  })
}

// ─── Steps ────────────────────────────────────────────────────────────────────

export const useAddStep = (flowId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("post", "/api/v1/flows/{flow_id}/steps").mutationOptions,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: window.tanstackApi.get("/api/v1/flows/{flow_id}", {
          path: { flow_id: flowId },
        }).queryKey,
      }),
  })
}

export const useRemoveStep = (flowId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("delete", "/api/v1/flows/steps/{step_id}").mutationOptions,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: window.tanstackApi.get("/api/v1/flows/{flow_id}", {
          path: { flow_id: flowId },
        }).queryKey,
      }),
  })
}

export const useUpdateStep = (flowId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("put", "/api/v1/flows/steps/{step_id}").mutationOptions,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: window.tanstackApi.get("/api/v1/flows/{flow_id}", {
          path: { flow_id: flowId },
        }).queryKey,
      }),
  })
}

export const useReorderStep = (flowId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("put", "/api/v1/flows/steps/{step_id}/reorder").mutationOptions,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: window.tanstackApi.get("/api/v1/flows/{flow_id}", {
          path: { flow_id: flowId },
        }).queryKey,
      }),
  })
}

// ─── Fields ───────────────────────────────────────────────────────────────────

export const useAddField = (flowId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("post", "/api/v1/flows/steps/{step_id}/fields").mutationOptions,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: window.tanstackApi.get("/api/v1/flows/{flow_id}", {
          path: { flow_id: flowId },
        }).queryKey,
      }),
  })
}

export const useUpdateField = (flowId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("put", "/api/v1/flows/fields/{field_id}").mutationOptions,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: window.tanstackApi.get("/api/v1/flows/{flow_id}", {
          path: { flow_id: flowId },
        }).queryKey,
      }),
  })
}

export const useRemoveField = (flowId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("delete", "/api/v1/flows/fields/{field_id}").mutationOptions,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: window.tanstackApi.get("/api/v1/flows/{flow_id}", {
          path: { flow_id: flowId },
        }).queryKey,
      }),
  })
}

export const useMoveField = (flowId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("put", "/api/v1/flows/fields/{field_id}/move").mutationOptions,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: window.tanstackApi.get("/api/v1/flows/{flow_id}", {
          path: { flow_id: flowId },
        }).queryKey,
      }),
  })
}

// ─── Re-export types ──────────────────────────────────────────────────────────

export type { Schemas }
