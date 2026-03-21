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
    ///
    /// The repository should update only the fields that are provided (`Some(_)`).
    /// Fields set to `None` must remain unchanged in storage. This avoids a
    /// full select-and-rewrite on the caller side and lets repositories apply
    /// partial updates atomically where supported.
    fn update_flow(
        &self,
        id: FlowId,
        name: Option<String>,
        description: Option<String>,
    ) -> impl Future<Output = Result<Flow, DomainError>> + Send;
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

    /// Update an existing step (partial update).
    ///
    /// The repository should update only the fields provided as `Some(...)`.
    /// Fields set to `None` must remain unchanged in storage. This avoids a
    /// full select-and-rewrite on the caller side and lets repositories apply
    /// partial updates atomically where supported.
    fn update_step(
        &self,
        id: StepId,
        title: Option<String>,
        description: Option<String>,
        rank: Option<String>,
    ) -> impl Future<Output = Result<Step, DomainError>> + Send;
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
    ///
    /// The repository should update only the fields provided as `Some(...)`.
    /// Fields set to `None` must remain unchanged in storage. This allows partial
    /// updates without requiring a full select-and-rewrite.
    fn update_field(
        &self,
        field_id: FieldId,
        key: Option<String>,
        label: Option<String>,
        description: Option<String>,
        config: Option<FieldConfig>,
    ) -> impl Future<Output = Result<Field, DomainError>> + Send;
    /// Delete a field by id.
    fn delete_field(&self, id: FieldId) -> impl Future<Output = Result<(), DomainError>> + Send;
    /// Get all fields for a flow.
    fn get_flow_fields(
        &self,
        flow_id: FlowId,
        like: Option<String>,
    ) -> impl Future<Output = Result<Vec<Field>, DomainError>> + Send;
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
        name: Option<String>,
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

    /// Update a step's metadata.
    fn update_step_metadata(
        &self,
        step_id: StepId,
        title: Option<String>,
        description: Option<String>,
    ) -> impl Future<Output = Result<Step, DomainError>> + Send;
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
    /// Update a field's configuration and/or label.
    ///
    /// This is a partial-update API: only the provided fields (`Some(...)`) are
    /// changed by the repository. Fields set to `None` are left untouched.
    fn update_field_config(
        &self,
        field_id: FieldId,
        label: Option<String>,
        config: Option<FieldConfig>,
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
    ) -> impl Future<Output = Result<Flow, DomainError>> + Send;

    /// Search for fields within a flow.
    fn search_flow_fields(
        &self,
        flow_id: FlowId,
        _query: Option<String>,
    ) -> impl Future<Output = Result<Vec<Field>, DomainError>> + Send;
}
