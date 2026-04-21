use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use ferrisquote_domain::domain::{
    estimator::{
        entities::{ids::{EstimatorId, EstimatorVariableId}, submission::SubmissionData},
        ports::EstimatorService,
    },
    flows::ports::{FieldService, FlowService, StepService},
};
use ferrisquote_domain::FlowId;
use validator::Validate;

use crate::{
    dto::{
        ApiResponse, CreateEstimatorRequest, CreateVariableRequest, EstimatorListResponse,
        EstimatorResponse, EvaluateFlowResponse, EvaluateRequest, EvaluateResponse,
        EvaluateSubmissionRequest, MessageResponse, UpdateEstimatorRequest,
        UpdateVariableRequest, VariableResponse,
    },
    error::ApiResult,
    state::AppState,
};

fn map_estimator(e: ferrisquote_domain::Estimator) -> EstimatorResponse {
    EstimatorResponse {
        id: e.id.into_uuid(),
        flow_id: e.flow_id.into_uuid(),
        name: e.name,
        description: e.description,
        variables: e.variables.into_iter().map(map_variable).collect(),
    }
}

fn map_variable(v: ferrisquote_domain::EstimatorVariable) -> VariableResponse {
    VariableResponse {
        id: v.id.into_uuid(),
        name: v.name,
        expression: v.expression,
        description: v.description,
    }
}

// ============================================================================
// Estimator CRUD
// ============================================================================

#[utoipa::path(
    post,
    path = "/api/v1/flows/{flow_id}/estimators",
    params(("flow_id" = String, Path, description = "Flow UUID")),
    request_body = CreateEstimatorRequest,
    responses(
        (status = 201, description = "Estimator created", body = EstimatorResponse),
        (status = 400, description = "Validation error"),
    ),
    tag = "estimators"
)]
pub async fn create_estimator<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: ferrisquote_domain::domain::submission::ports::SubmissionService>(
    State(state): State<AppState<FS, ES, SS>>,
    Path(flow_id): Path<String>,
    Json(request): Json<CreateEstimatorRequest>,
) -> ApiResult<(StatusCode, Json<ApiResponse<EstimatorResponse>>)> {
    request.validate()?;

    let flow_id = FlowId::from_uuid(uuid::Uuid::parse_str(&flow_id)?);
    let estimator = state
        .estimator_service
        .create_estimator(flow_id, request.name)
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::success(map_estimator(estimator))),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/flows/{flow_id}/estimators",
    params(("flow_id" = String, Path, description = "Flow UUID")),
    responses(
        (status = 200, description = "List of estimators", body = EstimatorListResponse),
    ),
    tag = "estimators"
)]
pub async fn list_estimators<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: ferrisquote_domain::domain::submission::ports::SubmissionService>(
    State(state): State<AppState<FS, ES, SS>>,
    Path(flow_id): Path<String>,
) -> ApiResult<Json<ApiResponse<EstimatorListResponse>>> {
    let flow_id = FlowId::from_uuid(uuid::Uuid::parse_str(&flow_id)?);
    let estimators = state
        .estimator_service
        .list_estimators_for_flow(flow_id)
        .await?;

    let response = EstimatorListResponse {
        estimators: estimators.into_iter().map(map_estimator).collect(),
    };

    Ok(Json(ApiResponse::success(response)))
}

#[utoipa::path(
    get,
    path = "/api/v1/estimators/{estimator_id}",
    params(("estimator_id" = String, Path, description = "Estimator UUID")),
    responses(
        (status = 200, description = "Estimator found", body = EstimatorResponse),
        (status = 404, description = "Estimator not found"),
    ),
    tag = "estimators"
)]
pub async fn get_estimator<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: ferrisquote_domain::domain::submission::ports::SubmissionService>(
    State(state): State<AppState<FS, ES, SS>>,
    Path(estimator_id): Path<String>,
) -> ApiResult<Json<ApiResponse<EstimatorResponse>>> {
    let id = EstimatorId::from_uuid(uuid::Uuid::parse_str(&estimator_id)?);
    let estimator = state.estimator_service.get_estimator(id).await?;

    Ok(Json(ApiResponse::success(map_estimator(estimator))))
}

