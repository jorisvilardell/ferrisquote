import { useEffect, useMemo, useRef, useState } from "react"
import { Calculator, Delete, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { EstimatorIndex } from "@/pages/flows/lib/expression-refs"
import {
  serialize,
  tokenize,
  validateTiles,
  type Tile,
  type ValidationError,
} from "@/pages/flows/lib/expression-parser"

const ROSE = "hsl(330, 80%, 60%)"
const EMERALD = "hsl(158, 64%, 52%)"
const AMBER = "hsl(38, 92%, 50%)"
const VIOLET = "hsl(262, 83%, 65%)"

export type RepeatableField = {
  key: string
  label: string
  stepKey: string
  stepTitle: string
}
export type RepeatableStep = { key: string; title: string }

type Props = {
  value: string
  onChange: (next: string) => void
  ownInputKeys: string[]
  ownOutputKeys: string[]
  otherEstimators: Array<{ id: string; name: string; outputs: string[] }>
  estimatorsIndex: EstimatorIndex
  repeatableFields: RepeatableField[]
  repeatableSteps: RepeatableStep[]
}

type AggDraft = { fn: "SUM" | "AVG" | "COUNT_ITER" } | null

export function ExpressionBuilder({
  value,
  onChange,
  ownInputKeys,
  ownOutputKeys,
  otherEstimators,
  estimatorsIndex,
  repeatableFields,
  repeatableSteps,
}: Props) {
  const { t } = useTranslation()

  const ctx = useMemo(
    () => ({
      inputKeys: new Set(ownInputKeys),
      outputKeys: new Set(ownOutputKeys),
      estimators: estimatorsIndex,
      fieldLabels: new Map(repeatableFields.map((f) => [f.key, f.label])),
      stepLabels: new Map(repeatableSteps.map((s) => [s.key, s.title])),
    }),
    [
      ownInputKeys,
      ownOutputKeys,
      estimatorsIndex,
      repeatableFields,
      repeatableSteps,
    ],
  )

  const [tiles, setTiles] = useState<Tile[]>(() => tokenize(value, ctx))
  const [cursor, setCursor] = useState<number>(() => tokenize(value, ctx).length)
  const [aggDraft, setAggDraft] = useState<AggDraft>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastEmittedRef = useRef<string>(value)

  // Re-hydrate when the stored expression changes from the outside
  // (e.g. field reset on output switch). Avoids clobbering the local state
  // after this component's own onChange by comparing against `lastEmittedRef`.
  useEffect(() => {
    if (value === lastEmittedRef.current) return
    const fresh = tokenize(value, ctx)
    setTiles(fresh)
    setCursor(fresh.length)
    lastEmittedRef.current = value
  }, [value, ctx])

  const validation = useMemo(() => validateTiles(tiles, ctx), [tiles, ctx])

  function emit(nextTiles: Tile[]) {
    setTiles(nextTiles)
    const str = serialize(nextTiles)
    lastEmittedRef.current = str
    onChange(str)
  }

  function insertTile(tile: Tile) {
    const next = [...tiles]
    next.splice(cursor, 0, tile)
    emit(next)
    setCursor(cursor + 1)
  }

  function removeAt(index: number) {
    if (index < 0 || index >= tiles.length) return
    const next = tiles.filter((_, i) => i !== index)
    emit(next)
    setCursor(Math.min(cursor, next.length))
  }

  function backspace() {
    if (cursor === 0) return
    removeAt(cursor - 1)
    setCursor(cursor - 1)
  }

  function clearAll() {
    emit([])
    setCursor(0)
  }

  function swap(a: number, b: number) {
    if (a < 0 || b < 0 || a >= tiles.length || b >= tiles.length) return
    const next = [...tiles]
    ;[next[a], next[b]] = [next[b], next[a]]
    emit(next)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const k = e.key
    if (k === "Backspace") {
      e.preventDefault()
      backspace()
      return
    }
    if (k === "ArrowLeft") {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) swap(cursor - 1, cursor)
      else setCursor(Math.max(0, cursor - 1))
      return
    }
    if (k === "ArrowRight") {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) swap(cursor, cursor + 1)
      else setCursor(Math.min(tiles.length, cursor + 1))
      return
    }
    if (k >= "0" && k <= "9") {
      e.preventDefault()
      // Extend trailing num tile or open a new one so 1-2-3 types as "123".
      const prev = tiles[cursor - 1]
      if (prev && prev.kind === "num" && !prev.text.includes("e")) {
        const next = [...tiles]
        next[cursor - 1] = { ...prev, text: prev.text + k }
        emit(next)
      } else {
        insertTile({ id: cryptoId("n"), kind: "num", text: k })
      }
      return
    }
    if (k === ".") {
      e.preventDefault()
      const prev = tiles[cursor - 1]
      if (prev && prev.kind === "num" && !prev.text.includes(".")) {
        const next = [...tiles]
        next[cursor - 1] = { ...prev, text: prev.text + "." }
        emit(next)
      } else {
        insertTile({ id: cryptoId("n"), kind: "num", text: "0." })
      }
      return
    }
    if (k === "+" || k === "-" || k === "*" || k === "/") {
      e.preventDefault()
      insertTile({ id: cryptoId("op"), kind: "op", op: k })
      return
    }
    if (k === "(") {
      e.preventDefault()
      insertTile({ id: cryptoId("lp"), kind: "lparen" })
      return
    }
    if (k === ")") {
      e.preventDefault()
      insertTile({ id: cryptoId("rp"), kind: "rparen" })
      return
    }
  }

  const errorText =
    validation && tiles.length > 0
      ? describeError(validation, t)
      : null

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/20 p-2 focus:outline-none focus:ring-2 focus:ring-ring/60"
    >
      <DisplayZone
        tiles={tiles}
        cursor={cursor}
        setCursor={setCursor}
        removeAt={removeAt}
        error={errorText}
      />

      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          onClick={backspace}
          disabled={tiles.length === 0}
          aria-label={t("builder.backspace")}
        >
          <Delete className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={clearAll}
          disabled={tiles.length === 0}
          aria-label={t("builder.clear")}
        >
          {t("builder.clear")}
        </Button>
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground italic">
          {t("builder.keyboard_hint")}
        </span>
      </div>

      <PaletteSection label={t("builder.digits_ops")}>
        <div className="grid grid-cols-5 gap-1">
          {["7", "8", "9", "(", ")"].map((c) => (
            <NumOpButton key={c} label={c} onClick={() => pushChar(c)} />
          ))}
          {["4", "5", "6", "+", "-"].map((c) => (
            <NumOpButton key={c} label={c} onClick={() => pushChar(c)} />
          ))}
          {["1", "2", "3", "*", "/"].map((c) => (
            <NumOpButton key={c} label={c === "*" ? "×" : c === "/" ? "÷" : c} onClick={() => pushChar(c === "×" ? "*" : c === "÷" ? "/" : c)} />
          ))}
          {["0", "."].map((c) => (
            <NumOpButton key={c} label={c} onClick={() => pushChar(c)} />
          ))}
        </div>
      </PaletteSection>

      {ownInputKeys.length > 0 && (
        <PaletteSection label={t("builder.inputs")}>
          <div className="flex flex-wrap gap-1">
            {ownInputKeys.map((k) => (
              <PaletteTile
                key={k}
                color={EMERALD}
                onClick={() =>
                  insertTile({ id: cryptoId("r"), kind: "input", name: k })
                }
              >
                @{k}
              </PaletteTile>
            ))}
          </div>
        </PaletteSection>
      )}

      {ownOutputKeys.length > 0 && (
        <PaletteSection label={t("builder.own_outputs")}>
          <div className="flex flex-wrap gap-1">
            {ownOutputKeys.map((k) => (
              <PaletteTile
                key={k}
                color={ROSE}
                onClick={() =>
                  insertTile({ id: cryptoId("r"), kind: "output", name: k })
                }
              >
                @{k}
              </PaletteTile>
            ))}
          </div>
        </PaletteSection>
      )}

      {otherEstimators.some((e) => e.outputs.length > 0) && (
        <PaletteSection label={t("builder.cross_refs")}>
          <div className="flex flex-wrap gap-1">
            {otherEstimators.flatMap((est) =>
              est.outputs.map((v) => {
                const displayName = est.name.replace(/_/g, " ")
                return (
                  <PaletteTile
                    key={`${est.id}-${v}`}
                    color={ROSE}
                    onClick={() =>
                      insertTile({
                        id: cryptoId("x"),
                        kind: "cross",
                        estimatorId: est.id,
                        estimatorName: est.name,
                        variable: v,
                      })
                    }
                  >
                    @{displayName}.{v}
                  </PaletteTile>
                )
              }),
            )}
          </div>
        </PaletteSection>
      )}

      <PaletteSection label={t("builder.aggregations")}>
        <div className="flex flex-wrap gap-1">
          <AggregationButton
            fn="SUM"
            label={t("aggregation.sum")}
            repeatableFields={repeatableFields}
            repeatableSteps={repeatableSteps}
            open={aggDraft?.fn === "SUM"}
            setOpen={(o) => setAggDraft(o ? { fn: "SUM" } : null)}
            onPick={(arg, label) => {
              insertTile({
                id: cryptoId("ag"),
                kind: "agg",
                fn: "SUM",
                arg,
                argLabel: label,
              })
              setAggDraft(null)
            }}
          />
          <AggregationButton
            fn="AVG"
            label={t("aggregation.average")}
            repeatableFields={repeatableFields}
            repeatableSteps={repeatableSteps}
            open={aggDraft?.fn === "AVG"}
            setOpen={(o) => setAggDraft(o ? { fn: "AVG" } : null)}
            onPick={(arg, label) => {
              insertTile({
                id: cryptoId("ag"),
                kind: "agg",
                fn: "AVG",
                arg,
                argLabel: label,
              })
              setAggDraft(null)
            }}
          />
          <AggregationButton
            fn="COUNT_ITER"
            label={t("aggregation.count")}
            repeatableFields={repeatableFields}
            repeatableSteps={repeatableSteps}
            open={aggDraft?.fn === "COUNT_ITER"}
            setOpen={(o) => setAggDraft(o ? { fn: "COUNT_ITER" } : null)}
            onPick={(arg, label) => {
              insertTile({
                id: cryptoId("ag"),
                kind: "agg",
                fn: "COUNT_ITER",
                arg,
                argLabel: label,
              })
              setAggDraft(null)
            }}
          />
        </div>
      </PaletteSection>
    </div>
  )

  function pushChar(c: string) {
    if (c >= "0" && c <= "9") {
      const prev = tiles[cursor - 1]
      if (prev && prev.kind === "num") {
        const next = [...tiles]
        next[cursor - 1] = { ...prev, text: prev.text + c }
        emit(next)
        return
      }
      insertTile({ id: cryptoId("n"), kind: "num", text: c })
      return
    }
    if (c === ".") {
      const prev = tiles[cursor - 1]
      if (prev && prev.kind === "num" && !prev.text.includes(".")) {
        const next = [...tiles]
        next[cursor - 1] = { ...prev, text: prev.text + "." }
        emit(next)
        return
      }
      insertTile({ id: cryptoId("n"), kind: "num", text: "0." })
      return
    }
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      insertTile({ id: cryptoId("op"), kind: "op", op: c })
      return
    }
    if (c === "(") {
      insertTile({ id: cryptoId("lp"), kind: "lparen" })
      return
    }
    if (c === ")") {
      insertTile({ id: cryptoId("rp"), kind: "rparen" })
      return
    }
  }
}

