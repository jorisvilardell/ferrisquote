import { useEffect, useMemo, useRef, useState } from "react"
import { Calculator, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { HelpHint } from "@/components/help-hint"
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
      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-gradient-to-b from-muted/30 to-muted/10 p-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/60"
    >
      <DisplayZone
        tiles={tiles}
        cursor={cursor}
        setCursor={setCursor}
        removeAt={removeAt}
        error={errorText}
        hint={t("builder.keyboard_hint")}
      />

      {/* Calculator keypad — 4 cols, Numworks-ish:
             row 1: C / ⌫ / ( / )
             rows 2-4: digits + ÷/×/−
             row 5: 0 (spans 2) / . / + */}
      <div className="grid grid-cols-4 gap-1.5">
        <CalcKey
          variant="fn"
          onClick={clearAll}
          disabled={tiles.length === 0}
          ariaLabel={t("builder.clear")}
        >
          C
        </CalcKey>
        <CalcKey
          variant="fn"
          onClick={backspace}
          disabled={tiles.length === 0}
          ariaLabel={t("builder.backspace")}
        >
          ⌫
        </CalcKey>
        <CalcKey variant="fn" onClick={() => pushChar("(")}>
          (
        </CalcKey>
        <CalcKey variant="fn" onClick={() => pushChar(")")}>
          )
        </CalcKey>

        <CalcKey variant="num" onClick={() => pushChar("7")}>7</CalcKey>
        <CalcKey variant="num" onClick={() => pushChar("8")}>8</CalcKey>
        <CalcKey variant="num" onClick={() => pushChar("9")}>9</CalcKey>
        <CalcKey variant="op" onClick={() => pushChar("/")}>÷</CalcKey>

        <CalcKey variant="num" onClick={() => pushChar("4")}>4</CalcKey>
        <CalcKey variant="num" onClick={() => pushChar("5")}>5</CalcKey>
        <CalcKey variant="num" onClick={() => pushChar("6")}>6</CalcKey>
        <CalcKey variant="op" onClick={() => pushChar("*")}>×</CalcKey>

        <CalcKey variant="num" onClick={() => pushChar("1")}>1</CalcKey>
        <CalcKey variant="num" onClick={() => pushChar("2")}>2</CalcKey>
        <CalcKey variant="num" onClick={() => pushChar("3")}>3</CalcKey>
        <CalcKey variant="op" onClick={() => pushChar("-")}>−</CalcKey>

        <CalcKey variant="num" wide onClick={() => pushChar("0")}>0</CalcKey>
        <CalcKey variant="num" onClick={() => pushChar(".")}>.</CalcKey>
        <CalcKey variant="op" onClick={() => pushChar("+")}>+</CalcKey>
      </div>

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
  hint,
}: {
  tiles: Tile[]
  cursor: number
  setCursor: (c: number) => void
  removeAt: (i: number) => void
  error: string | null
  hint: string
}) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [overflowTop, setOverflowTop] = useState(false)

  // Autoscroll to the bottom on content change so the cursor line stays
  // in view — and detect whether there's content scrolled off the top so
  // we can show the TI-83-style "…" ellipsis indicator.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    setOverflowTop(el.scrollHeight > el.clientHeight)
  }, [tiles, cursor])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setOverflowTop(el.scrollTop > 0)
  }

  return (
    <div
      className={cn(
        "relative rounded-lg border shadow-inner overflow-hidden",
        "bg-gradient-to-b from-slate-900 to-slate-950 dark:from-slate-800 dark:to-slate-900",
        error
          ? "border-destructive/70 ring-1 ring-destructive/40"
          : "border-slate-700",
      )}
    >
      {/* Faint gridline pattern for the "display panel" feel. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.8) 0px, rgba(255,255,255,0.8) 1px, transparent 1px, transparent 3px)",
        }}
      />
      {/* TI-83-style overflow indicator — three dots at the very top
          whenever content has scrolled above the viewport. Sits above the
          scroll container so the glyphs don't move with scrollTop. */}
      {overflowTop && (
        <div className="absolute top-1 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <span className="text-slate-400 text-xs leading-none tracking-widest">
            •••
          </span>
        </div>
      )}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          // Three-line viewport: line-height-none + text-2xl ≈ 28-30px per
          // line; 3 lines + top padding for the overflow indicator.
          "relative max-h-[108px] overflow-y-auto px-4 pt-5 pb-3",
          "flex flex-wrap items-center justify-start gap-y-1",
          "font-mono text-slate-100 leading-none tracking-tight",
          "cursor-text",
          // Hide scrollbar chrome on all engines — the `•••` glyph is the
          // only overflow cue, TI-style.
          "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]",
        )}
        style={{ scrollbarWidth: "none" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setCursor(tiles.length)
        }}
      >
        {tiles.length === 0 && (
          <span className="flex items-center gap-1.5 text-sm text-slate-400/80 italic mr-auto">
            <Calculator className="h-3.5 w-3.5" />
            {t("builder.placeholder")}
          </span>
        )}
        {tiles.map((tile, i) => (
          <span key={tile.id} className="inline-flex items-center">
            <Caret active={cursor === i} onClick={() => setCursor(i)} />
            <TileToken
              tile={tile}
              selected={cursor === i + 1}
              onClick={() => setCursor(i + 1)}
              onRemove={() => removeAt(i)}
            />
          </span>
        ))}
        <Caret
          active={cursor === tiles.length}
          onClick={() => setCursor(tiles.length)}
        />
      </div>
      {/* Help icon floating in the top-right corner of the screen — holds
          the keyboard-shortcut hint so the display itself stays clean. */}
      <div className="absolute top-1.5 right-1.5 z-20">
        <div className="text-slate-300 hover:text-slate-100">
          <HelpHint text={hint} label={t("common.help")} />
        </div>
      </div>
      {error && (
        <div className="relative border-t border-red-500/30 bg-red-950/40 px-4 py-1.5 text-[11px] text-red-300">
          {error}
        </div>
      )}
    </div>
  )
}

