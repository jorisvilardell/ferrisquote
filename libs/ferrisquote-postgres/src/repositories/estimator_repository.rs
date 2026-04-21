use std::sync::Arc;

use ferrisquote_domain::domain::{
    error::DomainError,
    estimator::{
        entities::{
            estimator::Estimator,
            id::{EstimatorId, EstimatorInputId, EstimatorOutputId},
            output::EstimatorOutput,
            parameter::{EstimatorParameter, EstimatorParameterType},
        },
        ports::EstimatorRepository,
    },
    flows::entities::id::FlowId,
};
use sqlx::{PgPool, Row};

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

fn row_to_estimator(row: &sqlx::postgres::PgRow) -> Result<Estimator, DomainError> {
    let inputs_json: sqlx::types::Json<Vec<EstimatorParameter>> = row
        .try_get("inputs")
        .map_err(|e| DomainError::internal(format!("Failed to decode inputs: {e}")))?;
    let outputs_json: sqlx::types::Json<Vec<EstimatorOutput>> = row
        .try_get("outputs")
        .map_err(|e| DomainError::internal(format!("Failed to decode outputs: {e}")))?;

    Ok(Estimator::with_full(
        EstimatorId::from_uuid(row.get("id")),
        FlowId::from_uuid(row.get("flow_id")),
        row.get("name"),
        row.get::<Option<String>, _>("description").unwrap_or_default(),
        inputs_json.0,
        outputs_json.0,
    ))
}

