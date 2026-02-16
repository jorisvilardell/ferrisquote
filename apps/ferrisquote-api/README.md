# FerrisQuote API

REST API for FerrisQuote - A flexible quote and estimation management system built with Rust.

## 🏗️ Architecture

This API follows the **Hexagonal Architecture** (Ports & Adapters) pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                     HTTP Layer (Axum)                       │
│                  (Adaptateur Primaire)                      │
├─────────────────────────────────────────────────────────────┤
│  Handlers → DTOs → Validation → Service Layer              │
├─────────────────────────────────────────────────────────────┤
│                   Domain Layer (Business Logic)             │
│              ferrisquote-domain (Pure Rust)                 │
├─────────────────────────────────────────────────────────────┤
│              Repository (Ports/Interfaces)                  │
├─────────────────────────────────────────────────────────────┤
│               Infrastructure Layer                          │
│   In-Memory (temp) → PostgreSQL (future)                   │
│              (Adaptateur Secondaire)                        │
└─────────────────────────────────────────────────────────────┘
```

### Key Principles

- **Dependency Injection**: Services receive dependencies via constructors
- **Interface Segregation**: Domain defines ports (traits), infrastructure implements them
- **Pure Domain**: Business logic has zero infrastructure dependencies
- **Testability**: Every layer can be mocked and tested independently

## 🚀 Getting Started

### Prerequisites

- Rust 1.75+ (edition 2024)
- Cargo

### Running the API

```bash
# From the project root
cd apps/ferrisquote-api

# Copy environment variables
cp .env.example .env

# Run the API
cargo run
```

The API will start on `http://localhost:3000` by default.

### Testing

```bash
# Run all tests
cargo test

# Run with logs
RUST_LOG=debug cargo test -- --nocapture
```

### Development

```bash
# Watch mode with auto-reload
cargo watch -x run

# Check without building
cargo check

# Run with release optimizations
cargo run --release
```

## 📚 API Endpoints

### Health Check

```http
GET /health
```

Returns `OK` if the service is running.

### Flows

#### Create a Flow

```http
POST /api/v1/flows
Content-Type: application/json

{
  "name": "Website Quote",
  "description": "Quote for website development"
}
```

#### Get All Flows

```http
GET /api/v1/flows
```

#### Get a Flow by ID

```http
GET /api/v1/flows/{flow_id}
```

#### Update Flow Metadata

```http
PUT /api/v1/flows/{flow_id}
Content-Type: application/json

{
  "name": "Updated Website Quote",
  "description": "Updated description"
}
```

#### Delete a Flow

```http
DELETE /api/v1/flows/{flow_id}
```

### Steps

#### Add a Step to a Flow

```http
POST /api/v1/flows/{flow_id}/steps
Content-Type: application/json

{
  "title": "Project Details",
  "description": "Basic project information"
}
```

#### Remove a Step

```http
DELETE /api/v1/flows/steps/{step_id}
```

#### Reorder a Step

```http
PUT /api/v1/flows/steps/{step_id}/reorder
Content-Type: application/json

{
  "new_order": 2
}
```

### Fields

#### Add a Field to a Step

```http
POST /api/v1/flows/steps/{step_id}/fields
Content-Type: application/json

{
  "label": "Project Name",
  "key": "project_name",
  "config": {
    "type": "text",
    "max_length": 255
  }
}
```

**Field Types:**

- **Text**: `{ "type": "text", "max_length": 255 }`
- **Number**: `{ "type": "number", "min": 0, "max": 100 }`
- **Date**: `{ "type": "date", "min": "2024-01-01", "max": "2024-12-31" }`
- **Boolean**: `{ "type": "boolean", "default": false }`
- **Select**: `{ "type": "select", "options": ["Option 1", "Option 2"] }`

#### Update Field Configuration

```http
PUT /api/v1/flows/fields/{field_id}
Content-Type: application/json

{
  "label": "Updated Project Name",
  "config": {
    "type": "text",
    "max_length": 500
  }
}
```

#### Remove a Field

```http
DELETE /api/v1/flows/fields/{field_id}
```

#### Move a Field

```http
PUT /api/v1/flows/fields/{field_id}/move
Content-Type: application/json

{
  "target_step_id": "uuid-here",
  "new_order": 1
}
```

## 🔧 Configuration

Environment variables (see `.env.example`):

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `RUST_LOG` | Logging level | `ferrisquote_api=debug` |
| `DATABASE_URL` | PostgreSQL connection (future) | N/A |

## 🏛️ Project Structure

```
src/
├── main.rs                 # Application entry point & DI
├── dto/                    # Data Transfer Objects
│   ├── flows.rs           # Request/Response DTOs
│   └── mod.rs
├── handlers/               # HTTP Controllers
│   ├── flows.rs           # Flow endpoints
│   └── mod.rs
├── routes/                 # Route definitions
│   └── mod.rs
├── services/               # Business Logic
│   ├── flow_service.rs    # FlowService implementation
│   └── mod.rs
├── infrastructure/         # External adapters
│   ├── in_memory_repository.rs  # Temp storage
│   └── mod.rs
├── state.rs               # Application state
└── error.rs               # Error handling
```

## 🧪 Testing Strategy

### Unit Tests
- Domain logic (pure functions)
- Service layer with mocked repositories

### Integration Tests
- API endpoints with in-memory repository
- Full request/response cycle

### Example

```rust
#[tokio::test]
async fn test_create_flow() {
    let repo = Arc::new(InMemoryFlowRepository::new());
    let service = Arc::new(FlowServiceImpl::new(repo));
    
    let flow = service.create_flow("Test Flow".to_string()).await.unwrap();
    assert_eq!(flow.name, "Test Flow");
}
```

## 🔄 Future Improvements

- [ ] Replace in-memory repository with PostgreSQL (`ferrisquote-postgres`)
- [ ] Add authentication & authorization
- [ ] Implement pagination for list endpoints
- [ ] Add filtering and search capabilities
- [ ] WebSocket support for real-time updates
- [ ] OpenAPI/Swagger documentation
- [ ] Rate limiting
- [ ] Caching layer (Redis)

## 📖 API Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "type": "validation_error",
    "message": "Validation failed: name is required"
  }
}
```

### HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Server Error |

## 🤝 Contributing

When adding new endpoints:

1. Create DTOs in `dto/`
2. Add handler in `handlers/`
3. Define route in `routes/`
4. Add service method if needed
5. Update this README

## 📝 License

Apache-2.0