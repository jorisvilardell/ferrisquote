# ferrisquote-auth

Authentication library for FerrisQuote. Handles OIDC JWT token validation using JWKS (JSON Web Key Sets).

## Architecture

```
Token (JWT)
  │
  ▼
AuthRepository trait (port)
  │
  ├── validate_token()  → Claims
  └── identity()        → Identity
  │
  ▼
FerrisKeyRepository (adapter)
  └── Fetches JWKS from IdP → Decodes RS256 JWT → Validates expiry
```

## Entities

| Entity | Description |
|---|---|
| `Claims` | Decoded JWT payload (sub, iss, aud, exp, email, preferred_username, etc.) |
| `Identity` | Represents an authenticated user or client, derived from Claims |
| `Token` | Token wrapper |
| `Client` | OIDC client representation |
| `User` | Authenticated user representation |

## Port

The `AuthRepository` trait defines two async methods:

- `validate_token(token) -> Claims` -- decodes, verifies signature (RS256), and checks expiry
- `identity(token) -> Identity` -- validates the token then maps claims to an `Identity`

## Adapter: FerrisKeyRepository

Concrete implementation that:

1. Extracts `kid` from the JWT header
2. Fetches the JWKS from `{issuer}/protocol/openid-connect/certs`
3. Finds the matching public key
4. Decodes and validates the token using `jsonwebtoken`
5. Checks expiration (`exp` claim)

## Testing

The crate includes a full test suite with an embedded HTTP server that serves test JWKS, covering: invalid tokens, missing `kid`, network errors, expired tokens, and successful validation.

```bash
cargo test -p ferrisquote-auth
```
