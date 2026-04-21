use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::dto::FieldValueDto;

/// Aggregation strategy applied per output when a binding is mapped over a
/// repeatable step.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AggregationStrategyDto {
    Sum,
    Average,
    Max,
    Min,
    Count,
    First,
    Last,
}

/// Source of a single input value supplied to a bound estimator.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "source", rename_all = "snake_case")]
pub enum InputBindingValueDto {
    Field { field_id: Uuid },
    Constant { value: FieldValueDto },
    BindingOutput { binding_id: Uuid, output_key: String },
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateBindingRequest {
    pub estimator_id: Uuid,
    /// Map estimator input **key** → value source.
    pub inputs_mapping: HashMap<String, InputBindingValueDto>,
    /// Optional UUID of a repeatable step to loop over.
    #[serde(default)]
    pub map_over_step: Option<Uuid>,
    /// Per-output aggregation, keyed by estimator output key.
    #[serde(default)]
    pub outputs_reduce_strategy: HashMap<String, AggregationStrategyDto>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateBindingRequest {
    pub inputs_mapping: Option<HashMap<String, InputBindingValueDto>>,
    /// Double-option encodes "absent / set-null / set-value":
    /// - field absent in JSON → no change
    /// - `null` → clear the step binding
    /// - a UUID string → set to that step
    #[serde(default, with = "option_option_uuid")]
    pub map_over_step: Option<Option<Uuid>>,
    pub outputs_reduce_strategy: Option<HashMap<String, AggregationStrategyDto>>,
}

mod option_option_uuid {
    use serde::{Deserialize, Deserializer, Serialize, Serializer};
    use uuid::Uuid;

    pub fn serialize<S>(v: &Option<Option<Uuid>>, s: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        v.serialize(s)
    }

    pub fn deserialize<'de, D>(d: D) -> Result<Option<Option<Uuid>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        Option::<Option<Uuid>>::deserialize(d)
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct BindingResponse {
    pub id: Uuid,
    pub estimator_id: Uuid,
    pub inputs_mapping: HashMap<String, InputBindingValueDto>,
    pub map_over_step: Option<Uuid>,
    pub outputs_reduce_strategy: HashMap<String, AggregationStrategyDto>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct BindingListResponse {
    pub bindings: Vec<BindingResponse>,
}
