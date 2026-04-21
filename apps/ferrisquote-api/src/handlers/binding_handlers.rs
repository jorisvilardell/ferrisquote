use std::collections::HashMap;

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use ferrisquote_domain::domain::{
    estimator::{entities::id::EstimatorId, ports::EstimatorService},
    flows::{
        entities::{
            binding::{AggregationStrategy, EstimatorBinding, InputBindingValue},
            id::{BindingId, FieldId, FlowId, StepId},
        },
        ports::{BindingService, FieldService, FlowService, StepService},
    },
    submission::{entities::FieldValue, ports::SubmissionService},
};

use crate::{
    dto::{
        AggregationStrategyDto, ApiResponse, BindingListResponse, BindingResponse,
        CreateBindingRequest, FieldValueDto, InputBindingValueDto, MessageResponse,
        UpdateBindingRequest,
    },
    error::{ApiError, ApiResult},
    state::AppState,
};

// ============================================================================
// Mappers
// ============================================================================

fn dto_field_value_to_domain(v: FieldValueDto) -> FieldValue {
    match v {
        FieldValueDto::Text(s) => FieldValue::Text(s),
        FieldValueDto::Number(n) => FieldValue::Number(n),
        FieldValueDto::Boolean(b) => FieldValue::Boolean(b),
        FieldValueDto::Array(a) => FieldValue::Array(a),
    }
}

fn domain_field_value_to_dto(v: FieldValue) -> FieldValueDto {
    match v {
        FieldValue::Text(s) => FieldValueDto::Text(s),
        FieldValue::Number(n) => FieldValueDto::Number(n),
        FieldValue::Boolean(b) => FieldValueDto::Boolean(b),
        FieldValue::Array(a) => FieldValueDto::Array(a),
    }
}

fn dto_strategy_to_domain(s: AggregationStrategyDto) -> AggregationStrategy {
    match s {
        AggregationStrategyDto::Sum => AggregationStrategy::Sum,
        AggregationStrategyDto::Average => AggregationStrategy::Average,
        AggregationStrategyDto::Max => AggregationStrategy::Max,
        AggregationStrategyDto::Min => AggregationStrategy::Min,
        AggregationStrategyDto::Count => AggregationStrategy::Count,
        AggregationStrategyDto::First => AggregationStrategy::First,
        AggregationStrategyDto::Last => AggregationStrategy::Last,
    }
}

fn domain_strategy_to_dto(s: AggregationStrategy) -> AggregationStrategyDto {
    match s {
        AggregationStrategy::Sum => AggregationStrategyDto::Sum,
        AggregationStrategy::Average => AggregationStrategyDto::Average,
        AggregationStrategy::Max => AggregationStrategyDto::Max,
        AggregationStrategy::Min => AggregationStrategyDto::Min,
        AggregationStrategy::Count => AggregationStrategyDto::Count,
        AggregationStrategy::First => AggregationStrategyDto::First,
        AggregationStrategy::Last => AggregationStrategyDto::Last,
    }
}

fn dto_value_to_domain(v: InputBindingValueDto) -> InputBindingValue {
    match v {
        InputBindingValueDto::Field { field_id } => InputBindingValue::Field {
            field_id: FieldId::from_uuid(field_id),
        },
        InputBindingValueDto::Constant { value } => InputBindingValue::Constant {
            value: dto_field_value_to_domain(value),
        },
        InputBindingValueDto::BindingOutput {
            binding_id,
            output_key,
        } => InputBindingValue::BindingOutput {
            binding_id: BindingId::from_uuid(binding_id),
            output_key,
        },
    }
}

fn domain_value_to_dto(v: InputBindingValue) -> InputBindingValueDto {
    match v {
        InputBindingValue::Field { field_id } => InputBindingValueDto::Field {
            field_id: field_id.into_uuid(),
        },
        InputBindingValue::Constant { value } => InputBindingValueDto::Constant {
            value: domain_field_value_to_dto(value),
        },
        InputBindingValue::BindingOutput {
            binding_id,
            output_key,
        } => InputBindingValueDto::BindingOutput {
            binding_id: binding_id.into_uuid(),
            output_key,
        },
    }
}

fn map_binding(b: EstimatorBinding) -> BindingResponse {
    BindingResponse {
        id: b.id.into_uuid(),
        estimator_id: b.estimator_id.into_uuid(),
        inputs_mapping: b
            .inputs_mapping
            .into_iter()
            .map(|(k, v)| (k, domain_value_to_dto(v)))
            .collect(),
        map_over_step: b.map_over_step.map(|s| s.into_uuid()),
        outputs_reduce_strategy: b
            .outputs_reduce_strategy
            .into_iter()
            .map(|(k, v)| (k, domain_strategy_to_dto(v)))
            .collect(),
    }
}

// ============================================================================
// Handlers
// ============================================================================

#[utoipa::path(
    post,
    path = "/api/v1/flows/{flow_id}/bindings",
    params(("flow_id" = String, Path, description = "Flow UUID")),
    request_body = CreateBindingRequest,
    responses(
        (status = 201, description = "Binding created", body = BindingResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Flow / estimator not found"),
    ),
    tag = "bindings"
)]
pub async fn add_binding<
    FS: FlowService + StepService + FieldService,
    ES: EstimatorService,
    SS: SubmissionService,
    BS: BindingService,
