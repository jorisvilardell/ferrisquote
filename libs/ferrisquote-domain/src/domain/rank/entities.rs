use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct Rank(String);

impl Rank {
    pub fn from_string(value: String) -> Self {
        Self(value)
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<String> for Rank {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl Into<String> for Rank {
    fn into(self) -> String {
        self.0
    }
}

impl Into<&str> for Rank {
    fn into(self) -> &str {
        &self.0
    }
}
