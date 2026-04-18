use std::{collections::HashMap, future::Future};

use crate::domain::{error::DomainError, flows::entities::ids::FlowId};

use super::entities::{
    estimator::Estimator,
    ids::{EstimatorId, EstimatorVariableId},
    submission::SubmissionData,
    variable::EstimatorVariable,
};

/// Repository trait for Estimator persistence.
pub trait EstimatorRepository: Send + Sync {
    fn create_estimator(
        &self,
        estimator: Estimator,
    ) -> impl Future<Output = Result<Estimator, DomainError>> + Send;

    fn get_estimator(
        &self,
        id: EstimatorId,
    ) -> impl Future<Output = Result<Estimator, DomainError>> + Send;

    fn list_estimators_for_flow(
        &self,
        flow_id: FlowId,
    ) -> impl Future<Output = Result<Vec<Estimator>, DomainError>> + Send;

    /// Partial update: only fields set to `Some(...)` are written.
    fn update_estimator(
        &self,
        id: EstimatorId,
        name: Option<String>,
    ) -> impl Future<Output = Result<Estimator, DomainError>> + Send;

    fn delete_estimator(
        &self,
        id: EstimatorId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send;

    fn add_variable(
        &self,
        estimator_id: EstimatorId,
        variable: EstimatorVariable,
    ) -> impl Future<Output = Result<EstimatorVariable, DomainError>> + Send;

    /// Partial update: only fields set to `Some(...)` are written.
    fn update_variable(
        &self,
        id: EstimatorVariableId,
        name: Option<String>,
        expression: Option<String>,
        description: Option<String>,
    ) -> impl Future<Output = Result<EstimatorVariable, DomainError>> + Send;

    fn remove_variable(
        &self,
        id: EstimatorVariableId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send;
}

/// Service trait for Estimator domain logic.
pub trait EstimatorService: Send + Sync {
    // --- CRUD ---

    fn create_estimator(
        &self,
        flow_id: FlowId,
        name: String,
    ) -> impl Future<Output = Result<Estimator, DomainError>> + Send;

    fn get_estimator(
        &self,
        id: EstimatorId,
    ) -> impl Future<Output = Result<Estimator, DomainError>> + Send;

    fn list_estimators_for_flow(
        &self,
        flow_id: FlowId,
    ) -> impl Future<Output = Result<Vec<Estimator>, DomainError>> + Send;

    fn update_estimator(
        &self,
        id: EstimatorId,
        name: Option<String>,
    ) -> impl Future<Output = Result<Estimator, DomainError>> + Send;

    fn delete_estimator(
        &self,
        id: EstimatorId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send;

    fn add_variable(
        &self,
        estimator_id: EstimatorId,
        name: String,
        expression: String,
        description: String,
    ) -> impl Future<Output = Result<EstimatorVariable, DomainError>> + Send;

    fn update_variable(
        &self,
        id: EstimatorVariableId,
        name: Option<String>,
        expression: Option<String>,
        description: Option<String>,
    ) -> impl Future<Output = Result<EstimatorVariable, DomainError>> + Send;

    fn remove_variable(
        &self,
        id: EstimatorVariableId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send;

    // --- Evaluation ---

    fn evaluate(
        &self,
        estimator_id: EstimatorId,
        field_values: HashMap<String, f64>,
    ) -> impl Future<Output = Result<HashMap<String, f64>, DomainError>> + Send;

    fn evaluate_submission(
        &self,
        estimator_id: EstimatorId,
        data: SubmissionData,
    ) -> impl Future<Output = Result<HashMap<String, f64>, DomainError>> + Send;

    /// Evaluate every estimator of a flow, resolving cross-estimator refs.
    ///
    /// Returns a nested map `estimator_name → variable_name → value`.
    fn evaluate_flow(
        &self,
        flow_id: FlowId,
        data: SubmissionData,
    ) -> impl Future<Output = Result<HashMap<String, HashMap<String, f64>>, DomainError>> + Send;
}
