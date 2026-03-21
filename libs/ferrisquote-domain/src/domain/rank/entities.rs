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

/// Allow converting a reference to `Rank` into `&str`.
/// We implement `Into<&str>` for `&Rank` (not for `Rank`) because converting
/// a moved `Rank` into a borrowed `&str` would produce a dangling reference.
/// Implementing for `&Rank` lets callers do `let s: &str = (&rank).into();`.
impl<'a> Into<&'a str> for &'a Rank {
    fn into(self) -> &'a str {
        self.as_str()
    }
}
