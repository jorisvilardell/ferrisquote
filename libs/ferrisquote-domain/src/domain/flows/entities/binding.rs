use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::domain::{
    estimator::entities::id::EstimatorId, submission::entities::FieldValue,
};

use super::id::{BindingId, FieldId, StepId};

/// How to aggregate an output across iterations when a binding is mapped
/// over a repeatable step. One strategy per output key.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AggregationStrategy {
    Sum,
    Average,
    Max,
    Min,
    Count,
    First,
    Last,
}

/// The source of a single input value passed to a bound estimator.
/// Covers the three wiring options the architecture supports:
/// - pull from a Flow field answer
/// - hard-coded constant (handy for defaults / tax rates / multipliers)
/// - read an output of a prior binding in the same flow (chaining)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "source", rename_all = "snake_case")]
pub enum InputBindingValue {
    /// Resolve the value from the answer to a flow field.
    Field { field_id: FieldId },
    /// Literal constant baked into the binding.
    Constant { value: FieldValue },
    /// Read an output produced by an earlier binding in the same flow
    /// (DAG chaining). Resolved by the evaluation engine.
    BindingOutput {
        binding_id: BindingId,
        output_key: String,
    },
}

/// A binding is the "call site" that wires a reusable `Estimator` function
/// into a concrete `Flow`. It supplies values for each estimator input,
/// optionally maps iterations of a repeatable step into isolated executions,
/// and declares how each output is aggregated back to a single value.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EstimatorBinding {
    pub id: BindingId,
    pub estimator_id: EstimatorId,
    /// Map estimator input **key** → value source. String-keyed for JSON
    /// readability; the service layer validates keys against the referenced
    /// estimator's declared input keys.
    pub inputs_mapping: HashMap<String, InputBindingValue>,
    /// When `Some(step)`, the engine runs the estimator once per iteration
    /// of that repeatable step and reduces outputs via
    /// `outputs_reduce_strategy`. When `None`, runs exactly once.
    pub map_over_step: Option<StepId>,
    /// Per-output aggregation strategy, keyed by estimator output key. Only
    /// meaningful when `map_over_step` is set; otherwise ignored.
    pub outputs_reduce_strategy: HashMap<String, AggregationStrategy>,
}

impl EstimatorBinding {
    pub fn new(
        estimator_id: EstimatorId,
        inputs_mapping: HashMap<String, InputBindingValue>,
        map_over_step: Option<StepId>,
        outputs_reduce_strategy: HashMap<String, AggregationStrategy>,
    ) -> Self {
        Self {
            id: BindingId::new(),
            estimator_id,
            inputs_mapping,
            map_over_step,
            outputs_reduce_strategy,
        }
    }

    pub fn with_id(
        id: BindingId,
        estimator_id: EstimatorId,
        inputs_mapping: HashMap<String, InputBindingValue>,
        map_over_step: Option<StepId>,
        outputs_reduce_strategy: HashMap<String, AggregationStrategy>,
    ) -> Self {
        Self {
            id,
            estimator_id,
            inputs_mapping,
            map_over_step,
            outputs_reduce_strategy,
        }
    }
}