function Caret({ active, onClick }: { active: boolean; onClick: () => void }) {
  // Height matches the tallest glyph (text-2xl ≈ 1.5em). align-middle +
  // items-center on the row keeps the bar centered on the text box.
  return (
    <span
      role="presentation"
      onClick={onClick}
      className={cn(
        "inline-block w-[2px] h-7 cursor-text mx-px align-middle rounded-sm transition-colors",
        active
          ? "bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]"
          : "bg-transparent hover:bg-slate-600",
      )}
    />
  )
}

/**
 * Text-first render of a single tile on the calc display. Numbers and
 * operators read as flowing typography (classic calc feel); refs and
 * aggregations get a tinted pill so they stand out as "symbolic" values.
 */
function TileToken({
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
  // Plain glyphs: numbers + operators + parens — no pill, just colored text.
  if (tile.kind === "num") {
    return (
      <GlyphToken
        onClick={onClick}
        onRemove={onRemove}
        selected={selected}
        className="text-2xl text-slate-50 font-semibold px-0.5"
      >
        {tile.text}
      </GlyphToken>
    )
  }
  if (tile.kind === "op") {
    const sym = tile.op === "*" ? "×" : tile.op === "/" ? "÷" : tile.op === "-" ? "−" : "+"
    return (
      <GlyphToken
        onClick={onClick}
        onRemove={onRemove}
        selected={selected}
        className="text-2xl text-amber-400 font-medium mx-1.5"
      >
        {sym}
      </GlyphToken>
    )
  }
  if (tile.kind === "lparen" || tile.kind === "rparen") {
    return (
      <GlyphToken
        onClick={onClick}
        onRemove={onRemove}
        selected={selected}
        className="text-2xl text-slate-400 font-medium px-0.5"
      >
        {tile.kind === "lparen" ? "(" : ")"}
      </GlyphToken>
    )
  }

  // Symbolic tokens: refs + aggregations — tinted pill with prefix glyph.
  const { bg, fg, prefix, body } = symbolicStyle(tile)
  return (
    <span
      onClick={onClick}
      className={cn(
        "group relative inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 mx-0.5",
        "text-base font-medium cursor-pointer select-none transition-shadow",
        selected ? "ring-1 ring-amber-400/60" : "ring-0",
      )}
      style={{ color: fg, backgroundColor: bg }}
    >
      {prefix && <span className="opacity-70 text-sm">{prefix}</span>}
      <span>{body}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="ml-1 inline-flex items-center justify-center rounded-full bg-slate-800/80 hover:bg-red-500/80 p-0.5 opacity-60 group-hover:opacity-100 transition-all"
        aria-label="Remove tile"
      >
        <X className="h-4 w-4" />
      </button>
    </span>
  )
}

function GlyphToken({
  children,
  className,
  onClick,
  onRemove,
  selected,
}: {
  children: React.ReactNode
  className: string
  onClick: () => void
  onRemove: () => void
  selected: boolean
}) {
  return (
    <span
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onRemove()
      }}
      className={cn(
        "group relative cursor-pointer select-none",
        selected &&
          "underline underline-offset-4 decoration-amber-400 decoration-2",
        className,
      )}
    >
      {children}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className={cn(
          "absolute -top-2 -right-2 rounded-full bg-slate-800 hover:bg-red-500 border border-slate-600 p-1 shadow-md",
          "opacity-0 group-hover:opacity-100 transition-all",
        )}
        aria-label="Remove"
      >
        <X className="h-3.5 w-3.5 text-slate-100" />
      </button>
    </span>
  )
}

