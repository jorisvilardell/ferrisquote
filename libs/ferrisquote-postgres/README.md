# ferrisquote-postgres

PostgreSQL persistence layer for FerrisQuote. Implements the repository traits defined in `ferrisquote-domain` using SQLx.

## Architecture

This crate is a **secondary adapter** in the hexagonal architecture: it depends on `ferrisquote-domain` and implements its port traits (`FlowRepository`, `StepRepository`, `FieldRepository`) against a real PostgreSQL database.

```
ferrisquote-domain (traits)
        ▲
        │ implements
        │
ferrisquote-postgres
  └── PostgresFlowRepository (SQLx + PgPool)
```

## Repository

`PostgresFlowRepository` holds an `sqlx::PgPool` and implements all three repository traits:

- **FlowRepository** -- CRUD on the `flows` table
- **StepRepository** -- CRUD on the `steps` table (with LexoRank ordering)
- **FieldRepository** -- CRUD on the `fields` table (config stored as JSONB)

## Database schema

### flows

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `name` | `VARCHAR(128)` | |
| `description` | `TEXT` | |
| `created_at` / `updated_at` | `TIMESTAMP` | auto-set |

### steps

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `flow_id` | `UUID` | FK -> flows (CASCADE) |
| `title` | `VARCHAR(128)` | |
| `description` | `TEXT` | |
| `rank` | `VARCHAR(255)` | LexoRank string, indexed with `flow_id` |

### fields

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `steps_id` | `UUID` | FK -> steps (CASCADE) |
| `key` | `VARCHAR(32)` | |
| `label` | `VARCHAR(255)` | |
| `description` | `TEXT` | |
| `config` | `JSONB` | Typed field configuration |
| `rank` | `VARCHAR(255)` | LexoRank string, indexed with `steps_id` |

## Migrations

Migrations are managed with SQLx and located in `migrations/`. They include:

1. `create_flows_table` -- base flows table
2. `create_steps_table` -- steps with FK to flows + rank index
3. `create_fields_table` -- fields with FK to steps + JSONB config + rank index
4. `create_estimators_table` -- estimator definitions
5. `create_estimator_variables_table` -- estimator variables

Run migrations:

```bash
sqlx migrate run --source libs/ferrisquote-postgres/migrations
```

## Usage

```rust
let pool = PgPoolOptions::new()
    .max_connections(5)
    .connect(&database_url)
    .await?;

let repo = PostgresFlowRepository::new(pool);
// repo implements FlowRepository + StepRepository + FieldRepository
```
