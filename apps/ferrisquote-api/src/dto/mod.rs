pub mod estimators;
pub mod flows;
pub mod submissions;

// Re-export commonly used DTOs
pub use estimators::{
    CreateEstimatorRequest, CreateVariableRequest, EstimatorListResponse, EstimatorResponse,
    EvaluateFlowResponse, EvaluateRequest, EvaluateResponse, EvaluateSubmissionRequest,
    UpdateEstimatorRequest, UpdateVariableRequest, VariableResponse,
};
pub use flows::{
    ApiResponse, CreateFieldRequest, CreateFlowRequest, CreateStepRequest, FieldConfigDto,
    FieldResponse, FlowListResponse, FlowResponse, FlowSummaryResponse, MessageResponse,
    MoveFieldRequest, ReorderStepRequest, StepResponse, UpdateFieldConfigRequest,
    UpdateFlowMetadataRequest, UpdateStepMetadataRequest,
};
pub use submissions::{
    FieldValueDto, StepIterationDto, SubmissionListResponse, SubmissionResponse,
    SubmitAnswersRequest,
};
