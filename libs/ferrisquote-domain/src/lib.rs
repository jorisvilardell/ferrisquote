pub mod domain;
pub mod infrastructure;

// Re-export commonly used types
pub use domain::error::DomainError;
pub use domain::flows::entities::{
    field::{Field, FieldBoolean, FieldConfig, FieldDate, FieldNumber, FieldSelect, FieldText},
    flow::Flow,
    ids::{FieldId, FlowId, StepId},
    step::Step,
};