>(
    State(state): State<AppState<FS, ES, SS, BS>>,
    Path(flow_id): Path<String>,
    Json(request): Json<CreateBindingRequest>,
) -> ApiResult<(StatusCode, Json<ApiResponse<BindingResponse>>)> {
    let flow_id = FlowId::from_uuid(uuid::Uuid::parse_str(&flow_id)?);
    let estimator_id = EstimatorId::from_uuid(request.estimator_id);

    let inputs: HashMap<String, InputBindingValue> = request
        .inputs_mapping
        .into_iter()
        .map(|(k, v)| (k, dto_value_to_domain(v)))
        .collect();
    let map_over = request.map_over_step.map(StepId::from_uuid);
    let reduce: HashMap<String, AggregationStrategy> = request
        .outputs_reduce_strategy
        .into_iter()
        .map(|(k, v)| (k, dto_strategy_to_domain(v)))
        .collect();

    let binding = state
        .binding_service
        .add_binding(flow_id, estimator_id, inputs, map_over, reduce)
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::success(map_binding(binding))),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/flows/{flow_id}/bindings",
    params(("flow_id" = String, Path, description = "Flow UUID")),
    responses(
        (status = 200, description = "List of bindings", body = BindingListResponse),
    ),
    tag = "bindings"
)]
pub async fn list_bindings<
    FS: FlowService + StepService + FieldService,
    ES: EstimatorService,
    SS: SubmissionService,
    BS: BindingService,
>(
    State(state): State<AppState<FS, ES, SS, BS>>,
    Path(flow_id): Path<String>,
) -> ApiResult<Json<ApiResponse<BindingListResponse>>> {
    let flow_id = FlowId::from_uuid(uuid::Uuid::parse_str(&flow_id)?);
    let bindings = state.binding_service.list_bindings(flow_id).await?;

    let response = BindingListResponse {
        bindings: bindings.into_iter().map(map_binding).collect(),
    };
    Ok(Json(ApiResponse::success(response)))
}

#[utoipa::path(
    put,
    path = "/api/v1/flows/{flow_id}/bindings/{binding_id}",
    params(
        ("flow_id" = String, Path, description = "Flow UUID"),
        ("binding_id" = String, Path, description = "Binding UUID"),
    ),
    request_body = UpdateBindingRequest,
    responses(
        (status = 200, description = "Binding updated", body = BindingResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Binding not found"),
    ),
    tag = "bindings"
)]
pub async fn update_binding<
    FS: FlowService + StepService + FieldService,
    ES: EstimatorService,
    SS: SubmissionService,
    BS: BindingService,
>(
    State(state): State<AppState<FS, ES, SS, BS>>,
    Path((flow_id, binding_id)): Path<(String, String)>,
    Json(request): Json<UpdateBindingRequest>,
) -> ApiResult<Json<ApiResponse<BindingResponse>>> {
    let flow_id = FlowId::from_uuid(
        uuid::Uuid::parse_str(&flow_id).map_err(|e| ApiError::BadRequest(e.to_string()))?,
    );
    let binding_id = BindingId::from_uuid(
        uuid::Uuid::parse_str(&binding_id).map_err(|e| ApiError::BadRequest(e.to_string()))?,
    );

    let inputs = request.inputs_mapping.map(|m| {
        m.into_iter()
            .map(|(k, v)| (k, dto_value_to_domain(v)))
            .collect::<HashMap<String, InputBindingValue>>()
    });
    let map_over = request.map_over_step.map(|opt| opt.map(StepId::from_uuid));
    let reduce = request.outputs_reduce_strategy.map(|m| {
        m.into_iter()
            .map(|(k, v)| (k, dto_strategy_to_domain(v)))
            .collect::<HashMap<String, AggregationStrategy>>()
    });

    let binding = state
        .binding_service
        .update_binding(flow_id, binding_id, inputs, map_over, reduce)
        .await?;

    Ok(Json(ApiResponse::success(map_binding(binding))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/flows/{flow_id}/bindings/{binding_id}",
    params(
        ("flow_id" = String, Path, description = "Flow UUID"),
        ("binding_id" = String, Path, description = "Binding UUID"),
    ),
    responses(
        (status = 200, description = "Binding deleted", body = MessageResponse),
        (status = 404, description = "Binding not found"),
        (status = 409, description = "Binding is referenced by another binding"),
    ),
    tag = "bindings"
)]
pub async fn remove_binding<
    FS: FlowService + StepService + FieldService,
    ES: EstimatorService,
    SS: SubmissionService,
    BS: BindingService,
>(
    State(state): State<AppState<FS, ES, SS, BS>>,
    Path((flow_id, binding_id)): Path<(String, String)>,
) -> ApiResult<(StatusCode, Json<ApiResponse<MessageResponse>>)> {
    let flow_id = FlowId::from_uuid(
        uuid::Uuid::parse_str(&flow_id).map_err(|e| ApiError::BadRequest(e.to_string()))?,
    );
    let binding_id = BindingId::from_uuid(
        uuid::Uuid::parse_str(&binding_id).map_err(|e| ApiError::BadRequest(e.to_string()))?,
    );

    state
        .binding_service
        .remove_binding(flow_id, binding_id)
        .await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(MessageResponse::new(
            "Binding deleted successfully",
        ))),
    ))
}
