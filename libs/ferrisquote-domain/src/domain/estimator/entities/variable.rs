use serde::{Deserialize, Serialize};

use super::ids::EstimatorVariableId;

/// A named calculated variable within an Estimator.
///
/// The `expression` field is a mathematical formula that may reference:
/// - Flow fields via `@field_key` (e.g. `@surface`, `@prix_unitaire`)
/// - Other variables within the same estimator via `@variable_name`
/// - Numeric literals (e.g. `1.2`, `100`)
///
/// Example: `@surface * @prix_unitaire * 1.2`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EstimatorVariable {
    pub id: EstimatorVariableId,
    /// Snake_case identifier used to reference this variable in other expressions.
    pub name: String,
    /// The mathematical expression to evaluate.
    pub expression: String,
    pub description: String,
}

impl EstimatorVariable {
    pub fn new(name: String, expression: String, description: String) -> Self {
        Self {
            id: EstimatorVariableId::new(),
            name,
            expression,
            description,
        }
    }

    pub fn with_id(
        id: EstimatorVariableId,
        name: String,
        expression: String,
        description: String,
    ) -> Self {
        Self {
            id,
            name,
            expression,
            description,
        }
    }
}
