use std::sync::Arc;

use crate::{args::Args, errors::ApiError};

#[derive(Clone)]
pub struct AppState {
    #[allow(unused)]
    pub args: Arc<Args>,
}

pub async fn state(args: Arc<Args>) -> Result<AppState, ApiError> {
    Ok(AppState { args })
}
