use crate::domain::{
    entities::{claims::Claims, identity::Identity},
    error::AuthError,
};

pub trait AuthRepository: Send + Sync {
    fn validate_token(&self, token: &str)
    -> impl Future<Output = Result<Claims, AuthError>> + Send;

    fn identity(&self, token: &str) -> impl Future<Output = Result<Identity, AuthError>> + Send;
}
