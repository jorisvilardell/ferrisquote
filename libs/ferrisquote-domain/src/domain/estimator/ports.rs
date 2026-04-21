use std::{collections::HashMap, future::Future};

use crate::domain::{error::DomainError, flows::entities::ids::FlowId};

use super::entities::{
    estimator::Estimator,
    ids::{EstimatorId, EstimatorInputId, EstimatorOutputId},
    output::EstimatorOutput,
    parameter::{EstimatorParameter, EstimatorParameterType},
    submission::SubmissionData,
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

    fn update_estimator(
        &self,
        id: EstimatorId,
        name: Option<String>,
        description: Option<String>,
    ) -> impl Future<Output = Result<Estimator, DomainError>> + Send;

    fn delete_estimator(
        &self,
        id: EstimatorId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send;

    fn add_input(
        &self,
        estimator_id: EstimatorId,
        input: EstimatorParameter,
    ) -> impl Future<Output = Result<EstimatorParameter, DomainError>> + Send;

    fn update_input(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorInputId,
        key: Option<String>,
        description: Option<String>,
        parameter_type: Option<EstimatorParameterType>,
    ) -> impl Future<Output = Result<EstimatorParameter, DomainError>> + Send;

    fn remove_input(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorInputId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send;

    fn add_output(
        &self,
        estimator_id: EstimatorId,
        output: EstimatorOutput,
    ) -> impl Future<Output = Result<EstimatorOutput, DomainError>> + Send;

    fn update_output(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorOutputId,
        key: Option<String>,
        expression: Option<String>,
        description: Option<String>,
    ) -> impl Future<Output = Result<EstimatorOutput, DomainError>> + Send;

    fn remove_output(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorOutputId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send;
}

/// Service trait for Estimator domain logic.
pub trait EstimatorService: Send + Sync {
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
        description: Option<String>,
    ) -> impl Future<Output = Result<Estimator, DomainError>> + Send;

    fn delete_estimator(
        &self,
        id: EstimatorId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send;

    fn add_input(
        &self,
        estimator_id: EstimatorId,
        key: String,
        description: String,
        parameter_type: EstimatorParameterType,
    ) -> impl Future<Output = Result<EstimatorParameter, DomainError>> + Send;

    fn update_input(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorInputId,
        key: Option<String>,
        description: Option<String>,
        parameter_type: Option<EstimatorParameterType>,
    ) -> impl Future<Output = Result<EstimatorParameter, DomainError>> + Send;

    fn remove_input(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorInputId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send;

    fn add_output(
        &self,
        estimator_id: EstimatorId,
        key: String,
        expression: String,
        description: String,
    ) -> impl Future<Output = Result<EstimatorOutput, DomainError>> + Send;

    fn update_output(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorOutputId,
        key: Option<String>,
        expression: Option<String>,
        description: Option<String>,
    ) -> impl Future<Output = Result<EstimatorOutput, DomainError>> + Send;

    fn remove_output(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorOutputId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send;

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

    fn evaluate_flow(
        &self,
        flow_id: FlowId,
        data: SubmissionData,
    ) -> impl Future<Output = Result<HashMap<String, HashMap<String, f64>>, DomainError>> + Send;
}
