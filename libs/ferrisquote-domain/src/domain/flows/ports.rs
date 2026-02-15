use std::future::Future;

use crate::domain::error::DomainError;

use super::entities::{
    field::{Field, FieldConfig},
    flow::Flow,
    ids::{FieldId, FlowId, StepId},
    step::Step,
};

pub trait FlowRepository: Send + Sync {
    // --- Flow CRUD ---
    fn create_flow(&self, flow: Flow) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    fn get_flow(&self, id: FlowId) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    fn list_flows(&self) -> impl Future<Output = Result<Vec<Flow>, DomainError>> + Send;
    fn update_flow(&self, flow: Flow) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    fn delete_flow(&self, id: FlowId) -> impl Future<Output = Result<(), DomainError>> + Send;

    // --- Step CRUD ---
    fn create_step(
        &self,
        flow_id: FlowId,
        step: Step,
    ) -> impl Future<Output = Result<Step, DomainError>> + Send;
    fn update_step(&self, step: Step) -> impl Future<Output = Result<Step, DomainError>> + Send;
    fn delete_step(&self, id: StepId) -> impl Future<Output = Result<(), DomainError>> + Send;

    // --- Field CRUD ---
    fn create_field(
        &self,
        step_id: StepId,
        field: Field,
    ) -> impl Future<Output = Result<Field, DomainError>> + Send;
    fn update_field(&self, field: Field)
    -> impl Future<Output = Result<Field, DomainError>> + Send;
    fn delete_field(&self, id: FieldId) -> impl Future<Output = Result<(), DomainError>> + Send;
}

pub trait FlowService: Send + Sync {
    // --- Gestion du Flow ---
    fn create_flow(&self, name: String) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    fn get_flow(&self, id: FlowId) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    fn list_flows(&self) -> impl Future<Output = Result<Vec<Flow>, DomainError>> + Send;
    fn update_flow_metadata(
        &self,
        id: FlowId,
        name: String,
        description: Option<String>,
    ) -> impl Future<Output = Result<Flow, DomainError>> + Send;
    fn delete_flow(&self, id: FlowId) -> impl Future<Output = Result<(), DomainError>> + Send;

    // --- Gestion des Étapes ---
    fn add_step(
        &self,
        flow_id: FlowId,
        title: String,
    ) -> impl Future<Output = Result<Step, DomainError>> + Send;
    fn remove_step(&self, step_id: StepId) -> impl Future<Output = Result<(), DomainError>> + Send;
    fn reorder_step(
        &self,
        step_id: StepId,
        new_order: u32,
    ) -> impl Future<Output = Result<Flow, DomainError>> + Send;

    // --- Gestion des Champs (Field Builder) ---
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
        label: String,
        config: FieldConfig,
    ) -> impl Future<Output = Result<Field, DomainError>> + Send;
    fn remove_field(
        &self,
        field_id: FieldId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send;

    // Déplacer un champ d'une étape à une autre ou changer son ordre
    fn move_field(
        &self,
        field_id: FieldId,
        target_step_id: StepId,
        new_order: u32,
    ) -> impl Future<Output = Result<Flow, DomainError>> + Send;
}
