use serde::{Deserialize, Serialize};

use super::ids::EstimatorOutputId;

/// One output variable of an Estimator's signature — the result of a
/// named formula. Each output has its own expression evaluated against
/// the input parameters and other already-computed outputs.
///
/// The `expression` field may reference:
/// - Input parameters by key (e.g. `@surface`)
/// - Other outputs within the same estimator by key
/// - Numeric literals
///
/// Example: `@surface * @prix_unitaire * 1.2`
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EstimatorOutput {
    pub id: EstimatorOutputId,
    /// Snake_case identifier used to reference this output in other
    /// expressions and in binding output mappings.
    pub key: String,
    /// The mathematical expression that computes this output.
    pub expression: String,
    pub description: String,
}

impl EstimatorOutput {
    pub fn new(key: String, expression: String, description: String) -> Self {
        Self {
            id: EstimatorOutputId::new(),
            key,
            expression,
            description,
        }
    }

    pub fn with_id(
        id: EstimatorOutputId,
        key: String,
        expression: String,
        description: String,
    ) -> Self {
        Self {
            id,
            key,
            expression,
            description,
        }
    }
}
