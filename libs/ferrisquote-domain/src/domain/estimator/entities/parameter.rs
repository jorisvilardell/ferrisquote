use serde::{Deserialize, Serialize};

use super::ids::EstimatorInputId;

/// The type of an input parameter. Determines what kind of value the
/// estimator expects to receive when bound.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum EstimatorParameterType {
    Number,
    Boolean,
    /// A product reference — the `label_filter` optionally restricts
    /// which product labels are acceptable (e.g. "prise", "luminaire").
    Product { label_filter: Option<String> },
}

/// One input parameter of an Estimator's signature.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EstimatorParameter {
    pub id: EstimatorInputId,
    /// Snake_case identifier used to reference this input in formulas.
    pub key: String,
    pub description: String,
    #[serde(flatten)]
    pub parameter_type: EstimatorParameterType,
}

impl EstimatorParameter {
    pub fn new(key: String, description: String, parameter_type: EstimatorParameterType) -> Self {
        Self {
            id: EstimatorInputId::new(),
            key,
            description,
            parameter_type,
        }
    }

    pub fn with_id(
        id: EstimatorInputId,
        key: String,
        description: String,
        parameter_type: EstimatorParameterType,
    ) -> Self {
        Self {
            id,
            key,
            description,
            parameter_type,
        }
    }
}
