# Libs

Shared libraries of the FerrisQuote monorepo. Each crate is self-contained and follows a hexagonal architecture (ports & adapters).

## Contents

| Crate | Role | Internal dependencies |
|---|---|---|
| [`ferrisquote-domain`](./ferrisquote-domain/) | Business core: entities, services, ports (traits) | None |
| [`ferrisquote-auth`](./ferrisquote-auth/) | OIDC / JWT authentication (token validation via JWKS) | None |
| [`ferrisquote-postgres`](./ferrisquote-postgres/) | PostgreSQL implementation of the repository traits | `ferrisquote-domain` |

## Architecture overview

```
                   ferrisquote-api (app)
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
   ferrisquote-   ferrisquote-  ferrisquote-
      auth          domain       postgres
                      ▲              │
                      └──────────────┘
                   (implements the ports)
```

- **domain** has zero infrastructure dependencies (no I/O). It defines the traits (`FlowRepository`, `StepRepository`, etc.) that adapters implement.
- **postgres** depends on **domain** to implement those traits using SQLx.
- **auth** is standalone and communicates with an OIDC IdP over HTTP.
