use serde::{Deserialize, Serialize};

use crate::domain::entities::token::Token;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Role(pub String);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Scope(pub String);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Subject(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Subject,
    pub iss: String,
    pub aud: Option<String>,
    pub exp: Option<i64>,

    pub email: Option<String>,
    pub email_verified: bool,
    pub name: Option<String>,
    pub preferred_username: String,
    pub given_name: Option<String>,
    pub family_name: Option<String>,
    pub scope: String,
    pub client_id: Option<String>,

    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Jwt {
    pub claims: Claims,
    pub token: Token,
}
