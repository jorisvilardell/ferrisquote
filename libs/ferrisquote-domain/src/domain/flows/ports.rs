use std::collections::HashMap;
use std::future::Future;

use crate::domain::error::DomainError;
use crate::domain::estimator::entities::ids::EstimatorId;

use super::entities::{
    binding::{AggregationStrategy, EstimatorBinding, InputBindingValue},
    field::{Field, FieldConfig},
    flow::Flow,
    ids::{BindingId, FieldId, FlowId, StepId},
    step::Step,
};

/// Repository trait for Flow entity.
pub trait FlowRepository: Send + Sync {
    fn create_flow(&self, flow: Flow) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    fn get_flow(&self, id: FlowId) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    fn list_flows(&self) -> impl Future<Output = Result<Vec<Flow>, DomainError>> + Send;
    fn update_flow(
        &self,
        id: FlowId,
        name: Option<String>,
        description: Option<String>,
    ) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    fn delete_flow(&self, id: FlowId) -> impl Future<Output = Result<(), DomainError>> + Send;
}

pub trait StepRepository: Send + Sync {
    fn create_step(
        &self,
        flow_id: FlowId,
        step: Step,
    ) -> impl Future<Output = Result<Step, DomainError>> + Send;

    fn get_step(&self, id: StepId) -> impl Future<Output = Result<Step, DomainError>> + Send;

    fn update_step(
        &self,
        id: StepId,
        title: Option<String>,
        description: Option<String>,
        rank: Option<String>,
        is_repeatable: Option<bool>,
        repeat_label: Option<Option<String>>,
        min_repeats: Option<u32>,
        max_repeats: Option<Option<u32>>,
    ) -> impl Future<Output = Result<Step, DomainError>> + Send;

    fn delete_step(&self, id: StepId) -> impl Future<Output = Result<(), DomainError>> + Send;
}

pub trait FieldRepository: Send + Sync {
    fn create_field(
        &self,
        step_id: StepId,
        field: Field,
    ) -> impl Future<Output = Result<Field, DomainError>> + Send;

    fn update_field(
        &self,
        field_id: FieldId,
        key: Option<String>,
        label: Option<String>,
        description: Option<String>,
        config: Option<FieldConfig>,
    ) -> impl Future<Output = Result<Field, DomainError>> + Send;

    fn delete_field(&self, id: FieldId) -> impl Future<Output = Result<(), DomainError>> + Send;

    fn get_flow_fields(
        &self,
        flow_id: FlowId,
        like: Option<String>,
    ) -> impl Future<Output = Result<Vec<Field>, DomainError>> + Send;
}

/// Persistence contract for flow-level estimator bindings.
pub trait BindingRepository: Send + Sync {
    fn add_binding(
        &self,
        flow_id: FlowId,
        binding: EstimatorBinding,
    ) -> impl Future<Output = Result<EstimatorBinding, DomainError>> + Send;

    fn update_binding(
        &self,
        flow_id: FlowId,
        id: BindingId,
        inputs_mapping: Option<HashMap<String, InputBindingValue>>,
        map_over_step: Option<Option<StepId>>,
        outputs_reduce_strategy: Option<HashMap<String, AggregationStrategy>>,
    ) -> impl Future<Output = Result<EstimatorBinding, DomainError>> + Send;

    fn remove_binding(
        &self,
        flow_id: FlowId,
        id: BindingId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send;

    fn list_bindings(
        &self,
        flow_id: FlowId,
    ) -> impl Future<Output = Result<Vec<EstimatorBinding>, DomainError>> + Send;
}

pub trait FlowService: Send + Sync {
    fn create_flow(&self, name: String) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    fn get_flow(&self, id: FlowId) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    fn list_flows(&self) -> impl Future<Output = Result<Vec<Flow>, DomainError>> + Send;
    fn update_flow_metadata(
        &self,
        id: FlowId,
        name: Option<String>,
        description: Option<String>,
    ) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    fn delete_flow(&self, id: FlowId) -> impl Future<Output = Result<(), DomainError>> + Send;
}

pub trait StepService: Send + Sync {
    fn add_step(
        &self,
        flow_id: FlowId,
        title: String,
    ) -> impl Future<Output = Result<Step, DomainError>> + Send;
    fn remove_step(&self, step_id: StepId) -> impl Future<Output = Result<(), DomainError>> + Send;
    fn reorder_step(
        &self,
        step_id: StepId,
        after_id: Option<StepId>,
        before_id: Option<StepId>,
    ) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    fn update_step_metadata(
        &self,
        step_id: StepId,
        title: Option<String>,
        description: Option<String>,
        is_repeatable: Option<bool>,
        repeat_label: Option<Option<String>>,
        min_repeats: Option<u32>,
        max_repeats: Option<Option<u32>>,
    ) -> impl Future<Output = Result<Step, DomainError>> + Send;
}

pub trait FieldService: Send + Sync {
    fn add_field(
        &self,
        step_id: StepId,
        label: String,
        key: String,
        config: FieldConfig,
    ) -> impl Future<Output = Result<Field, DomainError>> + Send;

    fn update_field_config(
        &self,
        field_id: FieldId,
        label: Option<String>,
        key: Option<String>,
        description: Option<String>,
        config: Option<FieldConfig>,
    ) -> impl Future<Output = Result<Field, DomainError>> + Send;

    fn remove_field(
        &self,
        field_id: FieldId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send;

    fn move_field(
        &self,
        field_id: FieldId,
        target_step_id: Option<StepId>,
        after_id: Option<FieldId>,
        before_id: Option<FieldId>,
    ) -> impl Future<Output = Result<Flow, DomainError>> + Send;

    fn search_flow_fields(
        &self,
        flow_id: FlowId,
        _query: Option<String>,
    ) -> impl Future<Output = Result<Vec<Field>, DomainError>> + Send;
}

/// Service trait for Binding domain logic. Validates wiring against the
/// referenced estimator + parent flow before hitting the repository.
pub trait BindingService: Send + Sync {
    fn add_binding(
        &self,
        flow_id: FlowId,
        estimator_id: EstimatorId,
        inputs_mapping: HashMap<String, InputBindingValue>,
        map_over_step: Option<StepId>,
        outputs_reduce_strategy: HashMap<String, AggregationStrategy>,
    ) -> impl Future<Output = Result<EstimatorBinding, DomainError>> + Send;

    fn update_binding(
        &self,
        flow_id: FlowId,
        id: BindingId,
        inputs_mapping: Option<HashMap<String, InputBindingValue>>,
        map_over_step: Option<Option<StepId>>,
        outputs_reduce_strategy: Option<HashMap<String, AggregationStrategy>>,
    ) -> impl Future<Output = Result<EstimatorBinding, DomainError>> + Send;

    fn remove_binding(
        &self,
        flow_id: FlowId,
        id: BindingId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send;

    fn list_bindings(
        &self,
        flow_id: FlowId,
    ) -> impl Future<Output = Result<Vec<EstimatorBinding>, DomainError>> + Send;
}
