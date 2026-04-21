use std::collections::HashMap;

use chrono::NaiveDate;

use crate::domain::error::DomainError;
use crate::domain::flows::entities::field::{Field, FieldConfig};
use crate::domain::flows::entities::flow::Flow;
use crate::domain::flows::entities::ids::{FieldId, FlowId, StepId};
use crate::domain::flows::entities::step::Step;
use crate::domain::flows::ports::FlowRepository;
use crate::domain::user::entities::UserId;

use super::entities::{FieldValue, StepIteration, Submission, SubmissionId};
use super::ports::{SubmissionRepository, SubmissionService};

#[derive(Clone)]
pub struct SubmissionServiceImpl<SR, FLR> {
    repo: SR,
    flow_repo: FLR,
}

impl<SR, FLR> SubmissionServiceImpl<SR, FLR> {
    pub fn new(repo: SR, flow_repo: FLR) -> Self {
        Self { repo, flow_repo }
    }
}

/// Validate a FieldValue against the Field it targets.
fn validate_value(field: &Field, value: &FieldValue) -> Result<(), DomainError> {
    match (&field.config, value) {
        (FieldConfig::Text(cfg), FieldValue::Text(s)) => {
            if s.chars().count() > cfg.max_length as usize {
                return Err(DomainError::validation(format!(
                    "Field '{}': text exceeds max length of {}",
                    field.key, cfg.max_length
                )));
            }
            Ok(())
        }
        (FieldConfig::Number(cfg), FieldValue::Number(n)) => {
            if let Some(min) = cfg.min {
                if *n < min {
                    return Err(DomainError::validation(format!(
                        "Field '{}': value {n} below minimum {min}",
                        field.key
                    )));
                }
            }
            if let Some(max) = cfg.max {
                if *n > max {
                    return Err(DomainError::validation(format!(
                        "Field '{}': value {n} above maximum {max}",
                        field.key
                    )));
                }
            }
            Ok(())
        }
        (FieldConfig::Date(cfg), FieldValue::Text(s)) => {
            let d = NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| {
                DomainError::validation(format!(
                    "Field '{}': expected ISO date (YYYY-MM-DD), got '{s}'",
                    field.key
                ))
            })?;
            if d < cfg.min || d > cfg.max {
                return Err(DomainError::validation(format!(
                    "Field '{}': date {d} out of allowed range [{}, {}]",
                    field.key, cfg.min, cfg.max
                )));
            }
            Ok(())
        }
        (FieldConfig::Boolean(_), FieldValue::Boolean(_)) => Ok(()),
        (FieldConfig::Select(cfg), FieldValue::Text(choice)) => {
            if !cfg.options.iter().any(|o| o == choice) {
                return Err(DomainError::validation(format!(
                    "Field '{}': value '{choice}' not in allowed options",
                    field.key
                )));
            }
            Ok(())
        }
        (FieldConfig::Select(cfg), FieldValue::Array(choices)) => {
            for c in choices {
                if !cfg.options.iter().any(|o| o == c) {
                    return Err(DomainError::validation(format!(
                        "Field '{}': value '{c}' not in allowed options",
                        field.key
                    )));
                }
            }
            Ok(())
        }
        _ => Err(DomainError::validation(format!(
            "Field '{}': value variant does not match field type",
            field.key
        ))),
    }
}

/// Validate every step/iteration/field triple against the flow structure.
fn validate_answers(
    flow: &Flow,
    answers: &HashMap<StepId, Vec<StepIteration>>,
) -> Result<(), DomainError> {
    let steps_by_id: HashMap<StepId, &Step> = flow.steps.iter().map(|s| (s.id, s)).collect();

    for (step_id, iterations) in answers {
        let step = steps_by_id.get(step_id).ok_or_else(|| {
            DomainError::validation(format!("Unknown step_id '{step_id}' for this flow"))
        })?;

        let count = iterations.len() as u32;
        if !step.is_repeatable && count > 1 {
            return Err(DomainError::validation(format!(
                "Step '{}' is not repeatable but got {} iterations",
                step.title, count
            )));
        }
        if count < step.min_repeats {
            return Err(DomainError::validation(format!(
                "Step '{}' requires at least {} iteration(s), got {}",
                step.title, step.min_repeats, count
            )));
        }
        if let Some(max) = step.max_repeats {
            if count > max {
                return Err(DomainError::validation(format!(
                    "Step '{}' allows at most {} iteration(s), got {}",
                    step.title, max, count
                )));
            }
        }

        let fields_by_id: HashMap<FieldId, &Field> =
            step.fields.iter().map(|f| (f.id, f)).collect();

        for iteration in iterations {
            for (field_id, value) in &iteration.answers {
                let field = fields_by_id.get(field_id).ok_or_else(|| {
                    DomainError::validation(format!(
                        "Field '{field_id}' does not belong to step '{}'",
                        step.title
                    ))
                })?;
                validate_value(field, value)?;
            }
        }
    }

    for step in &flow.steps {
        if step.min_repeats > 0 && !answers.contains_key(&step.id) {
            return Err(DomainError::validation(format!(
                "Step '{}' requires at least {} iteration(s), got 0",
                step.title, step.min_repeats
            )));
        }
    }

    Ok(())
}

