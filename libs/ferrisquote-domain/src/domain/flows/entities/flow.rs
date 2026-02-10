use uuid::Uuid;

type FlowId = Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Flow {
    id: FlowId,
    name: String,
    description: String,
    steps: Vec<Steps>,
}

impl Flow {
    pub fn new(id: String, name: String, description: String) -> Self {
        Flow {
            id,
            name,
            description,
        }
    }
}
