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
        "SELECT id, flow_id, title, description, rank, is_repeatable, repeat_label, min_repeats, max_repeats \
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
            let config_json: sqlx::types::Json<FieldConfig> =
                row.try_get("config").map_err(|e| {
                    DomainError::internal(format!("Failed to decode field config: {e}"))
                })?;
            let field = Field::with_id(
                FieldId::from_uuid(row.get("id")),
                row.get("key"),
                row.get("label"),
                row.get::<Option<String>, _>("description")
                    .unwrap_or_default(),
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
            row.get::<Option<String>, _>("description")
                .unwrap_or_default(),
            row.get("rank"),
            row.get("is_repeatable"),
            row.get("repeat_label"),
            row.get::<i32, _>("min_repeats") as u32,
            row.get::<Option<i32>, _>("max_repeats").map(|v| v as u32),
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
        row.get::<Option<String>, _>("description")
            .unwrap_or_default(),
        steps,
    )
}

// ============================================================================
// FlowRepository
// ============================================================================

impl FlowRepository for PostgresFlowRepository {
    async fn create_flow(&self, flow: Flow) -> Result<Flow, DomainError> {
        sqlx::query(
            "INSERT INTO flows (id, name, description, created_at, updated_at) \
             VALUES ($1, $2, $3, NOW(), NOW())",
        )
        .bind(flow.id.into_uuid())
        .bind(&flow.name)
        .bind(&flow.description)
        .execute(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?;

        Ok(flow)
    }

    async fn get_flow(&self, id: FlowId) -> Result<Flow, DomainError> {
        let row = sqlx::query("SELECT id, name, description FROM flows WHERE id = $1")
            .bind(id.into_uuid())
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?
            .ok_or_else(|| DomainError::not_found("Flow", id.to_string()))?;

        let flow_uuid: Uuid = row.get("id");
        let mut steps_map = load_steps_for_flows(&self.pool, &[flow_uuid]).await?;
        let steps = steps_map.remove(&flow_uuid).unwrap_or_default();

        Ok(build_flow(&row, steps))
    }

    async fn list_flows(&self) -> Result<Vec<Flow>, DomainError> {
        let rows = sqlx::query("SELECT id, name, description FROM flows ORDER BY created_at DESC")
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?;

        let flow_ids: Vec<Uuid> = rows.iter().map(|r| r.get("id")).collect();
        let mut steps_map = load_steps_for_flows(&self.pool, &flow_ids).await?;

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

    async fn update_flow(
        &self,
        id: FlowId,
        name: Option<String>,
        description: Option<String>,
    ) -> Result<Flow, DomainError> {
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
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?
        .ok_or_else(|| DomainError::not_found("Flow", id.to_string()))?;

        let flow_uuid: Uuid = row.get("id");
        let mut steps_map = load_steps_for_flows(&self.pool, &[flow_uuid]).await?;
        let steps = steps_map.remove(&flow_uuid).unwrap_or_default();

        Ok(build_flow(&row, steps))
    }

    async fn delete_flow(&self, id: FlowId) -> Result<(), DomainError> {
        let result = sqlx::query("DELETE FROM flows WHERE id = $1")
            .bind(id.into_uuid())
            .execute(&*self.pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?;

        if result.rows_affected() == 0 {
            return Err(DomainError::not_found("Flow", id.to_string()));
        }

        Ok(())
    }
}

// ============================================================================
// StepRepository
// ============================================================================

impl StepRepository for PostgresFlowRepository {
    async fn create_step(&self, flow_id: FlowId, step: Step) -> Result<Step, DomainError> {
        sqlx::query(
            "INSERT INTO steps (id, flow_id, title, description, rank, is_repeatable, repeat_label, min_repeats, max_repeats, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())",
        )
        .bind(step.id.into_uuid())
        .bind(flow_id.into_uuid())
        .bind(&step.title)
        .bind(&step.description)
        .bind(&step.rank)
        .bind(step.is_repeatable)
        .bind(&step.repeat_label)
        .bind(step.min_repeats as i32)
        .bind(step.max_repeats.map(|v| v as i32))
        .execute(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?;

        Ok(step)
    }

    async fn get_step(&self, id: StepId) -> Result<Step, DomainError> {
        let row = sqlx::query(
            "SELECT id, title, description, rank, is_repeatable, repeat_label, min_repeats, max_repeats FROM steps WHERE id = $1",
        )
        .bind(id.into_uuid())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?
        .ok_or_else(|| DomainError::not_found("Step", id.to_string()))?;

        let step_uuid: Uuid = row.get("id");
        let field_rows = sqlx::query(
            "SELECT id, key, label, description, rank, config \
             FROM fields WHERE steps_id = $1 ORDER BY rank",
        )
        .bind(step_uuid)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?;

        let mut fields = Vec::new();
        for fr in field_rows {
            let config_json: sqlx::types::Json<FieldConfig> =
                fr.try_get("config").map_err(|e| {
                    DomainError::internal(format!("Failed to decode field config: {e}"))
                })?;
            fields.push(Field::with_id(
                FieldId::from_uuid(fr.get("id")),
                fr.get("key"),
                fr.get("label"),
                fr.get::<Option<String>, _>("description")
                    .unwrap_or_default(),
                fr.get("rank"),
                config_json.0,
            ));
        }

        Ok(Step::with_fields(
            StepId::from_uuid(step_uuid),
            row.get("title"),
            row.get::<Option<String>, _>("description")
                .unwrap_or_default(),
            row.get("rank"),
            row.get("is_repeatable"),
            row.get("repeat_label"),
            row.get::<i32, _>("min_repeats") as u32,
            row.get::<Option<i32>, _>("max_repeats").map(|v| v as u32),
            fields,
        ))
    }

    async fn update_step(
        &self,
        id: StepId,
        title: Option<String>,
        description: Option<String>,
        rank: Option<String>,
        is_repeatable: Option<bool>,
        repeat_label: Option<Option<String>>,
        min_repeats: Option<u32>,
        max_repeats: Option<Option<u32>>,
    ) -> Result<Step, DomainError> {
        sqlx::query(
            "UPDATE steps \
             SET title = COALESCE($2, title), \
                 description = COALESCE($3, description), \
                 rank = COALESCE($4, rank), \
                 is_repeatable = COALESCE($5, is_repeatable), \
                 repeat_label = CASE WHEN $6 THEN $7 ELSE repeat_label END, \
                 min_repeats = COALESCE($8, min_repeats), \
                 max_repeats = CASE WHEN $9 THEN $10 ELSE max_repeats END, \
                 updated_at = NOW() \
             WHERE id = $1",
        )
        .bind(id.into_uuid())
        .bind(title)
        .bind(description)
        .bind(rank)
        .bind(is_repeatable)
        .bind(repeat_label.is_some())
        .bind(repeat_label.flatten())
        .bind(min_repeats.map(|v| v as i32))
        .bind(max_repeats.is_some())
        .bind(max_repeats.flatten().map(|v| v as i32))
        .execute(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?;

        // Reload the step with its fields
        let row = sqlx::query(
            "SELECT id, title, description, rank, is_repeatable, repeat_label, min_repeats, max_repeats FROM steps WHERE id = $1",
        )
        .bind(id.into_uuid())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?
        .ok_or_else(|| DomainError::not_found("Step", id.to_string()))?;

        Ok(Step::with_fields(
            StepId::from_uuid(row.get("id")),
            row.get("title"),
            row.get::<Option<String>, _>("description")
                .unwrap_or_default(),
            row.get("rank"),
            row.get("is_repeatable"),
            row.get("repeat_label"),
            row.get::<i32, _>("min_repeats") as u32,
            row.get::<Option<i32>, _>("max_repeats").map(|v| v as u32),
            vec![],
        ))
    }

    async fn delete_step(&self, id: StepId) -> Result<(), DomainError> {
        let result = sqlx::query("DELETE FROM steps WHERE id = $1")
            .bind(id.into_uuid())
            .execute(&*self.pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?;

        if result.rows_affected() == 0 {
            return Err(DomainError::not_found("Step", id.to_string()));
        }

        Ok(())
    }
}

// ============================================================================
// FieldRepository
// ============================================================================

impl FieldRepository for PostgresFlowRepository {
    async fn create_field(&self, step_id: StepId, field: Field) -> Result<Field, DomainError> {
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
        .execute(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?;

        Ok(field)
    }

    async fn update_field(
        &self,
        field_id: FieldId,
        key: Option<String>,
        label: Option<String>,
        description: Option<String>,
        config: Option<FieldConfig>,
    ) -> Result<Field, DomainError> {
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
        .fetch_optional(&*self.pool)
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
            row.get::<Option<String>, _>("description")
                .unwrap_or_default(),
            row.get("rank"),
            config_json.0,
        ))
    }

    async fn delete_field(&self, id: FieldId) -> Result<(), DomainError> {
        let result = sqlx::query("DELETE FROM fields WHERE id = $1")
            .bind(id.into_uuid())
            .execute(&*self.pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?;

        if result.rows_affected() == 0 {
            return Err(DomainError::not_found("Field", id.to_string()));
        }

        Ok(())
    }

    async fn get_flow_fields(
        &self,
        flow_id: FlowId,
        like: Option<String>,
    ) -> Result<Vec<Field>, DomainError> {
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
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?;

        let mut fields = Vec::new();
        for row in rows {
            let config_json: sqlx::types::Json<FieldConfig> =
                row.try_get("config").map_err(|e| {
                    DomainError::internal(format!("Failed to decode field config: {e}"))
                })?;
            fields.push(Field::with_id(
                FieldId::from_uuid(row.get("id")),
                row.get("key"),
                row.get("label"),
                row.get::<Option<String>, _>("description")
                    .unwrap_or_default(),
                row.get("rank"),
                config_json.0,
            ));
        }

        Ok(fields)
    }
}
