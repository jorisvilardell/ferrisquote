use ferrisquote_domain::{Field, FieldConfig, Flow, Step};

use crate::{
    dto::{FieldConfigDto, FieldResponse, FlowResponse, StepResponse},
    error::ApiError,
};

/// Convert domain Flow to FlowResponse DTO
pub fn map_flow_to_response(flow: Flow) -> FlowResponse {
    FlowResponse {
        id: flow.id.into_uuid(),
        name: flow.name,
        description: flow.description,
        steps: flow.steps.into_iter().map(map_step_to_response).collect(),
    }
}

/// Convert domain Step to StepResponse DTO
pub fn map_step_to_response(step: Step) -> StepResponse {
    StepResponse {
        id: step.id.into_uuid(),
        title: step.title,
        description: step.description,
        order: step.order,
        fields: step.fields.into_iter().map(map_field_to_response).collect(),
    }
}

/// Convert domain Field to FieldResponse DTO
pub fn map_field_to_response(field: Field) -> FieldResponse {
    FieldResponse {
        id: field.id.into_uuid(),
        key: field.key,
        label: field.label,
        description: field.description,
        order: field.order,
        config: map_field_config_to_dto(field.config),
    }
}

/// Convert domain FieldConfig to DTO
pub fn map_field_config_to_dto(config: FieldConfig) -> FieldConfigDto {
    match config {
        FieldConfig::Text(text) => FieldConfigDto::Text {
            max_length: text.max_length,
        },
        FieldConfig::Number(number) => FieldConfigDto::Number {
            min: number.min,
            max: number.max,
        },
        FieldConfig::Date(date) => FieldConfigDto::Date {
            min: date.min.to_string(),
            max: date.max.to_string(),
        },
        FieldConfig::Boolean(boolean) => FieldConfigDto::Boolean {
            default: boolean.default,
        },
        FieldConfig::Select(select) => FieldConfigDto::Select {
            options: select.options,
        },
    }
}

/// Convert DTO FieldConfig to domain
pub fn map_field_config_from_dto(config: FieldConfigDto) -> Result<FieldConfig, ApiError> {
    match config {
        FieldConfigDto::Text { max_length } => Ok(FieldConfig::new_text(max_length)),
        FieldConfigDto::Number { min, max } => Ok(FieldConfig::new_number(min, max)),
        FieldConfigDto::Date { min, max } => {
            let min_date = chrono::NaiveDate::parse_from_str(&min, "%Y-%m-%d")
                .map_err(|e| ApiError::BadRequest(format!("Invalid min date format: {}", e)))?;
            let max_date = chrono::NaiveDate::parse_from_str(&max, "%Y-%m-%d")
                .map_err(|e| ApiError::BadRequest(format!("Invalid max date format: {}", e)))?;
            Ok(FieldConfig::new_date(min_date, max_date))
        }
        FieldConfigDto::Boolean { default } => Ok(FieldConfig::new_boolean(default)),
        FieldConfigDto::Select { options } => Ok(FieldConfig::new_select(options)),
    }
}
