use std::collections::HashMap;

use crate::domain::error::DomainError;
use crate::domain::flows::entities::field::{Field, FieldConfig};
use crate::domain::flows::entities::ids::FlowId;
use crate::domain::flows::ports::FieldRepository;
use crate::domain::user::entities::UserId;

use super::entities::{AnswerValue, Submission, SubmissionAnswer, SubmissionId};
use super::ports::{SubmissionRepository, SubmissionService};

#[derive(Clone)]
pub struct SubmissionServiceImpl<SR, FR> {
    repo: SR,
    field_repo: FR,
}

impl<SR, FR> SubmissionServiceImpl<SR, FR> {
    pub fn new(repo: SR, field_repo: FR) -> Self {
        Self { repo, field_repo }
    }
}

/// Validate a single answer value against the field it targets. Rejects
/// variant mismatches and config-level constraint violations (length, range,
/// select options, etc.).
fn validate_answer(field: &Field, value: &AnswerValue) -> Result<(), DomainError> {
    match (&field.config, value) {
        (FieldConfig::Text(cfg), AnswerValue::Text(s)) => {
            if s.chars().count() > cfg.max_length as usize {
                return Err(DomainError::validation(format!(
                    "Field '{}': text exceeds max length of {}",
                    field.key, cfg.max_length
                )));
            }
            Ok(())
        }
        (FieldConfig::Number(cfg), AnswerValue::Number(n)) => {
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
        (FieldConfig::Date(cfg), AnswerValue::Date(d)) => {
            if *d < cfg.min || *d > cfg.max {
                return Err(DomainError::validation(format!(
                    "Field '{}': date {d} out of allowed range [{}, {}]",
                    field.key, cfg.min, cfg.max
                )));
            }
            Ok(())
        }
        (FieldConfig::Boolean(_), AnswerValue::Boolean(_)) => Ok(()),
        (FieldConfig::Select(cfg), AnswerValue::Select(choice)) => {
            if !cfg.options.iter().any(|o| o == choice) {
                return Err(DomainError::validation(format!(
                    "Field '{}': value '{choice}' is not among allowed options",
                    field.key
                )));
            }
            Ok(())
        }
        _ => Err(DomainError::validation(format!(
            "Field '{}': answer variant does not match field type",
            field.key
        ))),
    }
}

impl<SR, FR> SubmissionService for SubmissionServiceImpl<SR, FR>
where
    SR: SubmissionRepository + Send + Sync,
    FR: FieldRepository + Send + Sync,
{
    async fn submit(
        &self,
        flow_id: FlowId,
        user_id: UserId,
        answers: Vec<(String, AnswerValue)>,
    ) -> Result<Submission, DomainError> {
        let fields = self.field_repo.get_flow_fields(flow_id, None).await?;
        if fields.is_empty() {
            return Err(DomainError::not_found("Flow", flow_id.to_string()));
        }

        let by_key: HashMap<&str, &Field> =
            fields.iter().map(|f| (f.key.as_str(), f)).collect();

        let mut validated = Vec::with_capacity(answers.len());
        for (field_key, value) in answers {
            let field = by_key.get(field_key.as_str()).ok_or_else(|| {
                DomainError::validation(format!("Unknown field key '{field_key}' for this flow"))
            })?;
            validate_answer(field, &value)?;
            validated.push(SubmissionAnswer::new(field_key, value));
        }

        let submission = Submission::new(flow_id, user_id, validated);
        self.repo.create_submission(submission).await
    }

    async fn get_submission(&self, id: SubmissionId) -> Result<Submission, DomainError> {
        self.repo.get_submission(id).await
    }

    async fn list_submissions_for_flow(
        &self,
        flow_id: FlowId,
    ) -> Result<Vec<Submission>, DomainError> {
        self.repo.list_flow_submissions(flow_id).await
    }

    async fn list_submissions_for_user(
        &self,
        user_id: UserId,
    ) -> Result<Vec<Submission>, DomainError> {
        self.repo.list_user_submissions(user_id).await
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::flows::entities::field::{
        Field, FieldBoolean, FieldConfig, FieldDate, FieldNumber, FieldSelect, FieldText,
    };
    use chrono::NaiveDate;

    fn text_field(key: &str, max: u32) -> Field {
        Field::new(
            key.to_string(),
            "label".into(),
            String::new(),
            "a".into(),
            FieldConfig::Text(FieldText { max_length: max }),
        )
    }

    fn number_field(key: &str, min: Option<f64>, max: Option<f64>) -> Field {
        Field::new(
            key.to_string(),
            "label".into(),
            String::new(),
            "a".into(),
            FieldConfig::Number(FieldNumber { min, max }),
        )
    }

    fn select_field(key: &str, opts: &[&str]) -> Field {
        Field::new(
            key.to_string(),
            "label".into(),
            String::new(),
            "a".into(),
            FieldConfig::Select(FieldSelect {
                options: opts.iter().map(|s| s.to_string()).collect(),
            }),
        )
    }

    fn date_field(key: &str, min: NaiveDate, max: NaiveDate) -> Field {
        Field::new(
            key.to_string(),
            "label".into(),
            String::new(),
            "a".into(),
            FieldConfig::Date(FieldDate { min, max }),
        )
    }

    fn bool_field(key: &str) -> Field {
        Field::new(
            key.to_string(),
            "label".into(),
            String::new(),
            "a".into(),
            FieldConfig::Boolean(FieldBoolean { default: false }),
        )
    }

    #[test]
    fn text_within_max_length_ok() {
        let f = text_field("name", 5);
        assert!(validate_answer(&f, &AnswerValue::Text("abcde".into())).is_ok());
    }

    #[test]
    fn text_over_max_length_rejected() {
        let f = text_field("name", 3);
        assert!(validate_answer(&f, &AnswerValue::Text("abcd".into())).is_err());
    }

    #[test]
    fn number_range_enforced() {
        let f = number_field("age", Some(0.0), Some(120.0));
        assert!(validate_answer(&f, &AnswerValue::Number(42.0)).is_ok());
        assert!(validate_answer(&f, &AnswerValue::Number(-1.0)).is_err());
        assert!(validate_answer(&f, &AnswerValue::Number(121.0)).is_err());
    }

    #[test]
    fn select_must_match_option() {
        let f = select_field("color", &["red", "blue"]);
        assert!(validate_answer(&f, &AnswerValue::Select("red".into())).is_ok());
        assert!(validate_answer(&f, &AnswerValue::Select("green".into())).is_err());
    }

    #[test]
    fn date_within_range_ok() {
        let min = NaiveDate::from_ymd_opt(2020, 1, 1).unwrap();
        let max = NaiveDate::from_ymd_opt(2030, 1, 1).unwrap();
        let f = date_field("dob", min, max);
        let d = NaiveDate::from_ymd_opt(2025, 6, 1).unwrap();
        assert!(validate_answer(&f, &AnswerValue::Date(d)).is_ok());
        let too_old = NaiveDate::from_ymd_opt(2019, 12, 31).unwrap();
        assert!(validate_answer(&f, &AnswerValue::Date(too_old)).is_err());
    }

    #[test]
    fn variant_mismatch_rejected() {
        let f = bool_field("flag");
        assert!(validate_answer(&f, &AnswerValue::Text("true".into())).is_err());
        let n = number_field("age", None, None);
        assert!(validate_answer(&n, &AnswerValue::Text("42".into())).is_err());
    }
}
