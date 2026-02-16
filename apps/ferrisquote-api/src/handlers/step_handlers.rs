use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use ferrisquote_domain::{
    domain::flows::ports::FlowService, FlowId, StepId,
};
use validator::Validate;

use crate::{
    dto::{ApiResponse, CreateStepRequest, MessageResponse, ReorderStepRequest, StepResponse},
    error::ApiResult,
    state::AppState,
};

use super::mappers::{map_flow_to_response, map_step_to_response};

/// Add a step to a flow
pub async fn add_step<S: FlowService>(
    State(state): State<AppState<S>>,
    Path(flow_id): Path<String>,
    Json(request): Json<CreateStepRequest>,
) -> ApiResult<(StatusCode, Json<ApiResponse<StepResponse>>)> {
    request.validate()?;

    let flow_id = FlowId::from_uuid(uuid::Uuid::parse_str(&flow_id)?);
    let step = state.flow_service.add_step(flow_id, request.title).await?;
    let response = map_step_to_response(step);

    Ok((StatusCode::CREATED, Json(ApiResponse::success(response))))
}

/// Remove a step from a flow
pub async fn remove_step<S: FlowService>(
    State(state): State<AppState<S>>,
    Path(step_id): Path<String>,
) -> ApiResult<(StatusCode, Json<ApiResponse<MessageResponse>>)> {
    let step_id = StepId::from_uuid(uuid::Uuid::parse_str(&step_id)?);
    state.flow_service.remove_step(step_id).await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(MessageResponse::new(
            "Step removed successfully",
        ))),
    ))
}

/// Reorder a step within a flow
pub async fn reorder_step<S: FlowService>(
    State(state): State<AppState<S>>,
    Path(step_id): Path<String>,
    Json(request): Json<ReorderStepRequest>,
) -> ApiResult<Json<ApiResponse<crate::dto::FlowResponse>>> {
    request.validate()?;

    let step_id = StepId::from_uuid(uuid::Uuid::parse_str(&step_id)?);
    let flow = state
        .flow_service
        .reorder_step(step_id, request.new_order)
        .await?;

    let response = map_flow_to_response(flow);

    Ok(Json(ApiResponse::success(response)))
}
