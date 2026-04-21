import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Schemas } from "@/api/api.client"

// ─── Estimators ───────────────────────────────────────────────────────────────

export const useEstimators = (flowId: string) =>
  useQuery({
    ...window.tanstackApi.get("/api/v1/flows/{flow_id}/estimators", {
      path: { flow_id: flowId },
    }).queryOptions,
    enabled: !!flowId,
  })

export const useEstimator = (estimatorId: string) =>
  useQuery({
    ...window.tanstackApi.get("/api/v1/estimators/{estimator_id}", {
      path: { estimator_id: estimatorId },
    }).queryOptions,
    enabled: !!estimatorId,
  })

export const useCreateEstimator = (flowId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("post", "/api/v1/flows/{flow_id}/estimators").mutationOptions,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: window.tanstackApi.get("/api/v1/flows/{flow_id}/estimators", {
          path: { flow_id: flowId },
        }).queryKey,
      }),
  })
}

export const useUpdateEstimator = (flowId: string, estimatorId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("put", "/api/v1/estimators/{estimator_id}").mutationOptions,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({
          queryKey: window.tanstackApi.get("/api/v1/flows/{flow_id}/estimators", {
            path: { flow_id: flowId },
          }).queryKey,
        }),
        qc.invalidateQueries({
          queryKey: window.tanstackApi.get("/api/v1/estimators/{estimator_id}", {
            path: { estimator_id: estimatorId },
          }).queryKey,
        }),
      ]),
  })
}

export const useDeleteEstimator = (flowId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("delete", "/api/v1/estimators/{estimator_id}").mutationOptions,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: window.tanstackApi.get("/api/v1/flows/{flow_id}/estimators", {
          path: { flow_id: flowId },
        }).queryKey,
      }),
  })
}

// ─── Shared cache invalidator for signature mutations ─────────────────────────

function invalidateEstimator(qc: ReturnType<typeof useQueryClient>, flowId: string, estimatorId: string) {
  return Promise.all([
    qc.invalidateQueries({
      queryKey: window.tanstackApi.get("/api/v1/flows/{flow_id}/estimators", {
        path: { flow_id: flowId },
      }).queryKey,
    }),
    qc.invalidateQueries({
      queryKey: window.tanstackApi.get("/api/v1/estimators/{estimator_id}", {
        path: { estimator_id: estimatorId },
      }).queryKey,
    }),
  ])
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

export const useAddInput = (flowId: string, estimatorId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("post", "/api/v1/estimators/{estimator_id}/inputs").mutationOptions,
    onSuccess: () => invalidateEstimator(qc, flowId, estimatorId),
  })
}

export const useUpdateInput = (flowId: string, estimatorId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("put", "/api/v1/estimators/{estimator_id}/inputs/{input_id}").mutationOptions,
    onSuccess: () => invalidateEstimator(qc, flowId, estimatorId),
  })
}

export const useRemoveInput = (flowId: string, estimatorId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("delete", "/api/v1/estimators/{estimator_id}/inputs/{input_id}").mutationOptions,
    onSuccess: () => invalidateEstimator(qc, flowId, estimatorId),
  })
}

// ─── Outputs ──────────────────────────────────────────────────────────────────

export const useAddOutput = (flowId: string, estimatorId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("post", "/api/v1/estimators/{estimator_id}/outputs").mutationOptions,
    onSuccess: () => invalidateEstimator(qc, flowId, estimatorId),
  })
}

export const useUpdateOutput = (flowId: string, estimatorId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("put", "/api/v1/estimators/{estimator_id}/outputs/{output_id}").mutationOptions,
    onSuccess: () => invalidateEstimator(qc, flowId, estimatorId),
  })
}

export const useRemoveOutput = (flowId: string, estimatorId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("delete", "/api/v1/estimators/{estimator_id}/outputs/{output_id}").mutationOptions,
    onSuccess: () => invalidateEstimator(qc, flowId, estimatorId),
  })
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

export const useEvaluateEstimator = () =>
  useMutation({
    ...window.tanstackApi.mutation("post", "/api/v1/estimators/{estimator_id}/evaluate").mutationOptions,
  })

// ─── Re-export types ──────────────────────────────────────────────────────────

export type { Schemas }
