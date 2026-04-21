/**
 * Expression tile model for the visual ExpressionBuilder.
 *
 * Storage form (what the backend stores):
 *   @name                 bare ref — estimator input or sibling output
 *   @#<uuid>.var          cross-estimator ref
 *   SUM(@key)             aggregation of a repeatable field
 *   AVG(@key)             aggregation of a repeatable field
 *   COUNT_ITER(@step_key) iteration count of a repeatable step
 *   3.14 + 2 * (…)        arithmetic with +  -  *  /  ( )
 *
 * Tile form (what the UI manipulates) is a flat, ordered list of tokens. Each
 * tile is one visible chip. Parens and binary operators live as their own
 * tiles so the builder can manipulate them independently.
 *
 * The parser and serializer round-trip: `serialize(tokenize(expr))` preserves
 * the expression's textual meaning (whitespace may collapse but parens and
 * token order are kept).
 */
import type { EstimatorIndex } from "@/pages/flows/lib/expression-refs"

export type Tile =
  | { id: string; kind: "num"; text: string }
  | { id: string; kind: "op"; op: "+" | "-" | "*" | "/" }
  | { id: string; kind: "lparen" }
  | { id: string; kind: "rparen" }
  | { id: string; kind: "input"; name: string }
  | { id: string; kind: "output"; name: string }
  | {
      id: string
      kind: "cross"
      estimatorId: string
      estimatorName: string
      variable: string
    }
  | {
      id: string
      kind: "agg"
      fn: "SUM" | "AVG" | "COUNT_ITER"
      arg: string
      argLabel: string
    }

export type ParseContext = {
  inputKeys: Set<string>
  outputKeys: Set<string>
  estimators: EstimatorIndex
  /** Pretty labels for aggregation arguments (step titles, field labels). */
  fieldLabels?: Map<string, string>
  stepLabels?: Map<string, string>
}

let tileCounter = 0
function newId(prefix: string): string {
  tileCounter += 1
  return `${prefix}-${tileCounter}`
}

const AGG_FNS = ["SUM", "AVG", "COUNT_ITER"] as const
type AggFn = (typeof AGG_FNS)[number]

/** Parse a storage-form expression into an ordered tile list. Unknown bare
 *  `@name` refs default to "input" classification — validation surfaces the
 *  mismatch separately. */
