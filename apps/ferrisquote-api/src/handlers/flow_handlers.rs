use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use ferrisquote_domain::{FlowId, domain::flows::ports::{FieldService, FlowService, StepService}};
use validator::Validate;

use crate::{
    dto::{
        ApiResponse, CreateFlowRequest, FlowListResponse, FlowResponse, FlowSummaryResponse,
        MessageResponse, UpdateFlowMetadataRequest,
    },
    error::ApiResult,
    state::AppState,
};

use super::mappers::map_flow_to_response;

/// Create a new flow
#[utoipa::path(
    post,
    path = "/api/v1/flows",
    request_body = CreateFlowRequest,
    responses(
        (status = 201, description = "Flow created", body = FlowResponse),
        (status = 400, description = "Validation error"),
    ),
    tag = "flows"
)]
pub async fn create_flow<S: FlowService + StepService + FieldService>(
    State(state): State<AppState<S>>,
    Json(request): Json<CreateFlowRequest>,
) -> ApiResult<(StatusCode, Json<ApiResponse<FlowResponse>>)> {
    request.validate()?;

    let flow = state.flow_service.create_flow(request.name).await?;
    let response = map_flow_to_response(flow);

    Ok((StatusCode::CREATED, Json(ApiResponse::success(response))))
}

/// Get a flow by ID
#[utoipa::path(
    get,
    path = "/api/v1/flows/{flow_id}",
    params(("flow_id" = String, Path, description = "Flow UUID")),
    responses(
        (status = 200, description = "Flow found", body = FlowResponse),
        (status = 404, description = "Flow not found"),
    ),
    tag = "flows"
)]
pub async fn get_flow<S: FlowService + StepService + FieldService>(
    State(state): State<AppState<S>>,
    Path(flow_id): Path<String>,
) -> ApiResult<Json<ApiResponse<FlowResponse>>> {
    let flow_id = FlowId::from_uuid(uuid::Uuid::parse_str(&flow_id)?);
    let flow = state.flow_service.get_flow(flow_id).await?;
    let response = map_flow_to_response(flow);

    Ok(Json(ApiResponse::success(response)))
}

/// List all flows
#[utoipa::path(
    get,
    path = "/api/v1/flows",
    responses(
        (status = 200, description = "List of flows", body = FlowListResponse),
    ),
    tag = "flows"
)]
pub async fn list_flows<S: FlowService + StepService + FieldService>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiResponse<FlowListResponse>>> {
    let flows = state.flow_service.list_flows().await?;

    let response = FlowListResponse {
        flows: flows
            .into_iter()
            .map(|flow| FlowSummaryResponse {
                id: flow.id.into_uuid(),
                name: flow.name,
                description: flow.description,
                step_count: flow.steps.len(),
            })
            .collect(),
    };

    Ok(Json(ApiResponse::success(response)))
}

/// Update flow metadata
#[utoipa::path(
    put,
    path = "/api/v1/flows/{flow_id}",
    params(("flow_id" = String, Path, description = "Flow UUID")),
    request_body = UpdateFlowMetadataRequest,
    responses(
        (status = 200, description = "Flow updated", body = FlowResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Flow not found"),
    ),
    tag = "flows"
)]
pub async fn update_flow_metadata<S: FlowService + StepService + FieldService>(
    State(state): State<AppState<S>>,
    Path(flow_id): Path<String>,
    Json(request): Json<UpdateFlowMetadataRequest>,
) -> ApiResult<Json<ApiResponse<FlowResponse>>> {
    request.validate()?;

    let flow_id = FlowId::from_uuid(uuid::Uuid::parse_str(&flow_id)?);
    let flow = state
        .flow_service
        .update_flow_metadata(flow_id, Some(request.name), request.description)
        .await?;

    let response = map_flow_to_response(flow);

    Ok(Json(ApiResponse::success(response)))
}

/// Delete a flow
#[utoipa::path(
    delete,
    path = "/api/v1/flows/{flow_id}",
    params(("flow_id" = String, Path, description = "Flow UUID")),
    responses(
        (status = 200, description = "Flow deleted", body = MessageResponse),
        (status = 404, description = "Flow not found"),
    ),
    tag = "flows"
)]
pub async fn delete_flow<S: FlowService + StepService + FieldService>(
    State(state): State<AppState<S>>,
    Path(flow_id): Path<String>,
) -> ApiResult<(StatusCode, Json<ApiResponse<MessageResponse>>)> {
    let flow_id = FlowId::from_uuid(uuid::Uuid::parse_str(&flow_id)?);
    state.flow_service.delete_flow(flow_id).await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(MessageResponse::new(
            "Flow deleted successfully",
        ))),
    ))
}
