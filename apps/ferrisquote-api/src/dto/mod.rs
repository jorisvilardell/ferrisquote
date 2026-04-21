pub mod bindings;
pub mod estimators;
pub mod evaluation;
pub mod flows;
pub mod submissions;

// Re-export commonly used DTOs
pub use estimators::{
    CreateEstimatorRequest, CreateInputRequest, CreateOutputRequest, EstimatorListResponse,
    EstimatorParameterTypeDto, EstimatorResponse, EvaluateFlowResponse, EvaluateRequest,
    EvaluateResponse, EvaluateSubmissionRequest, InputResponse, OutputResponse,
    UpdateEstimatorRequest, UpdateInputRequest, UpdateOutputRequest,
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
pub use bindings::{
    AggregationStrategyDto, BindingListResponse, BindingResponse, CreateBindingRequest,
    InputBindingValueDto, UpdateBindingRequest,
};
pub use evaluation::{EvaluateBindingsRequest, FlowEvaluationResponse, FlowPreviewResponse};
