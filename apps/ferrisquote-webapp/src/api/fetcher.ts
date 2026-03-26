import { z } from "zod"
import { ApiError } from "./api-error"

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080"

export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new ApiError(response.status, body)
  }

  const json = await response.json()
  const result = schema.safeParse(json)

  if (!result.success) {
    if (import.meta.env.DEV) {
      console.warn("[API] Zod validation failed for", path, result.error)
    }
    throw result.error
  }

  return result.data
}