async fn write_inputs(
    pool: &PgPool,
    estimator_id: EstimatorId,
    inputs: &[EstimatorParameter],
) -> Result<(), DomainError> {
    let json = sqlx::types::Json(inputs);
    let result = sqlx::query("UPDATE estimators SET inputs = $2, updated_at = NOW() WHERE id = $1")
        .bind(estimator_id.into_uuid())
        .bind(json)
        .execute(pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?;
    if result.rows_affected() == 0 {
        return Err(DomainError::not_found("Estimator", estimator_id.to_string()));
    }
    Ok(())
}

async fn write_outputs(
    pool: &PgPool,
    estimator_id: EstimatorId,
    outputs: &[EstimatorOutput],
) -> Result<(), DomainError> {
    let json = sqlx::types::Json(outputs);
    let result = sqlx::query("UPDATE estimators SET outputs = $2, updated_at = NOW() WHERE id = $1")
        .bind(estimator_id.into_uuid())
        .bind(json)
        .execute(pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?;
    if result.rows_affected() == 0 {
        return Err(DomainError::not_found("Estimator", estimator_id.to_string()));
    }
    Ok(())
}

impl EstimatorRepository for PostgresEstimatorRepository {
    async fn create_estimator(&self, estimator: Estimator) -> Result<Estimator, DomainError> {
        let inputs_json = sqlx::types::Json(&estimator.inputs);
        let outputs_json = sqlx::types::Json(&estimator.outputs);
        sqlx::query(
            "INSERT INTO estimators (id, flow_id, name, description, inputs, outputs, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())",
        )
        .bind(estimator.id.into_uuid())
        .bind(estimator.flow_id.into_uuid())
        .bind(&estimator.name)
        .bind(&estimator.description)
        .bind(inputs_json)
        .bind(outputs_json)
        .execute(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?;

        Ok(estimator)
    }

    async fn get_estimator(&self, id: EstimatorId) -> Result<Estimator, DomainError> {
        let row = sqlx::query(
            "SELECT id, flow_id, name, description, inputs, outputs FROM estimators WHERE id = $1",
        )
        .bind(id.into_uuid())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?
        .ok_or_else(|| DomainError::not_found("Estimator", id.to_string()))?;

        row_to_estimator(&row)
    }

    async fn list_estimators_for_flow(
        &self,
        flow_id: FlowId,
    ) -> Result<Vec<Estimator>, DomainError> {
        let rows = sqlx::query(
            "SELECT id, flow_id, name, description, inputs, outputs FROM estimators \
             WHERE flow_id = $1 \
             ORDER BY created_at",
        )
        .bind(flow_id.into_uuid())
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?;

        rows.iter().map(row_to_estimator).collect()
    }

    async fn update_estimator(
        &self,
        id: EstimatorId,
        name: Option<String>,
        description: Option<String>,
    ) -> Result<Estimator, DomainError> {
        let row = sqlx::query(
            "UPDATE estimators \
             SET name = COALESCE($2, name), \
                 description = COALESCE($3, description), \
                 updated_at = NOW() \
             WHERE id = $1 \
             RETURNING id, flow_id, name, description, inputs, outputs",
        )
        .bind(id.into_uuid())
        .bind(name)
        .bind(description)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| DomainError::repository(e.to_string()))?
        .ok_or_else(|| DomainError::not_found("Estimator", id.to_string()))?;

        row_to_estimator(&row)
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

    async fn add_input(
        &self,
        estimator_id: EstimatorId,
        input: EstimatorParameter,
    ) -> Result<EstimatorParameter, DomainError> {
        let mut est = self.get_estimator(estimator_id).await?;
        if est.inputs.iter().any(|i| i.key == input.key) {
            return Err(DomainError::conflict(format!(
                "Input with key '{}' already exists on this estimator",
                input.key
            )));
        }
        est.inputs.push(input.clone());
        write_inputs(&self.pool, estimator_id, &est.inputs).await?;
        Ok(input)
    }

    async fn update_input(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorInputId,
        key: Option<String>,
        description: Option<String>,
        parameter_type: Option<EstimatorParameterType>,
    ) -> Result<EstimatorParameter, DomainError> {
        let mut est = self.get_estimator(estimator_id).await?;
        let pos = est
            .inputs
            .iter()
            .position(|i| i.id == id)
            .ok_or_else(|| DomainError::not_found("EstimatorInput", id.to_string()))?;

        if let Some(k) = key {
            if est.inputs.iter().enumerate().any(|(i, inp)| i != pos && inp.key == k) {
                return Err(DomainError::conflict(format!(
                    "Input with key '{k}' already exists on this estimator"
                )));
            }
            est.inputs[pos].key = k;
        }
        if let Some(d) = description {
            est.inputs[pos].description = d;
        }
        if let Some(pt) = parameter_type {
            est.inputs[pos].parameter_type = pt;
        }

        let updated = est.inputs[pos].clone();
        write_inputs(&self.pool, estimator_id, &est.inputs).await?;
        Ok(updated)
    }

    async fn remove_input(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorInputId,
    ) -> Result<(), DomainError> {
        let mut est = self.get_estimator(estimator_id).await?;
        let pos = est
            .inputs
            .iter()
            .position(|i| i.id == id)
            .ok_or_else(|| DomainError::not_found("EstimatorInput", id.to_string()))?;
        est.inputs.remove(pos);
        write_inputs(&self.pool, estimator_id, &est.inputs).await
    }

    async fn add_output(
        &self,
        estimator_id: EstimatorId,
        output: EstimatorOutput,
    ) -> Result<EstimatorOutput, DomainError> {
        let mut est = self.get_estimator(estimator_id).await?;
        if est.outputs.iter().any(|o| o.key == output.key) {
            return Err(DomainError::conflict(format!(
                "Output with key '{}' already exists on this estimator",
                output.key
            )));
        }
        est.outputs.push(output.clone());
        write_outputs(&self.pool, estimator_id, &est.outputs).await?;
        Ok(output)
    }

    async fn update_output(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorOutputId,
        key: Option<String>,
        expression: Option<String>,
        description: Option<String>,
    ) -> Result<EstimatorOutput, DomainError> {
        let mut est = self.get_estimator(estimator_id).await?;
        let pos = est
            .outputs
            .iter()
            .position(|o| o.id == id)
            .ok_or_else(|| DomainError::not_found("EstimatorOutput", id.to_string()))?;

        if let Some(k) = key {
            if est.outputs.iter().enumerate().any(|(i, o)| i != pos && o.key == k) {
                return Err(DomainError::conflict(format!(
                    "Output with key '{k}' already exists on this estimator"
                )));
            }
            est.outputs[pos].key = k;
        }
        if let Some(e) = expression {
            est.outputs[pos].expression = e;
        }
        if let Some(d) = description {
            est.outputs[pos].description = d;
        }

        let updated = est.outputs[pos].clone();
        write_outputs(&self.pool, estimator_id, &est.outputs).await?;
        Ok(updated)
    }

    async fn remove_output(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorOutputId,
    ) -> Result<(), DomainError> {
        let mut est = self.get_estimator(estimator_id).await?;
        let pos = est
            .outputs
            .iter()
            .position(|o| o.id == id)
            .ok_or_else(|| DomainError::not_found("EstimatorOutput", id.to_string()))?;
        est.outputs.remove(pos);
        write_outputs(&self.pool, estimator_id, &est.outputs).await
    }
}
