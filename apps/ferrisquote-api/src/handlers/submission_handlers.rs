use std::collections::HashMap;

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use ferrisquote_domain::domain::{
    estimator::ports::EstimatorService,
    flows::{
        entities::id::{FieldId, FlowId, StepId},
        ports::{FieldService, FlowService, StepService},
    },
    submission::{
        entities::{FieldValue, StepIteration, Submission, SubmissionId},
        ports::SubmissionService,
    },
    user::entities::UserId,
};

use crate::{
    dto::{
        ApiResponse, FieldValueDto, StepIterationDto, SubmissionListResponse, SubmissionResponse,
        SubmitAnswersRequest,
    },
    error::{ApiError, ApiResult},
    state::AppState,
};

// ============================================================================
// Mappers
// ============================================================================

fn field_value_to_domain(v: FieldValueDto) -> FieldValue {
    match v {
        FieldValueDto::Text(s) => FieldValue::Text(s),
        FieldValueDto::Number(n) => FieldValue::Number(n),
        FieldValueDto::Boolean(b) => FieldValue::Boolean(b),
        FieldValueDto::Array(a) => FieldValue::Array(a),
    }
}

fn field_value_to_dto(v: FieldValue) -> FieldValueDto {
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
        out.insert(FieldId::from_uuid(field_uuid), field_value_to_domain(v));
    }
    Ok(StepIteration::new(out))
}

fn iteration_to_dto(iter: StepIteration) -> StepIterationDto {
    StepIterationDto {
        answers: iter
            .answers
            .into_iter()
            .map(|(id, v)| (id.to_string(), field_value_to_dto(v)))
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

// ============================================================================
// Handlers
// ============================================================================

#[utoipa::path(
    post,
    path = "/api/v1/flows/{flow_id}/submissions",
    params(("flow_id" = String, Path, description = "Flow UUID")),
    request_body = SubmitAnswersRequest,
    responses(
        (status = 201, description = "Submission created", body = SubmissionResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Flow not found"),
    ),
    tag = "submissions"
)]
pub async fn submit_answers<
    FS: FlowService + StepService + FieldService,
    ES: EstimatorService,
    SS: SubmissionService,
    BS: ferrisquote_domain::domain::flows::ports::BindingService,
>(
    State(state): State<AppState<FS, ES, SS, BS>>,
    Path(flow_id): Path<String>,
    Json(request): Json<SubmitAnswersRequest>,
) -> ApiResult<(StatusCode, Json<ApiResponse<SubmissionResponse>>)> {
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

    let submission = state
        .submission_service
        .submit_answers(flow_id, user_id, answers)
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::success(map_submission(submission))),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/submissions/{submission_id}",
    params(("submission_id" = String, Path, description = "Submission UUID")),
    responses(
        (status = 200, description = "Submission found", body = SubmissionResponse),
        (status = 404, description = "Submission not found"),
    ),
    tag = "submissions"
)]
pub async fn get_submission_by_id<
    FS: FlowService + StepService + FieldService,
    ES: EstimatorService,
    SS: SubmissionService,
    BS: ferrisquote_domain::domain::flows::ports::BindingService,
>(
    State(state): State<AppState<FS, ES, SS, BS>>,
    Path(submission_id): Path<String>,
) -> ApiResult<Json<ApiResponse<SubmissionResponse>>> {
    let id = SubmissionId::from_uuid(uuid::Uuid::parse_str(&submission_id)?);
    let submission = state.submission_service.get_submission_by_id(id).await?;
    Ok(Json(ApiResponse::success(map_submission(submission))))
}

#[utoipa::path(
    get,
    path = "/api/v1/flows/{flow_id}/submissions",
    params(("flow_id" = String, Path, description = "Flow UUID")),
    responses(
        (status = 200, description = "List of submissions", body = SubmissionListResponse),
    ),
    tag = "submissions"
)]
pub async fn list_submissions_for_flow<
    FS: FlowService + StepService + FieldService,
    ES: EstimatorService,
    SS: SubmissionService,
    BS: ferrisquote_domain::domain::flows::ports::BindingService,
>(
    State(state): State<AppState<FS, ES, SS, BS>>,
    Path(flow_id): Path<String>,
) -> ApiResult<Json<ApiResponse<SubmissionListResponse>>> {
    let flow_id = FlowId::from_uuid(uuid::Uuid::parse_str(&flow_id)?);
    let submissions = state
        .submission_service
        .list_submissions_for_flow(flow_id)
        .await?;

    let response = SubmissionListResponse {
        submissions: submissions.into_iter().map(map_submission).collect(),
    };

    Ok(Json(ApiResponse::success(response)))
}
