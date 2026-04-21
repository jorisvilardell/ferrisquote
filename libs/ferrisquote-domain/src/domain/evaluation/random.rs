use std::collections::HashMap;

use chrono::NaiveDate;
use rand::{Rng, SeedableRng, rngs::StdRng, seq::SliceRandom};

use crate::domain::{
    flows::entities::{
        field::FieldConfig,
        flow::Flow,
        id::{FieldId, StepId},
    },
    submission::entities::{FieldValue, StepIteration, Submission},
    user::entities::UserId,
};

/// Build a random but schema-valid submission for the given flow. Used by
/// the preview endpoint so the frontend can show a ready-to-run calculation
/// without forcing the user to fill the form. Deterministic per-call but
/// not reproducible (no external seed exposed).
pub fn generate_random_submission(flow: &Flow) -> Submission {
    let mut rng = StdRng::from_entropy();
    let mut answers: HashMap<StepId, Vec<StepIteration>> = HashMap::new();

    for step in &flow.steps {
        let count = pick_iteration_count(&mut rng, step.is_repeatable, step.min_repeats, step.max_repeats);
        let mut iterations = Vec::with_capacity(count as usize);
        for _ in 0..count {
            let mut per_field: HashMap<FieldId, FieldValue> = HashMap::new();
            for field in &step.fields {
                per_field.insert(field.id, random_value(&mut rng, &field.config));
            }
            iterations.push(StepIteration::new(per_field));
        }
        answers.insert(step.id, iterations);
    }

    Submission::new(flow.id, UserId::new(), answers)
}

fn pick_iteration_count(rng: &mut StdRng, repeatable: bool, min: u32, max: Option<u32>) -> u32 {
    if !repeatable {
        return min.max(1);
    }
    let ceiling = max.unwrap_or(min.max(1) + 3);
    if ceiling <= min {
        return min;
    }
    rng.gen_range(min..=ceiling)
}

fn random_value(rng: &mut StdRng, config: &FieldConfig) -> FieldValue {
    match config {
        FieldConfig::Number(cfg) => {
            let lo = cfg.min.unwrap_or(0.0);
            let hi = cfg.max.unwrap_or(lo + 100.0);
            let (lo, hi) = if lo <= hi { (lo, hi) } else { (hi, lo) };
            let v = if (hi - lo).abs() < f64::EPSILON {
                lo
            } else {
                rng.gen_range(lo..=hi)
            };
            FieldValue::Number((v * 100.0).round() / 100.0)
        }
        FieldConfig::Boolean(_) => FieldValue::Boolean(rng.gen_bool(0.5)),
        FieldConfig::Text(cfg) => {
            let max_len = cfg.max_length.min(12).max(3) as usize;
            let len = rng.gen_range(3..=max_len);
            let s: String = (0..len)
                .map(|_| {
                    let idx = rng.gen_range(0..26);
                    (b'a' + idx as u8) as char
                })
                .collect();
            FieldValue::Text(s)
        }
        FieldConfig::Date(cfg) => {
            let min = date_to_days(cfg.min);
            let max = date_to_days(cfg.max);
            let (min, max) = if min <= max { (min, max) } else { (max, min) };
            let pick = if min == max { min } else { rng.gen_range(min..=max) };
            FieldValue::Text(days_to_date(pick).to_string())
        }
        FieldConfig::Select(cfg) => {
            if let Some(choice) = cfg.options.choose(rng) {
                FieldValue::Text(choice.clone())
            } else {
                FieldValue::Text(String::new())
            }
        }
    }
}

fn date_to_days(d: NaiveDate) -> i64 {
    d.signed_duration_since(NaiveDate::from_ymd_opt(1970, 1, 1).unwrap())
        .num_days()
}

fn days_to_date(days: i64) -> NaiveDate {
    NaiveDate::from_ymd_opt(1970, 1, 1).unwrap() + chrono::Duration::days(days)
}
