use serde::{Deserialize, Serialize};

use super::{field::Field, ids::StepId};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Step {
    pub id: StepId,
    pub title: String,
    pub description: String,
    pub order: u32,
    pub fields: Vec<Field>,
}

impl Step {
    pub fn new(title: String, description: String, order: u32) -> Self {
        Step {
            id: StepId::new(),
            title,
            description,
            order,
            fields: Vec::new(),
        }
    }

    pub fn with_id(id: StepId, title: String, description: String, order: u32) -> Self {
        Step {
            id,
            title,
            description,
            order,
            fields: Vec::new(),
        }
    }

    pub fn with_fields(
        id: StepId,
        title: String,
        description: String,
        order: u32,
        fields: Vec<Field>,
    ) -> Self {
        Step {
            id,
            title,
            description,
            order,
            fields,
        }
    }

    pub fn add_field(&mut self, field: Field) {
        self.fields.push(field);
    }

    pub fn remove_field(&mut self, field_id: &super::ids::FieldId) -> Option<Field> {
        self.fields
            .iter()
            .position(|f| &f.id == field_id)
            .map(|pos| self.fields.remove(pos))
    }

    pub fn get_field(&self, field_id: &super::ids::FieldId) -> Option<&Field> {
        self.fields.iter().find(|f| &f.id == field_id)
    }

    pub fn get_field_mut(&mut self, field_id: &super::ids::FieldId) -> Option<&mut Field> {
        self.fields.iter_mut().find(|f| &f.id == field_id)
    }
}
