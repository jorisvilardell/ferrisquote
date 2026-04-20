import { useCallback, useEffect, useState } from "react"
import type { Schemas } from "@/api/api.client"

export type LinkingMode = false | "form" | "quick"

/**
 * Field-node linking mode: when user drops a field on empty canvas or clicks
 * the field toolbar button, we enter linking mode so they can pick a target
 * step. Escape or pane click cancels; entering mode auto-fits view to all
 * steps so the user can scan them without scrolling.
 */
export function useLinkingMode(
  flow: Schemas.FlowResponse | null,
  fitView: (opts: {
    nodes: { id: string }[]
    padding?: number
    duration?: number
  }) => void,
) {
  const [linkingField, setLinkingField] = useState<LinkingMode>(false)

  // Cancel linking on Escape
  useEffect(() => {
    if (!linkingField) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLinkingField(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [linkingField])

  // Fit view to all step nodes when linking starts
  useEffect(() => {
    if (!linkingField) return
    const stepIds = flow?.steps.map((s) => ({ id: s.id })) ?? []
    if (stepIds.length === 0) return
    requestAnimationFrame(() => {
      fitView({ nodes: stepIds, padding: 0.2, duration: 400 })
    })
  }, [linkingField, flow, fitView])

  const cancel = useCallback(() => setLinkingField(false), [])

  return { linkingField, setLinkingField, cancel }
}