impl<SR, FLR> SubmissionService for SubmissionServiceImpl<SR, FLR>
where
    SR: SubmissionRepository + Send + Sync,
    FLR: FlowRepository + Send + Sync,
{
    async fn submit_answers(
        &self,
        flow_id: FlowId,
        user_id: UserId,
        answers: HashMap<StepId, Vec<StepIteration>>,
    ) -> Result<Submission, DomainError> {
        let flow = self.flow_repo.get_flow(flow_id).await?;
        validate_answers(&flow, &answers)?;
        let submission = Submission::new(flow_id, user_id, answers);
        self.repo.create_submission(submission).await
    }

    async fn get_submission_by_id(&self, id: SubmissionId) -> Result<Submission, DomainError> {
        self.repo.get_submission(id).await
    }

    async fn list_submissions_for_flow(
        &self,
        flow_id: FlowId,
    ) -> Result<Vec<Submission>, DomainError> {
        self.repo.list_flow_submissions(flow_id).await
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::flows::entities::field::{
        FieldBoolean, FieldConfig, FieldDate, FieldNumber, FieldSelect,
    };

    fn mk_field(key: &str, config: FieldConfig) -> Field {
        Field::new(
            key.to_string(),
            "label".into(),
            String::new(),
            "a".into(),
            config,
        )
    }

    fn mk_step(title: &str, fields: Vec<Field>, repeatable: bool, min: u32, max: Option<u32>) -> Step {
        Step::with_fields(
            StepId::new(),
            title.into(),
            String::new(),
            "a".into(),
            repeatable,
            None,
            min,
            max,
            fields,
        )
    }

    fn mk_flow(steps: Vec<Step>) -> Flow {
        Flow::with_steps(FlowId::new(), "flow".into(), String::new(), steps)
    }

    fn iter_of(pairs: &[(FieldId, FieldValue)]) -> StepIteration {
        StepIteration::new(pairs.iter().cloned().collect())
    }

    #[test]
    fn text_within_max_length_ok() {
        let f = mk_field("name", FieldConfig::new_text(5));
        assert!(validate_value(&f, &FieldValue::Text("abcde".into())).is_ok());
    }

    #[test]
    fn text_over_max_length_rejected() {
        let f = mk_field("name", FieldConfig::new_text(3));
        assert!(validate_value(&f, &FieldValue::Text("abcd".into())).is_err());
    }

    #[test]
    fn number_range_enforced() {
        let f = mk_field("age", FieldConfig::new_number(Some(0.0), Some(120.0)));
        assert!(validate_value(&f, &FieldValue::Number(42.0)).is_ok());
        assert!(validate_value(&f, &FieldValue::Number(-1.0)).is_err());
        assert!(validate_value(&f, &FieldValue::Number(121.0)).is_err());
    }

    #[test]
    fn select_must_match_option() {
        let f = mk_field(
            "color",
            FieldConfig::new_select(vec!["red".into(), "blue".into()]),
        );
        assert!(validate_value(&f, &FieldValue::Text("red".into())).is_ok());
        assert!(validate_value(&f, &FieldValue::Text("green".into())).is_err());
        assert!(validate_value(
            &f,
            &FieldValue::Array(vec!["red".into(), "blue".into()])
        )
        .is_ok());
        assert!(validate_value(
            &f,
            &FieldValue::Array(vec!["red".into(), "yellow".into()])
        )
        .is_err());
    }

    #[test]
    fn date_within_range_ok() {
        let min = NaiveDate::from_ymd_opt(2020, 1, 1).unwrap();
        let max = NaiveDate::from_ymd_opt(2030, 1, 1).unwrap();
        let f = mk_field("dob", FieldConfig::Date(FieldDate { min, max }));
        assert!(validate_value(&f, &FieldValue::Text("2025-06-01".into())).is_ok());
        assert!(validate_value(&f, &FieldValue::Text("2019-12-31".into())).is_err());
        assert!(validate_value(&f, &FieldValue::Text("not-a-date".into())).is_err());
    }

    #[test]
    fn variant_mismatch_rejected() {
        let f = mk_field("flag", FieldConfig::Boolean(FieldBoolean { default: false }));
        assert!(validate_value(&f, &FieldValue::Text("true".into())).is_err());
        let n = mk_field("age", FieldConfig::Number(FieldNumber { min: None, max: None }));
        assert!(validate_value(&n, &FieldValue::Text("42".into())).is_err());
    }

    #[test]
    fn unknown_step_rejected() {
        let f = mk_field("name", FieldConfig::new_text(10));
        let step = mk_step("S", vec![f], false, 1, None);
        let flow = mk_flow(vec![step]);

        let mut answers = HashMap::new();
        answers.insert(StepId::new(), vec![iter_of(&[])]);
        assert!(validate_answers(&flow, &answers).is_err());
    }

    #[test]
    fn unknown_field_rejected() {
        let f = mk_field("name", FieldConfig::new_text(10));
        let step = mk_step("S", vec![f], false, 1, None);
        let sid = step.id;
        let flow = mk_flow(vec![step]);

        let mut answers = HashMap::new();
        answers.insert(
            sid,
            vec![iter_of(&[(FieldId::new(), FieldValue::Text("x".into()))])],
        );
        assert!(validate_answers(&flow, &answers).is_err());
    }

    #[test]
    fn non_repeatable_rejects_multiple_iterations() {
        let f = mk_field("name", FieldConfig::new_text(10));
        let fid = f.id;
        let step = mk_step("S", vec![f], false, 1, None);
        let sid = step.id;
        let flow = mk_flow(vec![step]);

        let mut answers = HashMap::new();
        answers.insert(
            sid,
            vec![
                iter_of(&[(fid, FieldValue::Text("a".into()))]),
                iter_of(&[(fid, FieldValue::Text("b".into()))]),
            ],
        );
        assert!(validate_answers(&flow, &answers).is_err());
    }

    #[test]
    fn repeatable_step_preserves_correlation() {
        let type_sol = mk_field(
            "type_sol",
            FieldConfig::Select(FieldSelect {
                options: vec!["Carrelage".into(), "Parquet".into()],
            }),
        );
        let nb_prises = mk_field("nb_prises", FieldConfig::new_number(Some(0.0), None));
        let sol_id = type_sol.id;
        let prises_id = nb_prises.id;
        let step = mk_step("Piece", vec![type_sol, nb_prises], true, 1, Some(10));
        let sid = step.id;
        let flow = mk_flow(vec![step]);

        let mut answers = HashMap::new();
        answers.insert(
            sid,
            vec![
                iter_of(&[
                    (sol_id, FieldValue::Text("Carrelage".into())),
                    (prises_id, FieldValue::Number(5.0)),
                ]),
                iter_of(&[
                    (sol_id, FieldValue::Text("Parquet".into())),
                    (prises_id, FieldValue::Number(3.0)),
                ]),
            ],
        );
        assert!(validate_answers(&flow, &answers).is_ok());
    }

    #[test]
    fn min_repeats_enforced() {
        let f = mk_field("x", FieldConfig::new_text(10));
        let fid = f.id;
        let step = mk_step("Rooms", vec![f], true, 2, None);
        let sid = step.id;
        let flow = mk_flow(vec![step]);

        let mut answers = HashMap::new();
        answers.insert(sid, vec![iter_of(&[(fid, FieldValue::Text("a".into()))])]);
        assert!(validate_answers(&flow, &answers).is_err());

        let mut enough = HashMap::new();
        enough.insert(
            sid,
            vec![
                iter_of(&[(fid, FieldValue::Text("a".into()))]),
                iter_of(&[(fid, FieldValue::Text("b".into()))]),
            ],
        );
        assert!(validate_answers(&flow, &enough).is_ok());
    }

    #[test]
    fn max_repeats_enforced() {
        let f = mk_field("x", FieldConfig::new_text(10));
        let fid = f.id;
        let step = mk_step("Rooms", vec![f], true, 1, Some(2));
        let sid = step.id;
        let flow = mk_flow(vec![step]);

        let mut answers = HashMap::new();
        answers.insert(
            sid,
            vec![
                iter_of(&[(fid, FieldValue::Text("a".into()))]),
                iter_of(&[(fid, FieldValue::Text("b".into()))]),
                iter_of(&[(fid, FieldValue::Text("c".into()))]),
            ],
        );
        assert!(validate_answers(&flow, &answers).is_err());
    }

    #[test]
    fn missing_required_step_rejected() {
        let f = mk_field("x", FieldConfig::new_text(10));
        let step = mk_step("Required", vec![f], false, 1, None);
        let flow = mk_flow(vec![step]);

        let answers: HashMap<StepId, Vec<StepIteration>> = HashMap::new();
        assert!(validate_answers(&flow, &answers).is_err());
    }
}
