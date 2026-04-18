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

// ─── Variables ────────────────────────────────────────────────────────────────

export const useAddVariable = (flowId: string, estimatorId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("post", "/api/v1/estimators/{estimator_id}/variables").mutationOptions,
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

export const useUpdateVariable = (flowId: string, estimatorId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("put", "/api/v1/variables/{variable_id}").mutationOptions,
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

export const useRemoveVariable = (flowId: string, estimatorId: string) => {
  const qc = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation("delete", "/api/v1/variables/{variable_id}").mutationOptions,
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

// ─── Evaluation ───────────────────────────────────────────────────────────────

export const useEvaluateEstimator = () =>
  useMutation({
    ...window.tanstackApi.mutation("post", "/api/v1/estimators/{estimator_id}/evaluate").mutationOptions,
  })

// ─── Re-export types ──────────────────────────────────────────────────────────

export type { Schemas }
