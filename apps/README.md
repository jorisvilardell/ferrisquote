# Apps

Executable applications of the FerrisQuote monorepo.

## Contents

| Application | Description | Stack |
|---|---|---|
| [`ferrisquote-api`](./ferrisquote-api/) | REST API backend (port 3000) | Rust, Axum, SQLx, utoipa |
| [`ferrisquote-webapp`](./ferrisquote-webapp/) | Web frontend (port 5173) | React 19, Vite, TanStack Query, XYFlow |

## Relationship with libs

```
ferrisquote-api
  ├── ferrisquote-domain    (business logic, entities, ports/traits)
  └── ferrisquote-postgres  (PostgreSQL repository implementations)

ferrisquote-webapp
  └── API client generated from the ferrisquote-api OpenAPI spec
```

## Quick start

```bash
# Backend (from repo root)
cargo run -p ferrisquote-api

# Frontend
cd apps/ferrisquote-webapp && pnpm dev
```

See `compose.yaml` at the repo root for a full setup with PostgreSQL.
