use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use ferrisquote_domain::domain::{
    estimator::{
        entities::{
            id::{EstimatorId, EstimatorInputId, EstimatorOutputId},
            output::EstimatorOutput,
            parameter::{EstimatorParameter, EstimatorParameterType},
            submission::SubmissionData,
        },
        ports::EstimatorService,
    },
    flows::ports::{FieldService, FlowService, StepService},
    submission::ports::SubmissionService,
};
use ferrisquote_domain::FlowId;
use validator::Validate;

use crate::{
    dto::{
        ApiResponse, CreateEstimatorRequest, CreateInputRequest, CreateOutputRequest,
        EstimatorListResponse, EstimatorParameterTypeDto, EstimatorResponse, EvaluateFlowResponse,
        EvaluateRequest, EvaluateResponse, EvaluateSubmissionRequest, InputResponse,
        MessageResponse, OutputResponse, UpdateEstimatorRequest, UpdateInputRequest,
        UpdateOutputRequest,
    },
    error::ApiResult,
    state::AppState,
};

// ============================================================================
// Mappers
// ============================================================================

fn domain_param_type(dto: EstimatorParameterTypeDto) -> EstimatorParameterType {
    match dto {
        EstimatorParameterTypeDto::Number => EstimatorParameterType::Number,
        EstimatorParameterTypeDto::Boolean => EstimatorParameterType::Boolean,
        EstimatorParameterTypeDto::Product { label_filter } => {
            EstimatorParameterType::Product { label_filter }
        }
    }
}

fn dto_param_type(pt: EstimatorParameterType) -> EstimatorParameterTypeDto {
    match pt {
        EstimatorParameterType::Number => EstimatorParameterTypeDto::Number,
        EstimatorParameterType::Boolean => EstimatorParameterTypeDto::Boolean,
        EstimatorParameterType::Product { label_filter } => {
            EstimatorParameterTypeDto::Product { label_filter }
        }
    }
}

fn map_input(i: EstimatorParameter) -> InputResponse {
    InputResponse {
        id: i.id.into_uuid(),
        key: i.key,
        description: i.description,
        parameter_type: dto_param_type(i.parameter_type),
    }
}

fn map_output(o: EstimatorOutput) -> OutputResponse {
    OutputResponse {
        id: o.id.into_uuid(),
        key: o.key,
        expression: o.expression,
        description: o.description,
    }
}

fn map_estimator(e: ferrisquote_domain::Estimator) -> EstimatorResponse {
    EstimatorResponse {
        id: e.id.into_uuid(),
        flow_id: e.flow_id.into_uuid(),
        name: e.name,
        description: e.description,
        inputs: e.inputs.into_iter().map(map_input).collect(),
        outputs: e.outputs.into_iter().map(map_output).collect(),
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
pub async fn create_estimator<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService>(
    State(state): State<AppState<FS, ES, SS, BS>>,
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
pub async fn list_estimators<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService>(
    State(state): State<AppState<FS, ES, SS, BS>>,
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
pub async fn get_estimator<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService>(
    State(state): State<AppState<FS, ES, SS, BS>>,
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
pub async fn update_estimator<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService>(
    State(state): State<AppState<FS, ES, SS, BS>>,
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
pub async fn delete_estimator<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService>(
    State(state): State<AppState<FS, ES, SS, BS>>,
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
// Input CRUD
// ============================================================================

#[utoipa::path(
    post,
    path = "/api/v1/estimators/{estimator_id}/inputs",
    params(("estimator_id" = String, Path, description = "Estimator UUID")),
    request_body = CreateInputRequest,
    responses(
        (status = 201, description = "Input created", body = InputResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Estimator not found"),
    ),
    tag = "estimator_signature"
)]
pub async fn add_input<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService>(
    State(state): State<AppState<FS, ES, SS, BS>>,
    Path(estimator_id): Path<String>,
    Json(request): Json<CreateInputRequest>,
) -> ApiResult<(StatusCode, Json<ApiResponse<InputResponse>>)> {
    request.validate()?;

    let id = EstimatorId::from_uuid(uuid::Uuid::parse_str(&estimator_id)?);
    let input = state
        .estimator_service
        .add_input(
            id,
            request.key,
            request.description.unwrap_or_default(),
            domain_param_type(request.parameter_type),
        )
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::success(map_input(input))),
    ))
}

#[utoipa::path(
    put,
    path = "/api/v1/estimators/{estimator_id}/inputs/{input_id}",
    params(
        ("estimator_id" = String, Path, description = "Estimator UUID"),
        ("input_id" = String, Path, description = "Input UUID"),
    ),
    request_body = UpdateInputRequest,
    responses(
        (status = 200, description = "Input updated", body = InputResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Input not found"),
    ),
    tag = "estimator_signature"
)]
pub async fn update_input<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService>(
    State(state): State<AppState<FS, ES, SS, BS>>,
    Path((estimator_id, input_id)): Path<(String, String)>,
    Json(request): Json<UpdateInputRequest>,
) -> ApiResult<Json<ApiResponse<InputResponse>>> {
    request.validate()?;

    let eid = EstimatorId::from_uuid(uuid::Uuid::parse_str(&estimator_id)?);
    let iid = EstimatorInputId::from_uuid(uuid::Uuid::parse_str(&input_id)?);
    let input = state
        .estimator_service
        .update_input(
            eid,
            iid,
            request.key,
            request.description,
            request.parameter_type.map(domain_param_type),
        )
        .await?;

    Ok(Json(ApiResponse::success(map_input(input))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/estimators/{estimator_id}/inputs/{input_id}",
    params(
        ("estimator_id" = String, Path, description = "Estimator UUID"),
        ("input_id" = String, Path, description = "Input UUID"),
    ),
    responses(
        (status = 200, description = "Input deleted", body = MessageResponse),
        (status = 404, description = "Input not found"),
    ),
    tag = "estimator_signature"
)]
pub async fn remove_input<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService>(
    State(state): State<AppState<FS, ES, SS, BS>>,
    Path((estimator_id, input_id)): Path<(String, String)>,
) -> ApiResult<(StatusCode, Json<ApiResponse<MessageResponse>>)> {
    let eid = EstimatorId::from_uuid(uuid::Uuid::parse_str(&estimator_id)?);
    let iid = EstimatorInputId::from_uuid(uuid::Uuid::parse_str(&input_id)?);
    state.estimator_service.remove_input(eid, iid).await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(MessageResponse::new(
            "Input deleted successfully",
        ))),
    ))
}

