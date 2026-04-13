# ferrisquote-domain

Pure business logic crate for FerrisQuote. Contains entities, domain services, and repository/service port definitions (traits). This crate has **zero I/O dependencies** -- it never touches a database, network, or filesystem directly.

## Domain modules

### Flows

The core domain. A **Flow** is a configurable quote template composed of ordered **Steps**, each containing ordered **Fields**.

```
Flow
 └── Step (ordered by LexoRank)
      └── Field (ordered by LexoRank, typed via FieldConfig)
```

**Entities:** `Flow`, `Step`, `Field`, `FieldConfig` (enum: Text, Number, Date, Boolean, Select)

**Ports (traits):**

| Trait | Role |
|---|---|
| `FlowRepository` | CRUD persistence for flows |
| `StepRepository` | CRUD persistence for steps |
| `FieldRepository` | CRUD persistence for fields |
| `FlowService` | Flow-level business operations |
| `StepService` | Step ordering, creation, deletion |
| `FieldService` | Field creation, update, move between steps |

**Service implementation:** `FlowServiceImpl<FR, SR, FDR, RS>` -- a generic orchestrator that implements all three service traits. It delegates persistence to injected repositories and uses a `RankService` to compute LexoRank ordering.

### Estimator

Estimation engine with variables and expression evaluation (via `evalexpr`).

**Entities:** `Estimator`, `EstimatorVariable`

### Rank

Abstraction over LexoRank ordering. Provides a `RankService` trait with `initial()`, `between()`, `after()`, `before()` operations. The concrete implementation (`LexoRankProvider`) uses the `lexorank` crate.

## Key design decisions

- **Partial updates**: repository `update_*` methods accept `Option<T>` fields -- only `Some(...)` values are persisted, `None` fields are left untouched.
- **LexoRank ordering**: steps and fields use string-based lexicographic ranks instead of integer positions, enabling reordering without renumbering.
- **No async-trait macro**: port traits use `impl Future<Output = ...> + Send` return types (Rust edition 2024) instead of the `async-trait` proc macro.
