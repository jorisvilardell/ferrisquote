use serde::{Deserialize, Serialize};

use super::id::UserId;

/// Application-level user. Distinct from `ferrisquote-auth::User` which
/// represents an authenticated identity coming from an IdP — this aggregate
/// is the owner/actor for domain objects (flows, quotes, estimators).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct User {
    pub id: UserId,
    pub mail: String,
    pub first_name: String,
    pub last_name: String,
}

impl User {
    pub fn new(mail: String, first_name: String, last_name: String) -> Self {
        Self {
            id: UserId::new(),
            mail,
            first_name,
            last_name,
        }
    }

    pub fn with_id(id: UserId, mail: String, first_name: String, last_name: String) -> Self {
        Self {
            id,
            mail,
            first_name,
            last_name,
        }
    }
}