#[utoipa::path(
    put,
    path = "/api/v1/estimators/{estimator_id}",
    params(("estimator_id" = String, Path, description = "Estimator UUID")),
    request_body = UpdateEstimatorRequest,
    responses(
        (status = 200, description = "Estimator updated", body = EstimatorResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Estimator not found"),
    ),
    tag = "estimators"
)]
pub async fn update_estimator<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: ferrisquote_domain::domain::submission::ports::SubmissionService>(
    State(state): State<AppState<FS, ES, SS>>,
    Path(estimator_id): Path<String>,
    Json(request): Json<UpdateEstimatorRequest>,
) -> ApiResult<Json<ApiResponse<EstimatorResponse>>> {
    request.validate()?;

    let id = EstimatorId::from_uuid(uuid::Uuid::parse_str(&estimator_id)?);
    let estimator = state
        .estimator_service
        .update_estimator(id, request.name, request.description)
        .await?;

    Ok(Json(ApiResponse::success(map_estimator(estimator))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/estimators/{estimator_id}",
    params(("estimator_id" = String, Path, description = "Estimator UUID")),
    responses(
        (status = 200, description = "Estimator deleted", body = MessageResponse),
        (status = 404, description = "Estimator not found"),
    ),
    tag = "estimators"
)]
pub async fn delete_estimator<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: ferrisquote_domain::domain::submission::ports::SubmissionService>(
    State(state): State<AppState<FS, ES, SS>>,
    Path(estimator_id): Path<String>,
) -> ApiResult<(StatusCode, Json<ApiResponse<MessageResponse>>)> {
    let id = EstimatorId::from_uuid(uuid::Uuid::parse_str(&estimator_id)?);
    state.estimator_service.delete_estimator(id).await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(MessageResponse::new(
            "Estimator deleted successfully",
        ))),
    ))
}

// ============================================================================
// Variable CRUD
// ============================================================================

#[utoipa::path(
    post,
    path = "/api/v1/estimators/{estimator_id}/variables",
    params(("estimator_id" = String, Path, description = "Estimator UUID")),
    request_body = CreateVariableRequest,
    responses(
        (status = 201, description = "Variable created", body = VariableResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Estimator not found"),
    ),
    tag = "estimator_variables"
)]
pub async fn add_variable<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: ferrisquote_domain::domain::submission::ports::SubmissionService>(
    State(state): State<AppState<FS, ES, SS>>,
    Path(estimator_id): Path<String>,
    Json(request): Json<CreateVariableRequest>,
) -> ApiResult<(StatusCode, Json<ApiResponse<VariableResponse>>)> {
    request.validate()?;

    let id = EstimatorId::from_uuid(uuid::Uuid::parse_str(&estimator_id)?);
    let variable = state
        .estimator_service
        .add_variable(
            id,
            request.name,
            request.expression,
            request.description.unwrap_or_default(),
        )
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::success(map_variable(variable))),
    ))
}

#[utoipa::path(
    put,
    path = "/api/v1/variables/{variable_id}",
    params(("variable_id" = String, Path, description = "Variable UUID")),
    request_body = UpdateVariableRequest,
    responses(
        (status = 200, description = "Variable updated", body = VariableResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Variable not found"),
    ),
    tag = "estimator_variables"
)]
pub async fn update_variable<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: ferrisquote_domain::domain::submission::ports::SubmissionService>(
    State(state): State<AppState<FS, ES, SS>>,
    Path(variable_id): Path<String>,
    Json(request): Json<UpdateVariableRequest>,
) -> ApiResult<Json<ApiResponse<VariableResponse>>> {
    request.validate()?;

    let id = EstimatorVariableId::from_uuid(uuid::Uuid::parse_str(&variable_id)?);
    let variable = state
        .estimator_service
        .update_variable(id, request.name, request.expression, request.description)
        .await?;

    Ok(Json(ApiResponse::success(map_variable(variable))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/variables/{variable_id}",
    params(("variable_id" = String, Path, description = "Variable UUID")),
    responses(
        (status = 200, description = "Variable deleted", body = MessageResponse),
        (status = 404, description = "Variable not found"),
    ),
    tag = "estimator_variables"
)]
pub async fn remove_variable<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: ferrisquote_domain::domain::submission::ports::SubmissionService>(
    State(state): State<AppState<FS, ES, SS>>,
    Path(variable_id): Path<String>,
) -> ApiResult<(StatusCode, Json<ApiResponse<MessageResponse>>)> {
    let id = EstimatorVariableId::from_uuid(uuid::Uuid::parse_str(&variable_id)?);
    state.estimator_service.remove_variable(id).await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(MessageResponse::new(
            "Variable deleted successfully",
        ))),
    ))
}

