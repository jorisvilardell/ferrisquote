use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use ferrisquote_domain::{FieldId, StepId, domain::flows::ports::FlowService};
use validator::Validate;

use crate::{
    dto::{
        ApiResponse, CreateFieldRequest, FieldResponse, MessageResponse, MoveFieldRequest,
        UpdateFieldConfigRequest,
    },
    error::ApiResult,
    state::AppState,
};

use super::mappers::{map_field_config_from_dto, map_field_to_response, map_flow_to_response};

/// Add a field to a step
pub async fn add_field<S: FlowService>(
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
pub async fn update_field_config<S: FlowService>(
    State(state): State<AppState<S>>,
    Path(field_id): Path<String>,
    Json(request): Json<UpdateFieldConfigRequest>,
) -> ApiResult<Json<ApiResponse<FieldResponse>>> {
    request.validate()?;

    let field_id = FieldId::from_uuid(uuid::Uuid::parse_str(&field_id)?);
    let config = map_field_config_from_dto(request.config)?;

    let field = state
        .flow_service
        .update_field_config(field_id, request.label, config)
        .await?;

    let response = map_field_to_response(field);

    Ok(Json(ApiResponse::success(response)))
}

/// Remove a field from a step
pub async fn remove_field<S: FlowService>(
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
pub async fn move_field<S: FlowService>(
    State(state): State<AppState<S>>,
    Path(field_id): Path<String>,
    Json(request): Json<MoveFieldRequest>,
) -> ApiResult<Json<ApiResponse<crate::dto::FlowResponse>>> {
    request.validate()?;

    let field_id = FieldId::from_uuid(uuid::Uuid::parse_str(&field_id)?);
    let target_step_id = StepId::from_uuid(request.target_step_id);

    let flow = state
        .flow_service
        .move_field(field_id, target_step_id, request.new_order)
        .await?;

    let response = map_flow_to_response(flow);

    Ok(Json(ApiResponse::success(response)))
}
