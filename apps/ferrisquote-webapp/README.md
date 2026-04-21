# ferrisquote-webapp

Frontend web application for FerrisQuote, built with React 19 + Vite.

## Tech stack

| Layer | Library |
|---|---|
| UI | React 19 |
| Bundler | Vite |
| Routing | React Router v7 |
| Server state | TanStack Query v5 |
| Client state | Zustand |
| API client | typed-openapi (generated from Rust/utoipa OpenAPI spec) |
| Forms | react-hook-form + Zod |
| Flow editor | @xyflow/react |

## Getting started

```sh
pnpm install
pnpm dev
```

## Project structure

```
src/
├── api/                  # Generated API client + TanStack Query wrappers
│   ├── api.client.ts     # Auto-generated — do not edit (typed-openapi output)
│   └── api.tanstack.ts   # TanStack Query wrapper around the API client
├── pages/                # Feature modules (one folder per domain)
│   └── [feature]/
│       ├── page-[feature].tsx     # Route container with nested <Routes>
│       ├── layouts/               # Layout wrappers
│       ├── feature/               # Business logic, hooks, API calls
│       ├── ui/                    # Presentational components
│       └── schemas/               # Zod validation schemas
├── routes/               # URL helpers and sub-routers
├── store/                # Zustand stores (client state)
├── hooks/                # Shared hooks
├── components/           # Reusable UI components
└── types/                # Shared type aliases
```

## API client

The API client is generated from the backend OpenAPI spec using `typed-openapi`:

```sh
npx typed-openapi ../ferrisquote-api/openapi.json -o src/api/api.client.ts --tanstack src/api/api.tanstack.ts
```

**Never edit `api.client.ts` manually** — regenerate it when the backend spec changes.

Usage in feature hooks:

```ts
// pages/quotes/feature/quote.api.ts
export const useGetQuote = ({ id }: { id: string }) =>
  useQuery({
    ...window.tanstackApi.get('/quotes/{id}', { path: { id } }).queryOptions,
    enabled: !!id,
  })

export const useCreateQuote = () => {
  const queryClient = useQueryClient()
  return useMutation({
    ...window.tanstackApi.mutation('post', '/quotes').mutationOptions,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  })
}
```

## Routing

URL helpers live in `routes/sub-router/`:

```ts
// routes/sub-router/quote.router.ts
export const QUOTES_URL = () => '/quotes'
export const QUOTE_URL = (id = ':id') => `${QUOTES_URL()}/${id}`
```

## State management

| Store | Contents | Persisted |
|---|---|---|
| `authStore` | `accessToken`, `refreshToken`, `idToken` | localStorage |
| `userStore` | `isAuthenticated`, `user`, `expiration` | no |

## Forms

Schemas live in `pages/[feature]/schemas/` and are used with `react-hook-form`:

```ts
export const createQuoteSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})
export type CreateQuoteSchema = z.infer<typeof createQuoteSchema>

const form = useForm<CreateQuoteSchema>({ resolver: zodResolver(createQuoteSchema) })
```

## Internationalization (i18n)

Translations live under `src/locales/<lng>/translation.json`. Default is French (`fr`); English (`en`) is the secondary language. The `LanguageSwitcher` component in the nav sidebar lets users switch languages at runtime — the choice is persisted in `localStorage` (`i18nextLng`).

### Adding a new translation key

1. Pick (or create) a namespace in both `src/locales/fr/translation.json` and `src/locales/en/translation.json`. Keep the structure identical across locales.
2. Use `useTranslation()` in the component:

   ```tsx
   import { useTranslation } from "react-i18next"

   export function MyButton() {
     const { t } = useTranslation()
     return <button>{t("common.save")}</button>
   }
   ```

3. Interpolation uses `{{var}}`:

   ```json
   { "errors.update_failed": "Update failed: {{msg}}" }
   ```
   ```tsx
   toast.error(t("errors.update_failed", { msg: err.message }))
   ```

### Adding a new language

1. Create `src/locales/<code>/translation.json` (copy the English file as a template).
2. Register it in `src/i18n/index.ts`:

   ```ts
   import es from "@/locales/es/translation.json"
   export const SUPPORTED_LANGS = ["fr", "en", "es"] as const
   // …
   resources: { en: { translation: en }, fr: { translation: fr }, es: { translation: es } }
   ```

3. Update `LanguageSwitcher` label fallback if needed.

### Style guide

- Keep keys snake_case, grouped by domain (`estimator.*`, `flow.*`, `common.*`, `errors.*`).
- Don't concatenate translated strings — use full sentences with interpolation. Word order varies between languages.
- Number + date formatting goes through `Intl.NumberFormat` / `Intl.DateTimeFormat` with `i18n.resolvedLanguage` as the locale.

