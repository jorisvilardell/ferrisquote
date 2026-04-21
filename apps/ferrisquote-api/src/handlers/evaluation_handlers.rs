use std::collections::HashMap;

use axum::{
    Json,
    extract::{Path, State},
};
use ferrisquote_domain::domain::{
    estimator::ports::EstimatorService,
    evaluation::{
        ports::{FlowEvaluationResult, FlowEvaluationService, FlowPreviewResult},
    },
    flows::{
        entities::id::{FieldId, FlowId, StepId},
        ports::{BindingService, FieldService, FlowService, StepService},
    },
    submission::{
        entities::{FieldValue, StepIteration, Submission},
        ports::SubmissionService,
    },
    user::entities::UserId,
};

use crate::{
    dto::{
        ApiResponse, EvaluateBindingsRequest, FieldValueDto, FlowEvaluationResponse,
        FlowPreviewResponse, StepIterationDto, SubmissionResponse,
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

fn iteration_to_domain(dto: StepIterationDto) -> ApiResult<StepIteration> {
    let mut out = HashMap::with_capacity(dto.answers.len());
    for (k, v) in dto.answers {
        let field_uuid = uuid::Uuid::parse_str(&k)
            .map_err(|e| ApiError::BadRequest(format!("Invalid field_id '{k}': {e}")))?;
        out.insert(FieldId::from_uuid(field_uuid), dto_field_value_to_domain(v));
    }
    Ok(StepIteration::new(out))
}

fn iteration_to_dto(iter: StepIteration) -> StepIterationDto {
    StepIterationDto {
        answers: iter
            .answers
            .into_iter()
            .map(|(id, v)| (id.to_string(), domain_field_value_to_dto(v)))
            .collect(),
    }
}

fn map_submission(s: Submission) -> SubmissionResponse {
    SubmissionResponse {
        id: s.id.into_uuid(),
        flow_id: s.flow_id.into_uuid(),
        user_id: s.user_id.into_uuid(),
        submitted_at: s.submitted_at,
        answers: s
            .answers
            .into_iter()
            .map(|(step_id, iterations)| {
                (
                    step_id.to_string(),
                    iterations.into_iter().map(iteration_to_dto).collect(),
                )
            })
            .collect(),
    }
}

fn map_result(res: FlowEvaluationResult) -> FlowEvaluationResponse {
    FlowEvaluationResponse {
        bindings: res
            .bindings
            .into_iter()
            .map(|(k, v)| (k.to_string(), v))
            .collect(),
        flat: res.flat,
    }
}

// ============================================================================
// Handlers
// ============================================================================

#[utoipa::path(
    post,
    path = "/api/v1/flows/{flow_id}/evaluate-bindings",
    params(("flow_id" = String, Path, description = "Flow UUID")),
    request_body = EvaluateBindingsRequest,
    responses(
        (status = 200, description = "Evaluation result", body = FlowEvaluationResponse),
        (status = 400, description = "Validation / cycle error"),
        (status = 404, description = "Flow not found"),
    ),
    tag = "evaluation"
)]
pub async fn evaluate_bindings<
    FS: FlowService + StepService + FieldService,
    ES: EstimatorService,
    SS: SubmissionService,
    BS: BindingService,
    FES: FlowEvaluationService,
>(
    State(state): State<AppState<FS, ES, SS, BS, FES>>,
    Path(flow_id): Path<String>,
    Json(request): Json<EvaluateBindingsRequest>,
) -> ApiResult<Json<ApiResponse<FlowEvaluationResponse>>> {
    let flow_id = FlowId::from_uuid(uuid::Uuid::parse_str(&flow_id)?);
    let user_id = UserId::from_uuid(request.user_id);

    let mut answers: HashMap<StepId, Vec<StepIteration>> =
        HashMap::with_capacity(request.answers.len());
    for (step_key, iterations_dto) in request.answers {
        let step_uuid = uuid::Uuid::parse_str(&step_key)
            .map_err(|e| ApiError::BadRequest(format!("Invalid step_id '{step_key}': {e}")))?;
        let iters = iterations_dto
            .into_iter()
            .map(iteration_to_domain)
            .collect::<ApiResult<Vec<_>>>()?;
        answers.insert(StepId::from_uuid(step_uuid), iters);
    }

    let submission = Submission::new(flow_id, user_id, answers);
    let res = state
        .flow_evaluation_service
        .evaluate_flow_bindings(flow_id, submission)
        .await?;

    Ok(Json(ApiResponse::success(map_result(res))))
}

#[utoipa::path(
    post,
    path = "/api/v1/flows/{flow_id}/evaluate-bindings-preview",
    params(("flow_id" = String, Path, description = "Flow UUID")),
    responses(
        (status = 200, description = "Preview with random values", body = FlowPreviewResponse),
        (status = 400, description = "Validation / cycle error"),
        (status = 404, description = "Flow not found"),
    ),
    tag = "evaluation"
)]
pub async fn preview_flow<
    FS: FlowService + StepService + FieldService,
    ES: EstimatorService,
    SS: SubmissionService,
    BS: BindingService,
    FES: FlowEvaluationService,
>(
    State(state): State<AppState<FS, ES, SS, BS, FES>>,
    Path(flow_id): Path<String>,
) -> ApiResult<Json<ApiResponse<FlowPreviewResponse>>> {
    let flow_id = FlowId::from_uuid(uuid::Uuid::parse_str(&flow_id)?);
    let FlowPreviewResult { submission, evaluation } = state
        .flow_evaluation_service
        .preview_flow(flow_id)
        .await?;

    Ok(Json(ApiResponse::success(FlowPreviewResponse {
        submission: map_submission(submission),
        evaluation: map_result(evaluation),
    })))
}
