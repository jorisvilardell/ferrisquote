use serde::{Deserialize, Serialize};

use super::{binding::EstimatorBinding, ids::FlowId, step::Step};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Flow {
    pub id: FlowId,
    pub name: String,
    pub description: String,
    pub steps: Vec<Step>,
    /// DAG of estimator bindings attached to this flow. Evaluated in
    /// declared order during submission processing; later bindings can
    /// reference outputs of earlier ones.
    #[serde(default)]
    pub bindings: Vec<EstimatorBinding>,
}

impl Flow {
    pub fn new(name: String, description: String) -> Self {
        Flow {
            id: FlowId::new(),
            name,
            description,
            steps: Vec::new(),
            bindings: Vec::new(),
        }
    }

    pub fn with_id(id: FlowId, name: String, description: String) -> Self {
        Flow {
            id,
            name,
            description,
            steps: Vec::new(),
            bindings: Vec::new(),
        }
    }

    pub fn with_steps(id: FlowId, name: String, description: String, steps: Vec<Step>) -> Self {
        Flow {
            id,
            name,
            description,
            steps,
            bindings: Vec::new(),
        }
    }

    pub fn with_full(
        id: FlowId,
        name: String,
        description: String,
        steps: Vec<Step>,
        bindings: Vec<EstimatorBinding>,
    ) -> Self {
        Flow {
            id,
            name,
            description,
            steps,
            bindings,
        }
    }

    pub fn add_step(&mut self, step: Step) {
        self.steps.push(step);
    }

    pub fn remove_step(&mut self, step_id: &super::ids::StepId) -> Option<Step> {
        self.steps
            .iter()
            .position(|s| &s.id == step_id)
            .map(|pos| self.steps.remove(pos))
    }

    pub fn get_step(&self, step_id: &super::ids::StepId) -> Option<&Step> {
        self.steps.iter().find(|s| &s.id == step_id)
    }

    pub fn get_step_mut(&mut self, step_id: &super::ids::StepId) -> Option<&mut Step> {
        self.steps.iter_mut().find(|s| &s.id == step_id)
    }

    pub fn reorder_steps(&mut self) {
        self.steps.sort_by_key(|a| a.rank.clone());
    }

    pub fn update_metadata(&mut self, name: String, description: String) {
        self.name = name;
        self.description = description;
    }
}
