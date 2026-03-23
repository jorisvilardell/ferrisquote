use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use ferrisquote_domain::{FieldId, StepId, domain::flows::ports::{FieldService, FlowService, StepService}};
use validator::Validate;

use crate::{
    dto::{
        ApiResponse, CreateFieldRequest, FieldResponse, FlowResponse, MessageResponse,
        MoveFieldRequest, UpdateFieldConfigRequest,
    },
    error::ApiResult,
    state::AppState,
};

use super::mappers::{map_field_config_from_dto, map_field_to_response, map_flow_to_response};

/// Add a field to a step
#[utoipa::path(
    post,
    path = "/api/v1/flows/steps/{step_id}/fields",
    params(("step_id" = String, Path, description = "Step UUID")),
    request_body = CreateFieldRequest,
    responses(
        (status = 201, description = "Field created", body = FieldResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Step not found"),
    ),
    tag = "fields"
)]
pub async fn add_field<S: FlowService + StepService + FieldService>(
    State(state): State<AppState<S>>,
    Path(step_id): Path<String>,
    Json(request): Json<CreateFieldRequest>,
) -> ApiResult<(StatusCode, Json<ApiResponse<FieldResponse>>)> {
    request.validate()?;

    let step_id = StepId::from_uuid(uuid::Uuid::parse_str(&step_id)?);
    let config = map_field_config_from_dto(request.config)?;

    let field = state
        .flow_service
        .add_field(step_id, request.label, request.key, config)
        .await?;

    let response = map_field_to_response(field);

    Ok((StatusCode::CREATED, Json(ApiResponse::success(response))))
}

/// Update field configuration
#[utoipa::path(
    put,
    path = "/api/v1/flows/fields/{field_id}",
    params(("field_id" = String, Path, description = "Field UUID")),
    request_body = UpdateFieldConfigRequest,
    responses(
        (status = 200, description = "Field updated", body = FieldResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Field not found"),
    ),
    tag = "fields"
)]
pub async fn update_field_config<S: FlowService + StepService + FieldService>(
    State(state): State<AppState<S>>,
    Path(field_id): Path<String>,
    Json(request): Json<UpdateFieldConfigRequest>,
) -> ApiResult<Json<ApiResponse<FieldResponse>>> {
    request.validate()?;

    let field_id = FieldId::from_uuid(uuid::Uuid::parse_str(&field_id)?);
    let config = map_field_config_from_dto(request.config)?;

    let field = state
        .flow_service
        .update_field_config(field_id, Some(request.label), Some(config))
        .await?;

    let response = map_field_to_response(field);

    Ok(Json(ApiResponse::success(response)))
}

/// Remove a field from a step
#[utoipa::path(
    delete,
    path = "/api/v1/flows/fields/{field_id}",
    params(("field_id" = String, Path, description = "Field UUID")),
    responses(
        (status = 200, description = "Field removed", body = MessageResponse),
        (status = 404, description = "Field not found"),
    ),
    tag = "fields"
)]
pub async fn remove_field<S: FlowService + StepService + FieldService>(
    State(state): State<AppState<S>>,
    Path(field_id): Path<String>,
) -> ApiResult<(StatusCode, Json<ApiResponse<MessageResponse>>)> {
    let field_id = FieldId::from_uuid(uuid::Uuid::parse_str(&field_id)?);
    state.flow_service.remove_field(field_id).await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(MessageResponse::new(
            "Field removed successfully",
        ))),
    ))
}

/// Move a field to a different step or change its order
#[utoipa::path(
    put,
    path = "/api/v1/flows/fields/{field_id}/move",
    params(("field_id" = String, Path, description = "Field UUID")),
    request_body = MoveFieldRequest,
    responses(
        (status = 200, description = "Field moved, returns updated flow", body = FlowResponse),
        (status = 404, description = "Field not found"),
    ),
    tag = "fields"
)]
pub async fn move_field<S: FlowService + StepService + FieldService>(
    State(state): State<AppState<S>>,
    Path(field_id): Path<String>,
    Json(request): Json<MoveFieldRequest>,
) -> ApiResult<Json<ApiResponse<crate::dto::FlowResponse>>> {
    request.validate()?;

    let field_id = FieldId::from_uuid(uuid::Uuid::parse_str(&field_id)?);
    let target_step_id = request.target_step_id.map(|id| StepId::from_uuid(id));
    let after_id = request.after_id.map(|id| FieldId::from_uuid(id));
    let before_id = request.before_id.map(|id| FieldId::from_uuid(id));

    let flow = state
        .flow_service
        .move_field(field_id, target_step_id, after_id, before_id)
        .await?;

    let response = map_flow_to_response(flow);

    Ok(Json(ApiResponse::success(response)))
}
