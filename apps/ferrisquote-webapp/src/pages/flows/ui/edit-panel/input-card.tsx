import { useEffect, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const EMERALD = "hsl(158, 64%, 52%)"

type ParamKind = Schemas.EstimatorParameterTypeDto["kind"]

function paramKindOf(pt: Schemas.EstimatorParameterTypeDto): ParamKind {
  return pt.kind
}

function paramLabelFilter(pt: Schemas.EstimatorParameterTypeDto): string {
  return pt.kind === "product" ? pt.label_filter ?? "" : ""
}

function buildParamType(kind: ParamKind, labelFilter: string): Schemas.EstimatorParameterTypeDto {
  if (kind === "product") return { kind: "product", label_filter: labelFilter || null }
  return { kind }
}

export function InputCard({
  input,
  onUpdate,
  onDelete,
}: {
  input: Schemas.InputResponse
  onUpdate: (inputId: string, patch: Partial<Schemas.InputResponse>) => void
  onDelete: (inputId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [keyDraft, setKeyDraft] = useState(input.key)
  const [descDraft, setDescDraft] = useState(input.description)
  const [kindDraft, setKindDraft] = useState<ParamKind>(paramKindOf(input.parameter_type))
  const [labelFilterDraft, setLabelFilterDraft] = useState(paramLabelFilter(input.parameter_type))

  useEffect(() => {
    setKeyDraft(input.key)
    setDescDraft(input.description)
    setKindDraft(paramKindOf(input.parameter_type))
    setLabelFilterDraft(paramLabelFilter(input.parameter_type))
  }, [input.id, input.key, input.description, input.parameter_type])

  const commitKey = () => {
    const trimmed = keyDraft.trim()
    if (!trimmed || trimmed === input.key) {
      setKeyDraft(input.key)
      return
    }
    onUpdate(input.id, { key: trimmed })
  }
  const commitDesc = () => {
    if (descDraft === input.description) return
    onUpdate(input.id, { description: descDraft })
  }
  const commitKind = (next: ParamKind) => {
    setKindDraft(next)
    onUpdate(input.id, { parameter_type: buildParamType(next, labelFilterDraft) })
  }
  const commitLabelFilter = () => {
    if (kindDraft !== "product") return
    if (labelFilterDraft === paramLabelFilter(input.parameter_type)) return
    onUpdate(input.id, { parameter_type: buildParamType("product", labelFilterDraft) })
  }

  return (
    <div className="rounded-md border border-border/60 overflow-hidden shrink-0">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/30">
        <button className="flex-1 text-left" onClick={() => setExpanded((p) => !p)}>
          <span className="text-sm font-mono font-semibold" style={{ color: EMERALD }}>
            {input.key}
          </span>
          <span className="text-xs text-muted-foreground ml-2">
            : {input.parameter_type.kind}
            {input.parameter_type.kind === "product" && input.parameter_type.label_filter
              ? ` (${input.parameter_type.label_filter})`
              : ""}
          </span>
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive shrink-0">
              <Trash2 className="w-3 h-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete input?</AlertDialogTitle>
              <AlertDialogDescription>
                "{input.key}" will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => onDelete(input.id)}
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
                  setKeyDraft(input.key)
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Type</Label>
            <Select value={kindDraft} onValueChange={(v) => commitKind(v as ParamKind)}>
              <SelectTrigger className="h-7 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="product">Product</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kindDraft === "product" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Label filter (optional)</Label>
              <Input
                className="h-7 text-sm font-mono"
                placeholder="e.g. socket, lamp"
                value={labelFilterDraft}
                onChange={(e) => setLabelFilterDraft(e.target.value)}
                onBlur={commitLabelFilter}
              />
            </div>
          )}

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
