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
const EMERALD = "hsl(158, 64%, 52%)"
const FIELD_ORANGE = "hsl(28, 85%, 55%)"
const AGG_FUNCTIONS = ["SUM", "AVG", "COUNT_ITER"] as const

/** Split the expression into colored spans so the overlay layer shows
 *  @field / @input / @output / @cross refs in their reference colors.
 *  Cross-refs use the display form `@EstName.var` after idsToNames. */
function renderHighlighted(
  expr: string,
  inputKeys: string[],
  outputKeys: string[],
  fieldKeys: string[],
): React.ReactNode[] {
  const inputs = new Set(inputKeys)
  const outputs = new Set(outputKeys)
  const fields = new Set(fieldKeys)
  const nodes: React.ReactNode[] = []
  // Matches @Name.var (cross-estimator display form) or @identifier
  const re = /@([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)?)/g
  let lastIdx = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(expr)) !== null) {
    if (m.index > lastIdx) nodes.push(expr.slice(lastIdx, m.index))
    const body = m[1]
    let color: string | undefined
    if (body.includes(".")) color = ROSE
    else if (inputs.has(body)) color = EMERALD
    else if (outputs.has(body)) color = ROSE
    else if (fields.has(body)) color = FIELD_ORANGE
    nodes.push(
      <span key={`t-${key++}`} style={color ? { color } : undefined}>
        {m[0]}
      </span>,
    )
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < expr.length) nodes.push(expr.slice(lastIdx))
  // Trailing newline needed so the overlay matches the textarea's line count
  // when the user ends with a newline (textarea reserves a blank line, div
  // would otherwise collapse it).
  nodes.push(" ")
  return nodes
}

type Suggestion = {
  label: string
  insert: string
  group: string
  groupLabel?: string
  isEstimator?: boolean
  isInput?: boolean
  estimatorId?: string
}

export function OutputCard({
  output,
  expanded,
  onToggle,
  ownEstimatorName,
  ownInputKeys,
  ownOutputKeys,
  availableFieldKeys,
  otherEstimators,
  estimatorsIndex,
  onUpdate,
  onDelete,
}: {
  output: Schemas.OutputResponse
  expanded: boolean
  onToggle: () => void
  ownEstimatorName: string
  ownInputKeys: string[]
  ownOutputKeys: string[]
  availableFieldKeys: string[]
  otherEstimators: Array<{ id: string; name: string; outputs: string[] }>
  estimatorsIndex: EstimatorIndex
  onUpdate: (outputId: string, patch: Partial<Schemas.OutputResponse>) => void
  onDelete: (outputId: string) => void
}) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionFilter, setSuggestionFilter] = useState("")
  const exprRef = useRef<HTMLTextAreaElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const displayExpression = idsToNames(output.expression, estimatorsIndex)

  const [keyDraft, setKeyDraft] = useState(output.key)
  const [exprDraft, setExprDraft] = useState(displayExpression)
  const [descDraft, setDescDraft] = useState(output.description)
  const pickedIdsRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    setKeyDraft(output.key)
    setExprDraft(idsToNames(output.expression, estimatorsIndex))
    setDescDraft(output.description)
    pickedIdsRef.current = new Map()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [output.id, output.key, output.expression, output.description])

  useEffect(() => {
    if (expanded) {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [expanded])

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
    ...availableFieldKeys
      .filter((k) => k.toLowerCase().includes(filterLower))
      .map((k) => ({ label: `@${k}`, insert: `@${k}`, group: "Fields" })),
    ...AGG_FUNCTIONS
      .filter((fn) => fn.toLowerCase().includes(filterLower))
      .map((fn) => ({ label: `${fn}(@...)`, insert: `${fn}(@)`, group: "Functions" })),
    ...ownInputKeys
      .filter((k) => k.toLowerCase().includes(filterLower))
      .map((k) => ({
        label: `@${k}`,
        insert: `@${k}`,
        group: "Inputs",
        isInput: true,
      })),
    ...ownOutputKeys
      .filter((k) => k.toLowerCase().includes(filterLower))
      .map((k) => ({
        label: `@${k}`,
        insert: `@${k}`,
        group: ownEstimatorName.replace(/_/g, " "),
        isEstimator: true,
      })),
    ...otherEstimators.flatMap((est) => {
      const displayName = est.name.replace(/_/g, " ")
      return est.outputs
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
      output.expression,
      pickedIdsRef.current,
    )
    onUpdate(output.id, { expression: stored })

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

  const commitKey = () => {
    const trimmed = keyDraft.trim()
    if (!trimmed || trimmed === output.key) {
      setKeyDraft(output.key)
      return
    }
    onUpdate(output.id, { key: trimmed })
  }
  const commitExpr = () => {
    if (!exprDraft.trim()) {
      setExprDraft(idsToNames(output.expression, estimatorsIndex))
      return
    }
    const stored = namesToIdsPreservingIds(
      exprDraft,
      estimatorsIndex,
      output.expression,
      pickedIdsRef.current,
    )
    if (stored === output.expression) return
    onUpdate(output.id, { expression: stored })
  }
  const commitDesc = () => {
    if (descDraft === output.description) return
    onUpdate(output.id, { description: descDraft })
  }

  return (
    <div ref={rootRef} className="rounded-md border border-border/60 overflow-hidden shrink-0">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/30">
        <button className="flex-1 text-left" onClick={onToggle}>
          <span className="text-sm font-mono font-semibold" style={{ color: ROSE }}>
            {output.key}
          </span>
          {!expanded && output.expression && (
            <span className="text-xs text-muted-foreground ml-2 font-mono">
              = {output.expression.length > 20 ? output.expression.slice(0, 20) + "..." : output.expression}
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
              <AlertDialogTitle>Delete output?</AlertDialogTitle>
              <AlertDialogDescription>
                "{output.key}" will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => onDelete(output.id)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {expanded && (
        <div className="px-3 py-2.5 space-y-2.5 border-t border-border/40">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Key</Label>
            <Input
              className="h-7 text-sm font-mono"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              onBlur={commitKey}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                if (e.key === "Escape") {
                  setKeyDraft(output.key)
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
            />
          </div>

          <div className="flex flex-col gap-1 relative">
            <Label className="text-xs">Expression</Label>
            <div className="relative">
              {/* Syntax-highlighted layer sits behind a transparent textarea.
                  Both share identical font + padding so glyphs align. The
                  textarea keeps all interaction (caret, selection, input);
                  the layer only paints colored tokens. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words font-mono text-sm px-3 py-2 rounded-md text-foreground"
              >
                {renderHighlighted(
                  exprDraft,
                  ownInputKeys,
                  ownOutputKeys,
                  availableFieldKeys,
                )}
              </div>
              <Textarea
                ref={exprRef}
                className="relative text-sm font-mono min-h-[60px] resize-none bg-transparent text-foreground"
                style={{
                  // Keep `color` at the theme foreground so the caret is
                  // visible — only the glyph *fill* is transparent, so the
                  // overlay layer handles rendering.
                  WebkitTextFillColor: "transparent",
                }}
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
            </div>
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
                          )}
                          style={{
                            color: s.isInput
                              ? EMERALD
                              : s.isEstimator
                                ? ROSE
                                : undefined,
                          }}
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