function symbolicStyle(tile: Tile): {
  bg: string
  fg: string
  prefix: string
  body: string
} {
  switch (tile.kind) {
    case "input":
      return {
        bg: "rgba(52, 211, 153, 0.15)",
        fg: "rgb(110, 231, 183)",
        prefix: "@",
        body: tile.name,
      }
    case "output":
      return {
        bg: "rgba(244, 114, 182, 0.15)",
        fg: "rgb(249, 168, 212)",
        prefix: "@",
        body: tile.name,
      }
    case "cross":
      return {
        bg: "rgba(244, 114, 182, 0.15)",
        fg: "rgb(249, 168, 212)",
        prefix: "↗",
        body: `${tile.estimatorName.replace(/_/g, " ")}.${tile.variable}`,
      }
    case "agg": {
      const sym =
        tile.fn === "SUM" ? "Σ" : tile.fn === "AVG" ? "μ" : "#"
      return {
        bg: "rgba(167, 139, 250, 0.15)",
        fg: "rgb(196, 181, 253)",
        prefix: sym,
        body: tile.argLabel,
      }
    }
    // Unreachable: the early returns above handle num/op/lparen/rparen.
    default:
      return { bg: "", fg: "", prefix: "", body: "" }
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

function CalcKey({
  children,
  onClick,
  variant,
  wide,
  disabled,
  ariaLabel,
}: {
  children: React.ReactNode
  onClick: () => void
  variant: "num" | "op" | "fn"
  wide?: boolean
  disabled?: boolean
  ariaLabel?: string
}) {
  const base =
    "h-12 sm:h-[52px] rounded-lg border text-lg font-mono font-semibold shadow-sm " +
    "active:translate-y-px active:shadow-none transition-all " +
    "disabled:opacity-40 disabled:cursor-not-allowed"
  const variantCls = {
    num:
      "bg-background hover:bg-accent border-border/70 text-foreground",
    op:
      "bg-amber-500 hover:bg-amber-600 border-amber-600 text-white shadow-amber-900/20 text-xl",
    fn:
      "bg-slate-700 hover:bg-slate-600 border-slate-800 text-slate-100 text-base",
  }[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(base, variantCls, wide && "col-span-2")}
    >
      {children}
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
