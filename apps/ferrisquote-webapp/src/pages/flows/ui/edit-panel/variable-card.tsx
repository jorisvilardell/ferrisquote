import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Trash2 } from "lucide-react"
import type { Schemas } from "@/api/api.client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  idsToNames,
  namesToIdsPreservingIds,
  type EstimatorIndex,
} from "@/pages/flows/lib/expression-refs"

const ROSE = "hsl(330, 80%, 60%)"
const AGG_FUNCTIONS = ["SUM", "AVG", "COUNT_ITER"] as const

type Suggestion = {
  label: string
  insert: string
  group: string
  groupLabel?: string
  isEstimator?: boolean
  estimatorId?: string
}

export function VariableCard({
  variable,
  ownEstimatorName,
  ownEstimatorVariables,
  availableFieldKeys,
  otherEstimators,
  estimatorsIndex,
  onUpdate,
  onDelete,
}: {
  variable: Schemas.VariableResponse
  ownEstimatorName: string
  ownEstimatorVariables: string[]
  availableFieldKeys: string[]
  otherEstimators: Array<{ id: string; name: string; variables: string[] }>
  estimatorsIndex: EstimatorIndex
  onUpdate: (variableId: string, patch: Partial<Schemas.VariableResponse>) => void
  onDelete: (variableId: string) => void
}) {
  const [expanded, setExpanded] = useState(!variable.expression)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionFilter, setSuggestionFilter] = useState("")
  const exprRef = useRef<HTMLTextAreaElement>(null)

  const displayExpression = idsToNames(variable.expression, estimatorsIndex)

  const [nameDraft, setNameDraft] = useState(variable.name)
  const [exprDraft, setExprDraft] = useState(displayExpression)
  const [descDraft, setDescDraft] = useState(variable.description)
  // Remember which estimator id was chosen for each `name.var` via autocomplete,
  // so free-form editing doesn't silently reroute to the first same-named estimator.
  const pickedIdsRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    setNameDraft(variable.name)
    setExprDraft(idsToNames(variable.expression, estimatorsIndex))
    setDescDraft(variable.description)
    pickedIdsRef.current = new Map()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variable.id, variable.name, variable.expression, variable.description])

  // Dropdown portal positioning — escapes all parent overflow clips
  const [dropdownPos, setDropdownPos] = useState<{
    top: number
    left: number
    width: number
    placement: "below" | "above"
  } | null>(null)

  useEffect(() => {
    if (!showSuggestions) {
      setDropdownPos(null)
      return
    }
    const el = exprRef.current
    if (!el) return

    function updatePos() {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const maxHeight = 240
      const placement: "below" | "above" =
        spaceBelow >= Math.min(maxHeight, 150) || spaceBelow >= spaceAbove
          ? "below"
          : "above"
      setDropdownPos({
        top: placement === "below" ? rect.bottom + 4 : rect.top - 4,
        left: rect.left,
        width: rect.width,
        placement,
      })
    }

    updatePos()
    window.addEventListener("scroll", updatePos, true)
    window.addEventListener("resize", updatePos)
    return () => {
      window.removeEventListener("scroll", updatePos, true)
      window.removeEventListener("resize", updatePos)
    }
  }, [showSuggestions])

  const filterLower = suggestionFilter.toLowerCase()
  const suggestions: Suggestion[] = [
    // Fields
    ...availableFieldKeys
      .filter((k) => k.toLowerCase().includes(filterLower))
      .map((k) => ({ label: `@${k}`, insert: `@${k}`, group: "Fields" })),
    // Functions
    ...AGG_FUNCTIONS
      .filter((fn) => fn.toLowerCase().includes(filterLower))
      .map((fn) => ({ label: `${fn}(@...)`, insert: `${fn}(@)`, group: "Functions" })),
    // Variables of the current estimator (bare references)
    ...ownEstimatorVariables
      .filter((v) => v.toLowerCase().includes(filterLower))
      .map((v) => ({
        label: `@${v}`,
        insert: `@${v}`,
        group: ownEstimatorName.replace(/_/g, " "),
        isEstimator: true,
      })),
    // Variables of other estimators (cross-references).
    // Group key uses estimator id so duplicates stay separate.
    ...otherEstimators.flatMap((est) => {
      const displayName = est.name.replace(/_/g, " ")
      return est.variables
        .filter((v) =>
          v.toLowerCase().includes(filterLower) ||
          `${est.name}.${v}`.toLowerCase().includes(filterLower) ||
          `${displayName}.${v}`.toLowerCase().includes(filterLower),
        )
        .map((v) => ({
          label: `@${displayName}.${v}`,
          insert: `@${est.name}.${v}`,
          group: `${displayName}\u0000${est.id}`,
          groupLabel: displayName,
          isEstimator: true,
          estimatorId: est.id,
        }))
    }),
  ]

  function insertSuggestion(s: Suggestion) {
    const el = exprRef.current
    if (!el) return
    const pos = el.selectionStart ?? el.value.length
    const before = el.value.substring(0, pos)
    const atPos = before.lastIndexOf("@")
    const start = atPos >= 0 ? atPos : pos
    const after = el.value.substring(pos)
    const newVal = el.value.substring(0, start) + s.insert + after
    setExprDraft(newVal)
    setShowSuggestions(false)

    if (s.estimatorId) {
      const est = estimatorsIndex.find((e) => e.id === s.estimatorId)
      const varName = s.insert.replace(/^@[^.]+\./, "")
      if (est) {
        pickedIdsRef.current.set(`${est.name}.${varName}`, s.estimatorId)
      }
    }

    const stored = namesToIdsPreservingIds(
      newVal,
      estimatorsIndex,
      variable.expression,
      pickedIdsRef.current,
    )
    onUpdate(variable.id, { expression: stored })

    requestAnimationFrame(() => {
      el.focus()
      const cursorPos = start + s.insert.length
      el.setSelectionRange(cursorPos, cursorPos)
    })
  }

  function handleExpressionChange(value: string) {
    setExprDraft(value)
    const el = exprRef.current
    if (el) {
      const pos = el.selectionStart ?? value.length
      const before = value.substring(0, pos)
      const atMatch = before.match(/@([A-Za-z0-9_.]*)$/)
      if (atMatch) {
        setSuggestionFilter(atMatch[1])
        setShowSuggestions(true)
      } else {
        setShowSuggestions(false)
      }
    }
  }

  const commitName = () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === variable.name) {
      setNameDraft(variable.name)
      return
    }
    onUpdate(variable.id, { name: trimmed })
  }
  const commitExpr = () => {
    if (!exprDraft.trim()) {
      setExprDraft(idsToNames(variable.expression, estimatorsIndex))
      return
    }
    const stored = namesToIdsPreservingIds(
      exprDraft,
      estimatorsIndex,
      variable.expression,
      pickedIdsRef.current,
    )
    if (stored === variable.expression) return
    onUpdate(variable.id, { expression: stored })
  }
  const commitDesc = () => {
    if (descDraft === variable.description) return
    onUpdate(variable.id, { description: descDraft })
  }

  return (
    <div className="rounded-md border border-border/60 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/30">
        <button
          className="flex-1 text-left"
          onClick={() => setExpanded((p) => !p)}
        >
          <span className="text-sm font-mono font-semibold" style={{ color: ROSE }}>
            {variable.name}
          </span>
          {!expanded && variable.expression && (
            <span className="text-xs text-muted-foreground ml-2 font-mono">
              = {variable.expression.length > 20 ? variable.expression.slice(0, 20) + "..." : variable.expression}
            </span>
          )}
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive shrink-0">
              <Trash2 className="w-3 h-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete variable?</AlertDialogTitle>
              <AlertDialogDescription>
                "{variable.name}" will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => onDelete(variable.id)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-3 py-2.5 space-y-2.5 border-t border-border/40">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Name</Label>
            <Input
              className="h-7 text-sm font-mono"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                if (e.key === "Escape") {
                  setNameDraft(variable.name)
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
            />
          </div>

          {/* Expression */}
          <div className="flex flex-col gap-1 relative">
            <Label className="text-xs">Expression</Label>
            <Textarea
              ref={exprRef}
              className="text-sm font-mono min-h-[60px] resize-none"
              placeholder="e.g. @surface * @prix_unitaire * 1.2"
              value={exprDraft}
              onChange={(e) => handleExpressionChange(e.target.value)}
              onFocus={() => {
                if (!exprDraft) setShowSuggestions(true)
              }}
              onBlur={() => {
                setTimeout(() => {
                  setShowSuggestions(false)
                  commitExpr()
                }, 200)
              }}
            />
            {showSuggestions && suggestions.length > 0 && dropdownPos &&
              createPortal(
                <div
                  style={{
                    position: "fixed",
                    top: dropdownPos.placement === "below" ? dropdownPos.top : undefined,
                    bottom:
                      dropdownPos.placement === "above"
                        ? window.innerHeight - dropdownPos.top
                        : undefined,
                    left: dropdownPos.left,
                    width: dropdownPos.width,
                    zIndex: 9999,
                  }}
                  className="max-h-60 overflow-y-auto rounded-md border bg-popover shadow-md"
                >
                  {suggestions.map((s, i) => {
                    const prevGroup = i > 0 ? suggestions[i - 1].group : null
                    const showGroupLabel = s.group !== prevGroup
                    return (
                      <div key={`${s.group}-${s.insert}`}>
                        {showGroupLabel && (
                          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {s.groupLabel ?? s.group}
                          </div>
                        )}
                        <button
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-accent transition-colors",
                            s.isEstimator && "text-[hsl(330,70%,60%)]",
                          )}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            insertSuggestion(s)
                          }}
                        >
                          {s.label}
                        </button>
                      </div>
                    )
                  })}
                </div>,
                document.body,
              )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Description</Label>
            <Input
              className="h-7 text-sm"
              placeholder="Optional"
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={commitDesc}
            />
          </div>
        </div>
      )}
    </div>
  )
}
