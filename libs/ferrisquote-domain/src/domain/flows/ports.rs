use std::future::Future;

use crate::domain::error::DomainError;

use super::entities::{
    field::{Field, FieldConfig},
    flow::Flow,
    ids::{FieldId, FlowId, StepId},
    step::Step,
};

/// Repository trait for Flow entity.
pub trait FlowRepository: Send + Sync {
    /// Create a new flow.
    fn create_flow(&self, flow: Flow) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    /// Retrieve a flow by id.
    fn get_flow(&self, id: FlowId) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    /// List all flows.
    fn list_flows(&self) -> impl Future<Output = Result<Vec<Flow>, DomainError>> + Send;
    /// Update an existing flow.
    fn update_flow(&self, flow: Flow) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    /// Delete a flow by id.
    fn delete_flow(&self, id: FlowId) -> impl Future<Output = Result<(), DomainError>> + Send;
}

/// Repository trait for Step entity.
pub trait StepRepository: Send + Sync {
    /// Create a new step within a flow.
    fn create_step(
        &self,
        flow_id: FlowId,
        step: Step,
    ) -> impl Future<Output = Result<Step, DomainError>> + Send;

    /// Retrieve a step by id.
    fn get_step(&self, id: StepId) -> impl Future<Output = Result<Step, DomainError>> + Send;

    /// Update an existing step.
    fn update_step(&self, step: Step) -> impl Future<Output = Result<Step, DomainError>> + Send;
    /// Delete a step by id.
    fn delete_step(&self, id: StepId) -> impl Future<Output = Result<(), DomainError>> + Send;
}

/// Repository trait for Field entity.
pub trait FieldRepository: Send + Sync {
    /// Create a new field within a step.
    fn create_field(
        &self,
        step_id: StepId,
        field: Field,
    ) -> impl Future<Output = Result<Field, DomainError>> + Send;
    /// Update an existing field.
    fn update_field(&self, field: Field)
    -> impl Future<Output = Result<Field, DomainError>> + Send;
    /// Delete a field by id.
    fn delete_field(&self, id: FieldId) -> impl Future<Output = Result<(), DomainError>> + Send;
}

/// Service trait for Flow domain logic.
pub trait FlowService: Send + Sync {
    /// Create a flow with a given name.
    fn create_flow(&self, name: String) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    /// Get a flow by id.
    fn get_flow(&self, id: FlowId) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    /// List all flows.
    fn list_flows(&self) -> impl Future<Output = Result<Vec<Flow>, DomainError>> + Send;
    /// Update flow metadata.
    fn update_flow_metadata(
        &self,
        id: FlowId,
        name: String,
        description: Option<String>,
    ) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    /// Delete a flow by id.
    fn delete_flow(&self, id: FlowId) -> impl Future<Output = Result<(), DomainError>> + Send;
}

/// Service trait for Step domain logic.
pub trait StepService: Send + Sync {
    /// Add a step to a flow.
    fn add_step(
        &self,
        flow_id: FlowId,
        title: String,
    ) -> impl Future<Output = Result<Step, DomainError>> + Send;
    /// Remove a step by id.
    fn remove_step(&self, step_id: StepId) -> impl Future<Output = Result<(), DomainError>> + Send;
    /// Reorder a step within its flow.
    fn reorder_step(
        &self,
        step_id: StepId,
        after_id: Option<StepId>,
        before_id: Option<StepId>,
    ) -> impl Future<Output = Result<Flow, DomainError>> + Send;
}

/// Service trait for Field domain logic.
pub trait FieldService: Send + Sync {
    /// Add a field to a step.
    fn add_field(
        &self,
        step_id: StepId,
        label: String,
        key: String,
        config: FieldConfig,
    ) -> impl Future<Output = Result<Field, DomainError>> + Send;
    /// Update a field's configuration and label.
    fn update_field_config(
        &self,
        field_id: FieldId,
        label: String,
        config: FieldConfig,
    ) -> impl Future<Output = Result<Field, DomainError>> + Send;
    /// Remove a field by id.
    fn remove_field(
        &self,
        field_id: FieldId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send;

    /// Move a field into a step or change its order.
    fn move_field(
        &self,
        field_id: FieldId,
        target_step_id: Option<StepId>,
        after_id: Option<FieldId>,
        before_id: Option<FieldId>,
        new_order: u32,
    ) -> impl Future<Output = Result<Flow, DomainError>> + Send;
}
