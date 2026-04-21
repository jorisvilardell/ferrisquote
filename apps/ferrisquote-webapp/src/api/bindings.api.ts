import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Schemas } from "@/api/api.client"

// ─── Bindings ─────────────────────────────────────────────────────────────────

export const useBindings = (flowId: string) =>
  useQuery({
    ...window.tanstackApi.get("/api/v1/flows/{flow_id}/bindings", {
      path: { flow_id: flowId },
    }).queryOptions,
    enabled: !!flowId,
  })

function invalidateFlow(
  qc: ReturnType<typeof useQueryClient>,
  flowId: string,
) {
  return qc.invalidateQueries({
    queryKey: window.tanstackApi.get("/api/v1/flows/{flow_id}/bindings", {
      path: { flow_id: flowId },
    }).queryKey,
  })
}

export const useCreateBinding = (flowId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("post", "/api/v1/flows/{flow_id}/bindings").mutationOptions,
    onSuccess: () => invalidateFlow(qc, flowId),
  })
}

export const useUpdateBinding = (flowId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("put", "/api/v1/flows/{flow_id}/bindings/{binding_id}").mutationOptions,
    onSuccess: () => invalidateFlow(qc, flowId),
  })
}

export const useDeleteBinding = (flowId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("delete", "/api/v1/flows/{flow_id}/bindings/{binding_id}").mutationOptions,
    onSuccess: () => invalidateFlow(qc, flowId),
  })
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

export const useEvaluateBindings = () =>
  useMutation({
    ...window.tanstackApi.mutation("post", "/api/v1/flows/{flow_id}/evaluate-bindings").mutationOptions,
  })

export const usePreviewFlow = () =>
  useMutation({
    ...window.tanstackApi.mutation("post", "/api/v1/flows/{flow_id}/evaluate-bindings-preview").mutationOptions,
  })

export type { Schemas }
