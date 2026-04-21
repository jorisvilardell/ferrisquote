use serde::{Deserialize, Serialize};

use crate::domain::flows::entities::id::FlowId;

use super::{
    id::{EstimatorId, EstimatorInputId, EstimatorOutputId},
    output::EstimatorOutput,
    parameter::EstimatorParameter,
};

/// An Estimator is a reusable pure-function node with a typed signature:
/// a list of input parameters and a list of output variables. Each output
/// carries its own expression, evaluated against the inputs and
/// already-computed outputs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Estimator {
    pub id: EstimatorId,
    pub flow_id: FlowId,
    pub name: String,
    pub description: String,
    pub inputs: Vec<EstimatorParameter>,
    pub outputs: Vec<EstimatorOutput>,
}

impl Estimator {
    pub fn new(flow_id: FlowId, name: String) -> Self {
        Self {
            id: EstimatorId::new(),
            flow_id,
            name,
            description: String::new(),
            inputs: Vec::new(),
            outputs: Vec::new(),
        }
    }

    pub fn with_id(id: EstimatorId, flow_id: FlowId, name: String) -> Self {
        Self {
            id,
            flow_id,
            name,
            description: String::new(),
            inputs: Vec::new(),
            outputs: Vec::new(),
        }
    }

    pub fn with_full(
        id: EstimatorId,
        flow_id: FlowId,
        name: String,
        description: String,
        inputs: Vec<EstimatorParameter>,
        outputs: Vec<EstimatorOutput>,
    ) -> Self {
        Self {
            id,
            flow_id,
            name,
            description,
            inputs,
            outputs,
        }
    }

    pub fn add_input(&mut self, input: EstimatorParameter) {
        self.inputs.push(input);
    }

    pub fn remove_input(&mut self, id: &EstimatorInputId) -> Option<EstimatorParameter> {
        self.inputs
            .iter()
            .position(|v| &v.id == id)
            .map(|pos| self.inputs.remove(pos))
    }

    pub fn get_input(&self, id: &EstimatorInputId) -> Option<&EstimatorParameter> {
        self.inputs.iter().find(|v| &v.id == id)
    }

    pub fn add_output(&mut self, output: EstimatorOutput) {
        self.outputs.push(output);
    }

    pub fn remove_output(&mut self, id: &EstimatorOutputId) -> Option<EstimatorOutput> {
        self.outputs
            .iter()
            .position(|v| &v.id == id)
            .map(|pos| self.outputs.remove(pos))
    }

    pub fn get_output(&self, id: &EstimatorOutputId) -> Option<&EstimatorOutput> {
        self.outputs.iter().find(|v| &v.id == id)
    }
}