function cryptoId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`
}

function describeError(
  err: ValidationError,
  t: (k: string, vars?: Record<string, string>) => string,
): string {
  switch (err.kind) {
    case "empty":
      return t("builder.err_empty")
    case "unknown_ref":
      return t("builder.err_unknown_ref", { name: err.name })
    case "unknown_cross":
      return t("builder.err_unknown_cross")
    case "paren_mismatch":
      return t("builder.err_paren_mismatch")
    case "malformed":
      return t("builder.err_malformed")
  }
}

function DisplayZone({
  tiles,
  cursor,
  setCursor,
  removeAt,
  error,
}: {
  tiles: Tile[]
  cursor: number
  setCursor: (c: number) => void
  removeAt: (i: number) => void
  error: string | null
}) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        "min-h-[56px] rounded-md border bg-background px-2 py-2 flex flex-wrap items-center gap-1",
        error ? "border-destructive/60" : "border-border/60",
      )}
      onClick={(e) => {
        // Click on empty space sets cursor at end
        if (e.target === e.currentTarget) setCursor(tiles.length)
      }}
    >
      {tiles.length === 0 && (
        <span className="text-xs text-muted-foreground italic flex items-center gap-1">
          <Calculator className="h-3 w-3" />
          {t("builder.placeholder")}
        </span>
      )}
      {tiles.map((tile, i) => (
        <span key={tile.id} className="flex items-center">
          <Caret active={cursor === i} onClick={() => setCursor(i)} />
          <TileChip
            tile={tile}
            selected={cursor === i + 1}
            onClick={() => setCursor(i + 1)}
            onRemove={() => removeAt(i)}
          />
        </span>
      ))}
      <Caret active={cursor === tiles.length} onClick={() => setCursor(tiles.length)} />
      {error && (
        <div className="w-full text-[11px] text-destructive mt-1">{error}</div>
      )}
    </div>
  )
}

function Caret({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <span
      role="presentation"
      onClick={onClick}
      className={cn(
        "inline-block w-[2px] self-stretch cursor-text mx-0.5 transition-colors",
        active ? "bg-primary animate-pulse" : "bg-transparent hover:bg-border",
      )}
    />
  )
}

function TileChip({
  tile,
  selected,
  onClick,
  onRemove,
}: {
  tile: Tile
  selected: boolean
  onClick: () => void
  onRemove: () => void
}) {
  const label = tileLabel(tile)
  const color = tileColor(tile)
  return (
    <span
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-mono cursor-pointer select-none",
        "hover:bg-accent",
        selected ? "ring-1 ring-primary" : "",
      )}
      style={color ? { color, borderColor: color, backgroundColor: `${color}15` } : undefined}
    >
      {label}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remove tile"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

function tileLabel(t: Tile): string {
  switch (t.kind) {
    case "num":
      return t.text
    case "op":
      return t.op === "*" ? "×" : t.op === "/" ? "÷" : t.op
    case "lparen":
      return "("
    case "rparen":
      return ")"
    case "input":
      return `@${t.name}`
    case "output":
      return `@${t.name}`
    case "cross":
      return `@${t.estimatorName.replace(/_/g, " ")}.${t.variable}`
    case "agg":
      return `${t.fn === "SUM" ? "Σ" : t.fn === "AVG" ? "μ" : "#"}(${t.argLabel})`
  }
}

function tileColor(t: Tile): string | undefined {
  switch (t.kind) {
    case "input":
      return EMERALD
    case "output":
    case "cross":
      return ROSE
    case "agg":
      return VIOLET
    case "num":
      return undefined
    case "op":
    case "lparen":
    case "rparen":
      return AMBER
  }
}

function PaletteSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      {children}
    </div>
  )
}

function NumOpButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-7 rounded-md border border-border/60 bg-background text-sm font-mono hover:bg-accent active:bg-accent/70 transition-colors"
    >
      {label}
    </button>
  )
}

function PaletteTile({
  color,
  onClick,
  children,
}: {
  color: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border px-2 py-0.5 text-xs font-mono hover:bg-accent transition-colors"
      style={{ color, borderColor: color, backgroundColor: `${color}12` }}
    >
      {children}
    </button>
  )
}

function AggregationButton({
  fn,
  label,
  repeatableFields,
  repeatableSteps,
  open,
  setOpen,
  onPick,
}: {
  fn: "SUM" | "AVG" | "COUNT_ITER"
  label: string
  repeatableFields: RepeatableField[]
  repeatableSteps: RepeatableStep[]
  open: boolean
  setOpen: (o: boolean) => void
  onPick: (arg: string, label: string) => void
}) {
  const { t } = useTranslation()
  const options =
    fn === "COUNT_ITER"
      ? repeatableSteps.map((s) => ({ key: s.key, label: s.title }))
      : repeatableFields.map((f) => ({
          key: f.key,
          label: `${f.label} (${f.stepTitle})`,
        }))

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-md border px-2 py-0.5 text-xs font-mono hover:bg-accent transition-colors"
        style={{ color: VIOLET, borderColor: VIOLET, backgroundColor: `${VIOLET}12` }}
      >
        {label}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-md border bg-popover shadow-md p-2">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
              {fn === "COUNT_ITER"
                ? t("builder.agg_pick_step")
                : t("builder.agg_pick_field")}
            </div>
            {options.length === 0 ? (
              <div className="text-xs text-muted-foreground italic px-1 py-2">
                {t("builder.agg_no_options")}
              </div>
            ) : (
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                {options.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => onPick(o.key, o.label)}
                    className="text-left px-2 py-1 text-xs rounded hover:bg-accent"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
