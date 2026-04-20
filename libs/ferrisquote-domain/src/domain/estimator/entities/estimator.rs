use serde::{Deserialize, Serialize};

use crate::domain::flows::entities::ids::FlowId;

use super::{ids::EstimatorId, variable::EstimatorVariable};

/// An Estimator is a set of calculated variables attached to a Flow.
///
/// Each variable holds an expression that can reference Flow fields (via
/// `@field_key`) or other variables within the same estimator.  The variables
/// are evaluated in dependency order to produce a final result map.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Estimator {
    pub id: EstimatorId,
    pub flow_id: FlowId,
    pub name: String,
    pub description: String,
    pub variables: Vec<EstimatorVariable>,
}

impl Estimator {
    pub fn new(flow_id: FlowId, name: String) -> Self {
        Self {
            id: EstimatorId::new(),
            flow_id,
            name,
            description: String::new(),
            variables: Vec::new(),
        }
    }

    pub fn with_id(id: EstimatorId, flow_id: FlowId, name: String) -> Self {
        Self {
            id,
            flow_id,
            name,
            description: String::new(),
            variables: Vec::new(),
        }
    }

    pub fn with_variables(
        id: EstimatorId,
        flow_id: FlowId,
        name: String,
        variables: Vec<EstimatorVariable>,
    ) -> Self {
        Self {
            id,
            flow_id,
            name,
            description: String::new(),
            variables,
        }
    }

    pub fn with_full(
        id: EstimatorId,
        flow_id: FlowId,
        name: String,
        description: String,
        variables: Vec<EstimatorVariable>,
    ) -> Self {
        Self {
            id,
            flow_id,
            name,
            description,
            variables,
        }
    }

    pub fn add_variable(&mut self, variable: EstimatorVariable) {
        self.variables.push(variable);
    }

    pub fn remove_variable(&mut self, id: &super::ids::EstimatorVariableId) -> Option<EstimatorVariable> {
        self.variables
            .iter()
            .position(|v| &v.id == id)
            .map(|pos| self.variables.remove(pos))
    }

    pub fn get_variable(&self, id: &super::ids::EstimatorVariableId) -> Option<&EstimatorVariable> {
        self.variables.iter().find(|v| &v.id == id)
    }
}
