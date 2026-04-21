/// Generate a strongly-typed UUIDv7 newtype ID.
///
/// Produces a `#[derive(...)]` tuple struct `$name(Uuid)` with:
/// - `new()` — fresh UUIDv7
/// - `from_uuid(Uuid) -> Self` / `into_uuid(self) -> Uuid` / `as_uuid(&self) -> &Uuid`
/// - `Default` (via `new`)
/// - `Display` (forwards to inner Uuid)
/// - `FromStr` (parses a Uuid string)
///
/// Use in each domain's `id(s).rs`:
/// ```ignore
/// use crate::uuid_newtype;
/// uuid_newtype!(FlowId);
/// uuid_newtype!(StepId);
/// ```
#[macro_export]
macro_rules! uuid_newtype {
    ($name:ident) => {
        #[derive(
            Debug,
            Clone,
            Copy,
            PartialEq,
            Eq,
            Hash,
            ::serde::Serialize,
            ::serde::Deserialize,
        )]
        pub struct $name(::uuid::Uuid);

        impl $name {
            pub fn new() -> Self {
                Self(::uuid::Uuid::now_v7())
            }

            pub fn from_uuid(uuid: ::uuid::Uuid) -> Self {
                Self(uuid)
            }

            pub fn as_uuid(&self) -> &::uuid::Uuid {
                &self.0
            }

            pub fn into_uuid(self) -> ::uuid::Uuid {
                self.0
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::new()
            }
        }

        impl ::std::fmt::Display for $name {
            fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
                write!(f, "{}", self.0)
            }
        }

        impl ::std::str::FromStr for $name {
            type Err = ::uuid::Error;
            fn from_str(s: &str) -> ::std::result::Result<Self, Self::Err> {
                Ok(Self(::uuid::Uuid::parse_str(s)?))
            }
        }
    };
}

pub mod domain;
pub mod infrastructure;

// Re-export commonly used types
pub use domain::error::DomainError;
pub use domain::estimator::entities::{
    estimator::Estimator,
    id::{EstimatorId, EstimatorInputId, EstimatorOutputId},
    output::EstimatorOutput,
    parameter::{EstimatorParameter, EstimatorParameterType},
};
pub use domain::flows::entities::{
    field::{Field, FieldBoolean, FieldConfig, FieldDate, FieldNumber, FieldSelect, FieldText},
    flow::Flow,
    id::{FieldId, FlowId, StepId},
    step::Step,
};
pub use domain::submission::entities::{FieldValue, StepIteration, Submission, SubmissionId};
pub use domain::user::entities::{User, UserId};
