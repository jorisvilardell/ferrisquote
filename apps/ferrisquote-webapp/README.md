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
