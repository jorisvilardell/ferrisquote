use std::future::Future;

use crate::domain::error::DomainError;

use super::{
    entities::{
        field::{Field, FieldConfig},
        flow::Flow,
        ids::{FieldId, FlowId, StepId},
        step::Step,
    },
    ports::{FlowRepository, FlowService},
};

/// Implementation of FlowService that orchestrates domain logic
/// and delegates persistence to a FlowRepository.
pub struct FlowServiceImpl<R: FlowRepository> {
    repository: R,
}

impl<R: FlowRepository> FlowServiceImpl<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }
}

impl<R: FlowRepository> FlowService for FlowServiceImpl<R> {
    // --- Gestion du Flow ---

    fn create_flow(&self, name: String) -> impl Future<Output = Result<Flow, DomainError>> + Send {
        async move {
            let flow = Flow::new(name, String::new());
            self.repository.create_flow(flow).await
        }
    }

    fn get_flow(&self, id: FlowId) -> impl Future<Output = Result<Flow, DomainError>> + Send {
        async move { self.repository.get_flow(id).await }
    }

    fn list_flows(&self) -> impl Future<Output = Result<Vec<Flow>, DomainError>> + Send {
        async move { self.repository.list_flows().await }
    }

    fn update_flow_metadata(
        &self,
        id: FlowId,
        name: String,
        description: Option<String>,
    ) -> impl Future<Output = Result<Flow, DomainError>> + Send {
        async move {
            let mut flow = self.repository.get_flow(id).await?;
            flow.name = name;
            flow.description = description.unwrap_or_default();
            self.repository.update_flow(flow).await
        }
    }

    fn delete_flow(&self, id: FlowId) -> impl Future<Output = Result<(), DomainError>> + Send {
        async move { self.repository.delete_flow(id).await }
    }

    // --- Gestion des Étapes ---

    fn add_step(
        &self,
        flow_id: FlowId,
        title: String,
    ) -> impl Future<Output = Result<Step, DomainError>> + Send {
        async move {
            let flow = self.repository.get_flow(flow_id).await?;
            let next_order = flow.steps.len() as u32;
            let step = Step::new(title, String::new(), next_order);
            self.repository.create_step(flow_id, step).await
        }
    }

    fn remove_step(&self, step_id: StepId) -> impl Future<Output = Result<(), DomainError>> + Send {
        async move { self.repository.delete_step(step_id).await }
    }

    fn reorder_step(
        &self,
        _step_id: StepId,
        _new_order: u32,
    ) -> impl Future<Output = Result<Flow, DomainError>> + Send {
        async move {
            // Get the flow containing this step
            // Note: This requires knowing the flow_id. In a real implementation,
            // you might need to add a method to get step by ID first, or store flow_id reference.
            // For now, this is a simplified version - we'll need to enhance the repository
            // to support getting a step's flow_id or getting step directly.

            // TODO: Implement proper reordering logic
            // This would involve:
            // 1. Get the step and its flow
            // 2. Validate new_order is valid
            // 3. Reorder steps in the flow
            // 4. Update all affected steps

            Err(DomainError::internal("reorder_step not yet implemented"))
        }
    }

    // --- Gestion des Champs (Field Builder) ---

    fn add_field(
        &self,
        step_id: StepId,
        label: String,
        key: String,
        config: FieldConfig,
    ) -> impl Future<Output = Result<Field, DomainError>> + Send {
        async move {
            // We need to determine the order for this new field
            // This requires getting the step to count existing fields
            // For now, we'll create the field with order 0 and let the repository handle it
            let field = Field::new(key, label, String::new(), 0, config);
            self.repository.create_field(step_id, field).await
        }
    }

    fn update_field_config(
        &self,
        _field_id: FieldId,
        _label: String,
        _config: FieldConfig,
    ) -> impl Future<Output = Result<Field, DomainError>> + Send {
        async move {
            // TODO: Get the field first, then update it
            // This requires a get_field method in the repository
            Err(DomainError::internal(
                "update_field_config not yet implemented",
            ))
        }
    }

    fn remove_field(
        &self,
        field_id: FieldId,
    ) -> impl Future<Output = Result<(), DomainError>> + Send {
        async move { self.repository.delete_field(field_id).await }
    }

    fn move_field(
        &self,
        _field_id: FieldId,
        _target_step_id: StepId,
        _new_order: u32,
    ) -> impl Future<Output = Result<Flow, DomainError>> + Send {
        async move {
            // TODO: Implement field movement logic
            // This would involve:
            // 1. Get the field
            // 2. Update its step_id and order
            // 3. Reorder other fields in source and target steps
            // 4. Update the field
            // 5. Return the updated flow

            Err(DomainError::internal("move_field not yet implemented"))
        }
    }
}
