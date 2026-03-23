use utoipa::OpenApi;

use crate::dto::{
    ApiResponse, CreateFieldRequest, CreateFlowRequest, CreateStepRequest, FieldConfigDto,
    FieldResponse, FlowListResponse, FlowResponse, FlowSummaryResponse, MessageResponse,
    MoveFieldRequest, ReorderStepRequest, StepResponse, UpdateFieldConfigRequest,
    UpdateFlowMetadataRequest,
};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "FerrisQuote API",
        version = "0.1.0",
        description = "API for managing quote flows, steps and fields"
    ),
    paths(
        crate::handlers::flow_handlers::create_flow,
        crate::handlers::flow_handlers::list_flows,
        crate::handlers::flow_handlers::get_flow,
        crate::handlers::flow_handlers::update_flow_metadata,
        crate::handlers::flow_handlers::delete_flow,
        crate::handlers::step_handlers::add_step,
        crate::handlers::step_handlers::remove_step,
        crate::handlers::step_handlers::reorder_step,
        crate::handlers::field_handlers::add_field,
        crate::handlers::field_handlers::update_field_config,
        crate::handlers::field_handlers::remove_field,
        crate::handlers::field_handlers::move_field,
    ),
    components(schemas(
        CreateFlowRequest,
        UpdateFlowMetadataRequest,
        FlowResponse,
        FlowListResponse,
        FlowSummaryResponse,
        CreateStepRequest,
        ReorderStepRequest,
        StepResponse,
        CreateFieldRequest,
        UpdateFieldConfigRequest,
        MoveFieldRequest,
        FieldResponse,
        FieldConfigDto,
        MessageResponse,
        ApiResponse<FlowResponse>,
        ApiResponse<FlowListResponse>,
        ApiResponse<StepResponse>,
        ApiResponse<FieldResponse>,
        ApiResponse<MessageResponse>,
    )),
    tags(
        (name = "flows", description = "Flow management"),
        (name = "steps", description = "Step management"),
        (name = "fields", description = "Field management"),
    )
)]
pub struct ApiDoc;
