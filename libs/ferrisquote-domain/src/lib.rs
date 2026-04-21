pub mod domain;
pub mod infrastructure;

// Re-export commonly used types
pub use domain::error::DomainError;
pub use domain::estimator::entities::{
    estimator::Estimator,
    ids::{EstimatorId, EstimatorInputId, EstimatorOutputId},
    output::EstimatorOutput,
    parameter::{EstimatorParameter, EstimatorParameterType},
};
pub use domain::flows::entities::{
    field::{Field, FieldBoolean, FieldConfig, FieldDate, FieldNumber, FieldSelect, FieldText},
    flow::Flow,
    ids::{FieldId, FlowId, StepId},
    step::Step,
};
pub use domain::submission::entities::{FieldValue, StepIteration, Submission, SubmissionId};
pub use domain::user::entities::{User, UserId};
