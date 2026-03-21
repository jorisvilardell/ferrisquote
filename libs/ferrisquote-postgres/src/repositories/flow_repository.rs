use std::collections::HashMap;
use std::sync::Arc;

use ferrisquote_domain::domain::{
    error::DomainError,
    flows::{
        entities::{
            field::{Field, FieldConfig},
            flow::Flow,
            ids::{FieldId, FlowId, StepId},
            step::Step,
        },
        ports::{FieldRepository, FlowRepository, StepRepository},
    },
};
use sqlx::{PgPool, Row};
use uuid::Uuid;

/// PostgreSQL implementation of FlowRepository, StepRepository and FieldRepository.
#[derive(Clone)]
pub struct PostgresFlowRepository {
    pool: Arc<PgPool>,
}

impl PostgresFlowRepository {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool: Arc::new(pool),
        }
    }

    pub fn with_pool(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }
}

// ============================================================================
// Helpers
// ============================================================================

/// Load steps (with their fields) for a list of flow IDs.
/// Returns a map flow_id → Vec<Step> sorted by rank.
async fn load_steps_for_flows(
    pool: &PgPool,
    flow_ids: &[Uuid],
) -> Result<HashMap<Uuid, Vec<Step>>, DomainError> {
    if flow_ids.is_empty() {
        return Ok(HashMap::new());
    }

    // Fetch steps for all given flows in one query
    let step_rows = sqlx::query(
        "SELECT id, flow_id, title, description, rank \
         FROM steps \
         WHERE flow_id = ANY($1) \
         ORDER BY flow_id, rank",
    )
    .bind(flow_ids)
    .fetch_all(pool)
    .await
    .map_err(|e| DomainError::repository(e.to_string()))?;

    let step_ids: Vec<Uuid> = step_rows.iter().map(|r| r.get::<Uuid, _>("id")).collect();

    // Fetch fields for all those steps in one query
    let mut fields_by_step: HashMap<Uuid, Vec<Field>> = HashMap::new();
    if !step_ids.is_empty() {
        let field_rows = sqlx::query(
            "SELECT id, steps_id, key, label, description, rank, config \
             FROM fields \
             WHERE steps_id = ANY($1) \
             ORDER BY steps_id, rank",
        )
        .bind(step_ids.as_slice())
        .fetch_all(pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?;

        for row in field_rows {
            let config_json: sqlx::types::Json<FieldConfig> = row
                .try_get("config")
                .map_err(|e| DomainError::internal(format!("Failed to decode field config: {e}")))?;
            let field = Field::with_id(
                FieldId::from_uuid(row.get("id")),
                row.get("key"),
                row.get("label"),
                row.get::<Option<String>, _>("description").unwrap_or_default(),
                row.get("rank"),
                config_json.0,
            );
            fields_by_step
                .entry(row.get("steps_id"))
                .or_default()
                .push(field);
        }
    }

    // Assemble steps with their fields, grouped by flow
    let mut steps_by_flow: HashMap<Uuid, Vec<Step>> = HashMap::new();
    for row in step_rows {
        let step_id: Uuid = row.get("id");
        let fields = fields_by_step.remove(&step_id).unwrap_or_default();
        let step = Step::with_fields(
            StepId::from_uuid(step_id),
            row.get("title"),
            row.get::<Option<String>, _>("description").unwrap_or_default(),
            row.get("rank"),
            fields,
        );
        steps_by_flow
            .entry(row.get("flow_id"))
            .or_default()
            .push(step);
    }

    Ok(steps_by_flow)
}

/// Build a full `Flow` from a row + pre-loaded steps map.
fn build_flow(row: &sqlx::postgres::PgRow, steps: Vec<Step>) -> Flow {
    Flow::with_steps(
        FlowId::from_uuid(row.get("id")),
        row.get("name"),
        row.get::<Option<String>, _>("description").unwrap_or_default(),
        steps,
    )
}

// ============================================================================
// FlowRepository
// ============================================================================

impl FlowRepository for PostgresFlowRepository {
    fn create_flow(
        &self,
        flow: Flow,
    ) -> impl std::future::Future<Output = Result<Flow, DomainError>> + Send {
        let pool = Arc::clone(&self.pool);
        async move {
            sqlx::query(
                "INSERT INTO flows (id, name, description, created_at, updated_at) \
                 VALUES ($1, $2, $3, NOW(), NOW())",
            )
            .bind(flow.id.into_uuid())
            .bind(&flow.name)
            .bind(&flow.description)
            .execute(&*pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?;

            Ok(flow)
        }
    }

    fn get_flow(
        &self,
        id: FlowId,
    ) -> impl std::future::Future<Output = Result<Flow, DomainError>> + Send {
        let pool = Arc::clone(&self.pool);
        async move {
            let row = sqlx::query("SELECT id, name, description FROM flows WHERE id = $1")
                .bind(id.into_uuid())
                .fetch_optional(&*pool)
                .await
                .map_err(|e| DomainError::repository(e.to_string()))?
                .ok_or_else(|| DomainError::not_found("Flow", id.to_string()))?;

            let flow_uuid: Uuid = row.get("id");
            let mut steps_map = load_steps_for_flows(&pool, &[flow_uuid]).await?;
            let steps = steps_map.remove(&flow_uuid).unwrap_or_default();

            Ok(build_flow(&row, steps))
        }
    }

    fn list_flows(
        &self,
    ) -> impl std::future::Future<Output = Result<Vec<Flow>, DomainError>> + Send {
        let pool = Arc::clone(&self.pool);
        async move {
            let rows = sqlx::query(
                "SELECT id, name, description FROM flows ORDER BY created_at DESC",
            )
            .fetch_all(&*pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?;

            let flow_ids: Vec<Uuid> = rows.iter().map(|r| r.get("id")).collect();
            let mut steps_map = load_steps_for_flows(&pool, &flow_ids).await?;

            let flows = rows
                .iter()
                .map(|row| {
                    let fid: Uuid = row.get("id");
                    let steps = steps_map.remove(&fid).unwrap_or_default();
                    build_flow(row, steps)
                })
                .collect();

            Ok(flows)
        }
    }

    fn update_flow(
        &self,
        id: FlowId,
        name: Option<String>,
        description: Option<String>,
    ) -> impl std::future::Future<Output = Result<Flow, DomainError>> + Send {
        let pool = Arc::clone(&self.pool);
        async move {
            let row = sqlx::query(
                "UPDATE flows \
                 SET name = COALESCE($2, name), \
                     description = COALESCE($3, description), \
                     updated_at = NOW() \
                 WHERE id = $1 \
                 RETURNING id, name, description",
            )
            .bind(id.into_uuid())
            .bind(name)
            .bind(description)
            .fetch_optional(&*pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?
            .ok_or_else(|| DomainError::not_found("Flow", id.to_string()))?;

            let flow_uuid: Uuid = row.get("id");
            let mut steps_map = load_steps_for_flows(&pool, &[flow_uuid]).await?;
            let steps = steps_map.remove(&flow_uuid).unwrap_or_default();

            Ok(build_flow(&row, steps))
        }
    }

    fn delete_flow(
        &self,
        id: FlowId,
    ) -> impl std::future::Future<Output = Result<(), DomainError>> + Send {
        let pool = Arc::clone(&self.pool);
        async move {
            let result = sqlx::query("DELETE FROM flows WHERE id = $1")
                .bind(id.into_uuid())
                .execute(&*pool)
                .await
                .map_err(|e| DomainError::repository(e.to_string()))?;

            if result.rows_affected() == 0 {
                return Err(DomainError::not_found("Flow", id.to_string()));
            }

            Ok(())
        }
    }
}

// ============================================================================
// StepRepository
// ============================================================================

impl StepRepository for PostgresFlowRepository {
    fn create_step(
        &self,
        flow_id: FlowId,
        step: Step,
    ) -> impl std::future::Future<Output = Result<Step, DomainError>> + Send {
        let pool = Arc::clone(&self.pool);
        async move {
            sqlx::query(
                "INSERT INTO steps (id, flow_id, title, description, rank, created_at, updated_at) \
                 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())",
            )
            .bind(step.id.into_uuid())
            .bind(flow_id.into_uuid())
            .bind(&step.title)
            .bind(&step.description)
            .bind(&step.rank)
            .execute(&*pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?;

            Ok(step)
        }
    }

    fn get_step(
        &self,
        id: StepId,
    ) -> impl std::future::Future<Output = Result<Step, DomainError>> + Send {
        let pool = Arc::clone(&self.pool);
        async move {
            let row = sqlx::query(
                "SELECT id, title, description, rank FROM steps WHERE id = $1",
            )
            .bind(id.into_uuid())
            .fetch_optional(&*pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?
            .ok_or_else(|| DomainError::not_found("Step", id.to_string()))?;

            let step_uuid: Uuid = row.get("id");
            let field_rows = sqlx::query(
                "SELECT id, key, label, description, rank, config \
                 FROM fields WHERE steps_id = $1 ORDER BY rank",
            )
            .bind(step_uuid)
            .fetch_all(&*pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?;

            let mut fields = Vec::new();
            for fr in field_rows {
                let config_json: sqlx::types::Json<FieldConfig> = fr
                    .try_get("config")
                    .map_err(|e| DomainError::internal(format!("Failed to decode field config: {e}")))?;
                fields.push(Field::with_id(
                    FieldId::from_uuid(fr.get("id")),
                    fr.get("key"),
                    fr.get("label"),
                    fr.get::<Option<String>, _>("description").unwrap_or_default(),
                    fr.get("rank"),
                    config_json.0,
                ));
            }

            Ok(Step::with_fields(
                StepId::from_uuid(step_uuid),
                row.get("title"),
                row.get::<Option<String>, _>("description").unwrap_or_default(),
                row.get("rank"),
                fields,
            ))
        }
    }

    fn update_step(
        &self,
        id: StepId,
        title: Option<String>,
        description: Option<String>,
        rank: Option<String>,
    ) -> impl std::future::Future<Output = Result<Step, DomainError>> + Send {
        let pool = Arc::clone(&self.pool);
        async move {
            sqlx::query(
                "UPDATE steps \
                 SET title = COALESCE($2, title), \
                     description = COALESCE($3, description), \
                     rank = COALESCE($4, rank), \
                     updated_at = NOW() \
                 WHERE id = $1",
            )
            .bind(id.into_uuid())
            .bind(title)
            .bind(description)
            .bind(rank)
            .execute(&*pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?;

            // Reload the step with its fields
            let row = sqlx::query(
                "SELECT id, title, description, rank FROM steps WHERE id = $1",
            )
            .bind(id.into_uuid())
            .fetch_optional(&*pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?
            .ok_or_else(|| DomainError::not_found("Step", id.to_string()))?;

            Ok(Step::with_id(
                StepId::from_uuid(row.get("id")),
                row.get("title"),
                row.get::<Option<String>, _>("description").unwrap_or_default(),
                row.get("rank"),
            ))
        }
    }

    fn delete_step(
        &self,
        id: StepId,
    ) -> impl std::future::Future<Output = Result<(), DomainError>> + Send {
        let pool = Arc::clone(&self.pool);
        async move {
            let result = sqlx::query("DELETE FROM steps WHERE id = $1")
                .bind(id.into_uuid())
                .execute(&*pool)
                .await
                .map_err(|e| DomainError::repository(e.to_string()))?;

            if result.rows_affected() == 0 {
                return Err(DomainError::not_found("Step", id.to_string()));
            }

            Ok(())
        }
    }
}

// ============================================================================
// FieldRepository
// ============================================================================

impl FieldRepository for PostgresFlowRepository {
    fn create_field(
        &self,
        step_id: StepId,
        field: Field,
    ) -> impl std::future::Future<Output = Result<Field, DomainError>> + Send {
        let pool = Arc::clone(&self.pool);
        async move {
            let config_json = sqlx::types::Json(&field.config);
            sqlx::query(
                "INSERT INTO fields (id, steps_id, key, label, description, rank, config, created_at, updated_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())",
            )
            .bind(field.id.into_uuid())
            .bind(step_id.into_uuid())
            .bind(&field.key)
            .bind(&field.label)
            .bind(&field.description)
            .bind(&field.rank)
            .bind(config_json)
            .execute(&*pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?;

            Ok(field)
        }
    }

    fn update_field(
        &self,
        field_id: FieldId,
        key: Option<String>,
        label: Option<String>,
        description: Option<String>,
        config: Option<FieldConfig>,
    ) -> impl std::future::Future<Output = Result<Field, DomainError>> + Send {
        let pool = Arc::clone(&self.pool);
        async move {
            let config_json = config.as_ref().map(sqlx::types::Json);
            let row = sqlx::query(
                "UPDATE fields \
                 SET key = COALESCE($2, key), \
                     label = COALESCE($3, label), \
                     description = COALESCE($4, description), \
                     config = COALESCE($5, config), \
                     updated_at = NOW() \
                 WHERE id = $1 \
                 RETURNING id, key, label, description, rank, config",
            )
            .bind(field_id.into_uuid())
            .bind(key)
            .bind(label)
            .bind(description)
            .bind(config_json)
            .fetch_optional(&*pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?
            .ok_or_else(|| DomainError::not_found("Field", field_id.to_string()))?;

            let config_json: sqlx::types::Json<FieldConfig> = row
                .try_get("config")
                .map_err(|e| DomainError::internal(format!("Failed to decode field config: {e}")))?;

            Ok(Field::with_id(
                FieldId::from_uuid(row.get("id")),
                row.get("key"),
                row.get("label"),
                row.get::<Option<String>, _>("description").unwrap_or_default(),
                row.get("rank"),
                config_json.0,
            ))
        }
    }

    fn delete_field(
        &self,
        id: FieldId,
    ) -> impl std::future::Future<Output = Result<(), DomainError>> + Send {
        let pool = Arc::clone(&self.pool);
        async move {
            let result = sqlx::query("DELETE FROM fields WHERE id = $1")
                .bind(id.into_uuid())
                .execute(&*pool)
                .await
                .map_err(|e| DomainError::repository(e.to_string()))?;

            if result.rows_affected() == 0 {
                return Err(DomainError::not_found("Field", id.to_string()));
            }

            Ok(())
        }
    }

    fn get_flow_fields(
        &self,
        flow_id: FlowId,
        like: Option<String>,
    ) -> impl std::future::Future<Output = Result<Vec<Field>, DomainError>> + Send {
        let pool = Arc::clone(&self.pool);
        async move {
            let pattern = like.map(|q| format!("%{q}%"));
            let rows = sqlx::query(
                "SELECT f.id, f.key, f.label, f.description, f.rank, f.config \
                 FROM fields f \
                 JOIN steps s ON s.id = f.steps_id \
                 WHERE s.flow_id = $1 \
                   AND ($2::TEXT IS NULL OR f.label ILIKE $2) \
                 ORDER BY s.rank, f.rank",
            )
            .bind(flow_id.into_uuid())
            .bind(pattern)
            .fetch_all(&*pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?;

            let mut fields = Vec::new();
            for row in rows {
                let config_json: sqlx::types::Json<FieldConfig> = row
                    .try_get("config")
                    .map_err(|e| DomainError::internal(format!("Failed to decode field config: {e}")))?;
                fields.push(Field::with_id(
                    FieldId::from_uuid(row.get("id")),
                    row.get("key"),
                    row.get("label"),
                    row.get::<Option<String>, _>("description").unwrap_or_default(),
                    row.get("rank"),
                    config_json.0,
                ));
            }

            Ok(fields)
        }
    }
}