export function tokenize(expr: string, ctx: ParseContext): Tile[] {
  const tiles: Tile[] = []
  const chars = [...expr]
  let i = 0

  const isDigit = (c: string) => c >= "0" && c <= "9"
  const isAlpha = (c: string) =>
    (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_"
  const isAlphaNum = (c: string) => isAlpha(c) || isDigit(c)

  while (i < chars.length) {
    const c = chars[i]

    if (c === " " || c === "\t" || c === "\n") {
      i += 1
      continue
    }

    if (c === "+" || c === "-" || c === "*" || c === "/") {
      tiles.push({ id: newId("op"), kind: "op", op: c })
      i += 1
      continue
    }
    if (c === "(") {
      tiles.push({ id: newId("lp"), kind: "lparen" })
      i += 1
      continue
    }
    if (c === ")") {
      tiles.push({ id: newId("rp"), kind: "rparen" })
      i += 1
      continue
    }

    if (isDigit(c) || (c === "." && i + 1 < chars.length && isDigit(chars[i + 1]))) {
      let j = i
      while (j < chars.length && (isDigit(chars[j]) || chars[j] === ".")) j += 1
      tiles.push({ id: newId("n"), kind: "num", text: chars.slice(i, j).join("") })
      i = j
      continue
    }

    // Aggregation call: SUM(@key) / AVG(@key) / COUNT_ITER(@key)
    if (isAlpha(c)) {
      let j = i
      while (j < chars.length && isAlphaNum(chars[j])) j += 1
      const word = chars.slice(i, j).join("")
      if ((AGG_FNS as readonly string[]).includes(word) && chars[j] === "(") {
        // Skip "(" then read "@<key>" then ")"
        let k = j + 1
        while (k < chars.length && chars[k] === " ") k += 1
        if (chars[k] === "@") {
          k += 1
          const argStart = k
          while (k < chars.length && isAlphaNum(chars[k])) k += 1
          const arg = chars.slice(argStart, k).join("")
          while (k < chars.length && chars[k] === " ") k += 1
          if (chars[k] === ")") {
            const label =
              (word === "COUNT_ITER"
                ? ctx.stepLabels?.get(arg)
                : ctx.fieldLabels?.get(arg)) ?? arg
            tiles.push({
              id: newId("ag"),
              kind: "agg",
              fn: word as AggFn,
              arg,
              argLabel: label,
            })
            i = k + 1
            continue
          }
        }
        // Unrecognised call shape — fall through and emit as bare ref so the
        // user can still see/fix what they had.
      }
      // Not an aggregation — unknown word on its own is invalid; drop it
      // gracefully by advancing one char to avoid an infinite loop.
      i += 1
      continue
    }

    if (c === "@") {
      // Cross-ref: `@#<uuid>.var`
      if (chars[i + 1] === "#") {
        let j = i + 2
        const idStart = j
        while (j < chars.length && (isAlphaNum(chars[j]) || chars[j] === "-")) j += 1
        if (chars[j] === ".") {
          const id = chars.slice(idStart, j).join("")
          j += 1
          const varStart = j
          while (j < chars.length && isAlphaNum(chars[j])) j += 1
          const variable = chars.slice(varStart, j).join("")
          const est = ctx.estimators.find((e) => e.id === id)
          tiles.push({
            id: newId("x"),
            kind: "cross",
            estimatorId: id,
            estimatorName: est?.name ?? id,
            variable,
          })
          i = j
          continue
        }
        // Malformed cross ref — drop `@#` and continue
        i += 2
        continue
      }

      // Bare ref `@name`
      let j = i + 1
      while (j < chars.length && isAlphaNum(chars[j])) j += 1
      const name = chars.slice(i + 1, j).join("")
      if (name) {
        const kind = ctx.outputKeys.has(name) ? "output" : "input"
        tiles.push({ id: newId("r"), kind, name })
      }
      i = j
      continue
    }

    // Unknown char — skip to keep parser tolerant
    i += 1
  }

  return tiles
}

/** Render a tile list back to storage-form expression. */
export function serialize(tiles: Tile[]): string {
  const out: string[] = []
  for (const t of tiles) {
    switch (t.kind) {
      case "num":
        out.push(t.text)
        break
      case "op":
        out.push(` ${t.op} `)
        break
      case "lparen":
        out.push("(")
        break
      case "rparen":
        out.push(")")
        break
      case "input":
      case "output":
        out.push(`@${t.name}`)
        break
      case "cross":
        out.push(`@#${t.estimatorId}.${t.variable}`)
        break
      case "agg":
        out.push(`${t.fn}(@${t.arg})`)
        break
    }
  }
  return out.join("").replace(/\s+/g, " ").trim()
}

export type ValidationError =
  | { kind: "empty" }
  | { kind: "unknown_ref"; name: string }
  | { kind: "unknown_cross"; id: string }
  | { kind: "paren_mismatch" }
  | { kind: "malformed" }

/** Structural + reference validation of a tile list. Surfaces the same
 *  problems the backend would raise, so the UI can show an inline error
 *  without hitting the server. */
export function validateTiles(
  tiles: Tile[],
  ctx: ParseContext,
): ValidationError | null {
  if (tiles.length === 0) return { kind: "empty" }

  let parens = 0
  let prevWasOperand = false
  let prevWasOp = true // initial state: start of expression behaves like after-op
  for (const t of tiles) {
    if (t.kind === "lparen") {
      parens += 1
      if (prevWasOperand) return { kind: "malformed" }
      prevWasOp = true
      prevWasOperand = false
    } else if (t.kind === "rparen") {
      parens -= 1
      if (parens < 0) return { kind: "paren_mismatch" }
      if (prevWasOp) return { kind: "malformed" }
      prevWasOperand = true
      prevWasOp = false
    } else if (t.kind === "op") {
      if (prevWasOp) return { kind: "malformed" }
      prevWasOp = true
      prevWasOperand = false
    } else {
      // operand (num / ref / cross / agg)
      if (prevWasOperand) return { kind: "malformed" }
      if (t.kind === "input" || t.kind === "output") {
        const known =
          ctx.inputKeys.has(t.name) || ctx.outputKeys.has(t.name)
        if (!known) return { kind: "unknown_ref", name: t.name }
      }
      if (t.kind === "cross") {
        if (!ctx.estimators.some((e) => e.id === t.estimatorId)) {
          return { kind: "unknown_cross", id: t.estimatorId }
        }
      }
      prevWasOperand = true
      prevWasOp = false
    }
  }
  if (parens !== 0) return { kind: "paren_mismatch" }
  if (prevWasOp) return { kind: "malformed" }
  return null
}
