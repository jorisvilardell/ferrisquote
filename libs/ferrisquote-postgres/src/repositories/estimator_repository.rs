use std::collections::HashMap;
use std::sync::Arc;

use ferrisquote_domain::domain::{
    error::DomainError,
    estimator::{
        entities::{
            estimator::Estimator,
            ids::{EstimatorId, EstimatorVariableId},
            variable::EstimatorVariable,
        },
        ports::EstimatorRepository,
    },
    flows::entities::ids::FlowId,
};
use sqlx::{PgPool, Row};
use uuid::Uuid;

#[derive(Clone)]
pub struct PostgresEstimatorRepository {
    pool: Arc<PgPool>,
}

impl PostgresEstimatorRepository {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool: Arc::new(pool),
        }
    }

    pub fn with_pool(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }
}

async fn load_variables_for_estimators(
    pool: &PgPool,
    estimator_ids: &[Uuid],
) -> Result<HashMap<Uuid, Vec<EstimatorVariable>>, DomainError> {
    if estimator_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let rows = sqlx::query(
        "SELECT id, estimator_id, name, expression, description \
         FROM estimator_variables \
         WHERE estimator_id = ANY($1) \
         ORDER BY estimator_id, rank",
    )
    .bind(estimator_ids)
    .fetch_all(pool)
    .await
    .map_err(|e| DomainError::repository(e.to_string()))?;

    let mut map: HashMap<Uuid, Vec<EstimatorVariable>> = HashMap::new();
    for row in rows {
        let var = EstimatorVariable::with_id(
            EstimatorVariableId::from_uuid(row.get("id")),
            row.get("name"),
            row.get("expression"),
            row.get::<Option<String>, _>("description").unwrap_or_default(),
        );
        map.entry(row.get("estimator_id")).or_default().push(var);
    }

    Ok(map)
}

impl EstimatorRepository for PostgresEstimatorRepository {
    async fn create_estimator(&self, estimator: Estimator) -> Result<Estimator, DomainError> {
        sqlx::query(
            "INSERT INTO estimators (id, flow_id, name, created_at, updated_at) \
             VALUES ($1, $2, $3, NOW(), NOW())",
        )
        .bind(estimator.id.into_uuid())
        .bind(estimator.flow_id.into_uuid())
        .bind(&estimator.name)
        .execute(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?;

        Ok(estimator)
    }

    async fn get_estimator(&self, id: EstimatorId) -> Result<Estimator, DomainError> {
        let row = sqlx::query(
            "SELECT id, flow_id, name FROM estimators WHERE id = $1",
        )
        .bind(id.into_uuid())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?
        .ok_or_else(|| DomainError::not_found("Estimator", id.to_string()))?;

        let est_uuid: Uuid = row.get("id");
        let mut vars_map = load_variables_for_estimators(&self.pool, &[est_uuid]).await?;
        let variables = vars_map.remove(&est_uuid).unwrap_or_default();

        Ok(Estimator::with_variables(
            EstimatorId::from_uuid(est_uuid),
            FlowId::from_uuid(row.get("flow_id")),
            row.get("name"),
            variables,
        ))
    }

    async fn list_estimators_for_flow(
        &self,
        flow_id: FlowId,
    ) -> Result<Vec<Estimator>, DomainError> {
        let rows = sqlx::query(
            "SELECT id, flow_id, name FROM estimators \
             WHERE flow_id = $1 \
             ORDER BY created_at",
        )
        .bind(flow_id.into_uuid())
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?;

        let est_ids: Vec<Uuid> = rows.iter().map(|r| r.get("id")).collect();
        let mut vars_map = load_variables_for_estimators(&self.pool, &est_ids).await?;

        let estimators = rows
            .iter()
            .map(|row| {
                let eid: Uuid = row.get("id");
                let variables = vars_map.remove(&eid).unwrap_or_default();
                Estimator::with_variables(
                    EstimatorId::from_uuid(eid),
                    FlowId::from_uuid(row.get("flow_id")),
                    row.get("name"),
                    variables,
                )
            })
            .collect();

        Ok(estimators)
    }

    async fn update_estimator(
        &self,
        id: EstimatorId,
        name: Option<String>,
    ) -> Result<Estimator, DomainError> {
        let row = sqlx::query(
            "UPDATE estimators \
             SET name = COALESCE($2, name), \
                 updated_at = NOW() \
             WHERE id = $1 \
             RETURNING id, flow_id, name",
        )
        .bind(id.into_uuid())
        .bind(name)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?
        .ok_or_else(|| DomainError::not_found("Estimator", id.to_string()))?;

        let est_uuid: Uuid = row.get("id");
        let mut vars_map = load_variables_for_estimators(&self.pool, &[est_uuid]).await?;
        let variables = vars_map.remove(&est_uuid).unwrap_or_default();

        Ok(Estimator::with_variables(
            EstimatorId::from_uuid(est_uuid),
            FlowId::from_uuid(row.get("flow_id")),
            row.get("name"),
            variables,
        ))
    }

    async fn delete_estimator(&self, id: EstimatorId) -> Result<(), DomainError> {
        let result = sqlx::query("DELETE FROM estimators WHERE id = $1")
            .bind(id.into_uuid())
            .execute(&*self.pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?;

        if result.rows_affected() == 0 {
            return Err(DomainError::not_found("Estimator", id.to_string()));
        }

        Ok(())
    }

    async fn add_variable(
        &self,
        estimator_id: EstimatorId,
        variable: EstimatorVariable,
    ) -> Result<EstimatorVariable, DomainError> {
        sqlx::query(
            "INSERT INTO estimator_variables (id, estimator_id, name, expression, description, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())",
        )
        .bind(variable.id.into_uuid())
        .bind(estimator_id.into_uuid())
        .bind(&variable.name)
        .bind(&variable.expression)
        .bind(&variable.description)
        .execute(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?;

        Ok(variable)
    }

    async fn update_variable(
        &self,
        id: EstimatorVariableId,
        name: Option<String>,
        expression: Option<String>,
        description: Option<String>,
    ) -> Result<EstimatorVariable, DomainError> {
        let row = sqlx::query(
            "UPDATE estimator_variables \
             SET name = COALESCE($2, name), \
                 expression = COALESCE($3, expression), \
                 description = COALESCE($4, description), \
                 updated_at = NOW() \
             WHERE id = $1 \
             RETURNING id, name, expression, description",
        )
        .bind(id.into_uuid())
        .bind(name)
        .bind(expression)
        .bind(description)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?
        .ok_or_else(|| DomainError::not_found("EstimatorVariable", id.to_string()))?;

        Ok(EstimatorVariable::with_id(
            EstimatorVariableId::from_uuid(row.get("id")),
            row.get("name"),
            row.get("expression"),
            row.get::<Option<String>, _>("description").unwrap_or_default(),
        ))
    }

    async fn remove_variable(&self, id: EstimatorVariableId) -> Result<(), DomainError> {
        let result = sqlx::query("DELETE FROM estimator_variables WHERE id = $1")
            .bind(id.into_uuid())
            .execute(&*self.pool)
            .await
            .map_err(|e| DomainError::repository(e.to_string()))?;

        if result.rows_affected() == 0 {
            return Err(DomainError::not_found("EstimatorVariable", id.to_string()));
        }

        Ok(())
    }
}
