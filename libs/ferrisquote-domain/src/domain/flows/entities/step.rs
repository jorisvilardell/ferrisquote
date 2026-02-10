use ferrisquote::domain::flows::entities::field::Field;

type StepId = Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Step {
    id: StepId,
    title: String,
    description: String,
    order: i32,
    fields: Vec<Field>,
}

impl Step {
    pub fn new(id: String, title: String, description: String, order: i32) -> Self {
        Step {
            id,
            title,
            description,
            order,
        }
    }
}