// ============================================================================
// Evaluation
// ============================================================================

#[utoipa::path(
    post,
    path = "/api/v1/estimators/{estimator_id}/evaluate",
    params(("estimator_id" = String, Path, description = "Estimator UUID")),
    request_body = EvaluateRequest,
    responses(
        (status = 200, description = "Evaluation result", body = EvaluateResponse),
        (status = 400, description = "Evaluation error"),
        (status = 404, description = "Estimator not found"),
    ),
    tag = "estimators"
)]
pub async fn evaluate<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: ferrisquote_domain::domain::submission::ports::SubmissionService>(
    State(state): State<AppState<FS, ES, SS>>,
    Path(estimator_id): Path<String>,
    Json(request): Json<EvaluateRequest>,
) -> ApiResult<Json<ApiResponse<EvaluateResponse>>> {
    let id = EstimatorId::from_uuid(uuid::Uuid::parse_str(&estimator_id)?);
    let results = state
        .estimator_service
        .evaluate(id, request.field_values)
        .await?;

    Ok(Json(ApiResponse::success(EvaluateResponse { results })))
}

#[utoipa::path(
    post,
    path = "/api/v1/estimators/{estimator_id}/evaluate-submission",
    params(("estimator_id" = String, Path, description = "Estimator UUID")),
    request_body = EvaluateSubmissionRequest,
    responses(
        (status = 200, description = "Evaluation result", body = EvaluateResponse),
        (status = 400, description = "Evaluation error"),
        (status = 404, description = "Estimator not found"),
    ),
    tag = "estimators"
)]
pub async fn evaluate_submission<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: ferrisquote_domain::domain::submission::ports::SubmissionService>(
    State(state): State<AppState<FS, ES, SS>>,
    Path(estimator_id): Path<String>,
    Json(request): Json<EvaluateSubmissionRequest>,
) -> ApiResult<Json<ApiResponse<EvaluateResponse>>> {
    let id = EstimatorId::from_uuid(uuid::Uuid::parse_str(&estimator_id)?);
    let data = SubmissionData {
        field_values: request.field_values,
        iteration_values: request.iteration_values,
        iteration_counts: request.iteration_counts,
        cross_values: request.cross_values,
    };
    let results = state
        .estimator_service
        .evaluate_submission(id, data)
        .await?;

    Ok(Json(ApiResponse::success(EvaluateResponse { results })))
}

#[utoipa::path(
    post,
    path = "/api/v1/flows/{flow_id}/evaluate-all",
    params(("flow_id" = String, Path, description = "Flow UUID")),
    request_body = EvaluateSubmissionRequest,
    responses(
        (status = 200, description = "Flow-wide evaluation result", body = EvaluateFlowResponse),
        (status = 400, description = "Evaluation error (cycle, missing ref, etc.)"),
        (status = 404, description = "Flow not found"),
    ),
    tag = "estimators"
)]
pub async fn evaluate_flow<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: ferrisquote_domain::domain::submission::ports::SubmissionService>(
    State(state): State<AppState<FS, ES, SS>>,
    Path(flow_id): Path<String>,
    Json(request): Json<EvaluateSubmissionRequest>,
) -> ApiResult<Json<ApiResponse<EvaluateFlowResponse>>> {
    let flow_id = FlowId::from_uuid(uuid::Uuid::parse_str(&flow_id)?);
    let data = SubmissionData {
        field_values: request.field_values,
        iteration_values: request.iteration_values,
        iteration_counts: request.iteration_counts,
        cross_values: request.cross_values,
    };

    let nested = state.estimator_service.evaluate_flow(flow_id, data).await?;

    // Flatten to "EstName.varName" → value for convenience
    let mut flat = std::collections::HashMap::new();
    for (est_name, vars) in &nested {
        for (var_name, value) in vars {
            flat.insert(format!("{est_name}.{var_name}"), *value);
        }
    }

    Ok(Json(ApiResponse::success(EvaluateFlowResponse {
        results: nested,
        flat_results: flat,
    })))
}
