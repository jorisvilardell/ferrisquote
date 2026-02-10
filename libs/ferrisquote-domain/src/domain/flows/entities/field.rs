use uuid::Uuid;

type FieldId = Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Field {
    pub id: FieldId,
    pub key: String,
    pub label: String,
    pub description: String,
    pub order: u32,

    pub config: FieldConfig,
}

impl Field {
    pub fn new(
        id: String,
        key: String,
        label: String,
        description: String,
        order: u32,
        config: FieldConfig,
    ) -> Self {
        Field {
            id: Uuid::new_v4(),
            key,
            label,
            description,
            order,
            config,
        }
    }
}

pub enum FieldConfig {
    Text(FieldText),
    Number(FieldNumber),
    Date(FieldDate),
    Boolean(FieldBoolean),
    Select(FieldSelect),
}

impl FieldConfig {
    pub fn new_text(max_length: u32) -> Self {
        FieldConfig::Text(FieldText { max_length })
    }

    pub fn new_number(min: f64, max: f64) -> Self {
        FieldConfig::Number(FieldNumber { min, max })
    }

    pub fn new_date(min: chrono::NaiveDate, max: chrono::NaiveDate) -> Self {
        FieldConfig::Date(FieldDate { min, max })
    }

    pub fn new_boolean(default: bool) -> Self {
        FieldConfig::Boolean(FieldBoolean { default })
    }

    pub fn new_select(options: Vec<String>) -> Self {
        FieldConfig::Select(FieldSelect { options })
    }
}

pub struct FieldText {
    pub max_length: u32,
}

pub struct FieldNumber {
    pub min: f64,
    pub max: f64,
}

pub struct FieldDate {
    pub min: chrono::NaiveDate,
    pub max: chrono::NaiveDate,
}

pub struct FieldBoolean {
    pub default: bool,
}

pub struct FieldSelect {
    pub options: Vec<String>,
}