// ============================================================================
// Output CRUD
// ============================================================================

#[utoipa::path(
    post,
    path = "/api/v1/estimators/{estimator_id}/outputs",
    params(("estimator_id" = String, Path, description = "Estimator UUID")),
    request_body = CreateOutputRequest,
    responses(
        (status = 201, description = "Output created", body = OutputResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Estimator not found"),
    ),
    tag = "estimator_signature"
)]
pub async fn add_output<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService>(
    State(state): State<AppState<FS, ES, SS, BS>>,
    Path(estimator_id): Path<String>,
    Json(request): Json<CreateOutputRequest>,
) -> ApiResult<(StatusCode, Json<ApiResponse<OutputResponse>>)> {
    request.validate()?;

    let id = EstimatorId::from_uuid(uuid::Uuid::parse_str(&estimator_id)?);
    let output = state
        .estimator_service
        .add_output(
            id,
            request.key,
            request.expression,
            request.description.unwrap_or_default(),
        )
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::success(map_output(output))),
    ))
}

#[utoipa::path(
    put,
    path = "/api/v1/estimators/{estimator_id}/outputs/{output_id}",
    params(
        ("estimator_id" = String, Path, description = "Estimator UUID"),
        ("output_id" = String, Path, description = "Output UUID"),
    ),
    request_body = UpdateOutputRequest,
    responses(
        (status = 200, description = "Output updated", body = OutputResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Output not found"),
    ),
    tag = "estimator_signature"
)]
pub async fn update_output<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService>(
    State(state): State<AppState<FS, ES, SS, BS>>,
    Path((estimator_id, output_id)): Path<(String, String)>,
    Json(request): Json<UpdateOutputRequest>,
) -> ApiResult<Json<ApiResponse<OutputResponse>>> {
    request.validate()?;

    let eid = EstimatorId::from_uuid(uuid::Uuid::parse_str(&estimator_id)?);
    let oid = EstimatorOutputId::from_uuid(uuid::Uuid::parse_str(&output_id)?);
    let output = state
        .estimator_service
        .update_output(eid, oid, request.key, request.expression, request.description)
        .await?;

    Ok(Json(ApiResponse::success(map_output(output))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/estimators/{estimator_id}/outputs/{output_id}",
    params(
        ("estimator_id" = String, Path, description = "Estimator UUID"),
        ("output_id" = String, Path, description = "Output UUID"),
    ),
    responses(
        (status = 200, description = "Output deleted", body = MessageResponse),
        (status = 404, description = "Output not found"),
    ),
    tag = "estimator_signature"
)]
pub async fn remove_output<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService>(
    State(state): State<AppState<FS, ES, SS, BS>>,
    Path((estimator_id, output_id)): Path<(String, String)>,
) -> ApiResult<(StatusCode, Json<ApiResponse<MessageResponse>>)> {
    let eid = EstimatorId::from_uuid(uuid::Uuid::parse_str(&estimator_id)?);
    let oid = EstimatorOutputId::from_uuid(uuid::Uuid::parse_str(&output_id)?);
    state.estimator_service.remove_output(eid, oid).await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(MessageResponse::new(
            "Output deleted successfully",
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
pub async fn evaluate<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService>(
    State(state): State<AppState<FS, ES, SS, BS>>,
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
pub async fn evaluate_submission<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService>(
    State(state): State<AppState<FS, ES, SS, BS>>,
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
        (status = 400, description = "Evaluation error"),
        (status = 404, description = "Flow not found"),
    ),
    tag = "estimators"
)]
pub async fn evaluate_flow<FS: FlowService + StepService + FieldService, ES: EstimatorService, SS: SubmissionService, BS: ferrisquote_domain::domain::flows::ports::BindingService>(
    State(state): State<AppState<FS, ES, SS, BS>>,
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
