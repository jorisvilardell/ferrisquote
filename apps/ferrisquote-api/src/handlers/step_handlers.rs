use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use ferrisquote_domain::{
    domain::{estimator::ports::EstimatorService, flows::ports::{FieldService, FlowService, StepService}},
    FlowId, StepId,
};
use validator::Validate;

use crate::{
    dto::{ApiResponse, CreateStepRequest, FlowResponse, MessageResponse, ReorderStepRequest, StepResponse, UpdateStepMetadataRequest},
    error::ApiResult,
    state::AppState,
};

use super::mappers::{map_flow_to_response, map_step_to_response};

/// Add a step to a flow
#[utoipa::path(
    post,
    path = "/api/v1/flows/{flow_id}/steps",
    params(("flow_id" = String, Path, description = "Flow UUID")),
    request_body = CreateStepRequest,
    responses(
        (status = 201, description = "Step created", body = StepResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Flow not found"),
    ),
    tag = "steps"
)]
pub async fn add_step<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: ferrisquote_domain::domain::submission::ports::SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService, FES: ferrisquote_domain::domain::evaluation::ports::FlowEvaluationService>(
    State(state): State<AppState<FS, ES, SS, BS, FES>>,
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
#[utoipa::path(
    delete,
    path = "/api/v1/flows/steps/{step_id}",
    params(("step_id" = String, Path, description = "Step UUID")),
    responses(
        (status = 200, description = "Step removed", body = MessageResponse),
        (status = 404, description = "Step not found"),
    ),
    tag = "steps"
)]
pub async fn remove_step<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: ferrisquote_domain::domain::submission::ports::SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService, FES: ferrisquote_domain::domain::evaluation::ports::FlowEvaluationService>(
    State(state): State<AppState<FS, ES, SS, BS, FES>>,
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
#[utoipa::path(
    put,
    path = "/api/v1/flows/steps/{step_id}/reorder",
    params(("step_id" = String, Path, description = "Step UUID")),
    request_body = ReorderStepRequest,
    responses(
        (status = 200, description = "Step reordered, returns updated flow", body = FlowResponse),
        (status = 404, description = "Step not found"),
    ),
    tag = "steps"
)]
pub async fn reorder_step<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: ferrisquote_domain::domain::submission::ports::SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService, FES: ferrisquote_domain::domain::evaluation::ports::FlowEvaluationService>(
    State(state): State<AppState<FS, ES, SS, BS, FES>>,
    Path(step_id): Path<String>,
    Json(request): Json<ReorderStepRequest>,
) -> ApiResult<Json<ApiResponse<crate::dto::FlowResponse>>> {
    request.validate()?;

    let step_id = StepId::from_uuid(uuid::Uuid::parse_str(&step_id)?);
    let after_id = request
        .after_id
        .map(|id| StepId::from_uuid(id));
    let before_id = request
        .before_id
        .map(|id| StepId::from_uuid(id));

    let flow = state
        .flow_service
        .reorder_step(step_id, after_id, before_id)
        .await?;

    let response = map_flow_to_response(flow);

    Ok(Json(ApiResponse::success(response)))
}

/// Update a step's metadata
#[utoipa::path(
    put,
    path = "/api/v1/flows/steps/{step_id}",
    params(("step_id" = String, Path, description = "Step UUID")),
    request_body = UpdateStepMetadataRequest,
    responses(
        (status = 200, description = "Step updated", body = StepResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Step not found"),
    ),
    tag = "steps"
)]
pub async fn update_step_metadata<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: ferrisquote_domain::domain::submission::ports::SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService, FES: ferrisquote_domain::domain::evaluation::ports::FlowEvaluationService>(
    State(state): State<AppState<FS, ES, SS, BS, FES>>,
    Path(step_id): Path<String>,
    Json(request): Json<UpdateStepMetadataRequest>,
) -> ApiResult<Json<ApiResponse<StepResponse>>> {
    request.validate()?;

    let step_id = StepId::from_uuid(uuid::Uuid::parse_str(&step_id)?);
    let step = state
        .flow_service
        .update_step_metadata(
            step_id,
            request.title,
            request.description,
            request.is_repeatable,
            request.repeat_label,
            request.min_repeats,
            request.max_repeats,
        )
        .await?;

    let response = map_step_to_response(step);

    Ok(Json(ApiResponse::success(response)))
}
