use std::sync::Arc;

use ferrisquote_domain::domain::flows::ports::FlowService;

/// Application state shared across all handlers
/// This is where dependency injection happens
///
/// Using generics allows us to keep the domain trait interface
/// while using concrete implementations (zero-cost abstraction)
#[derive(Clone)]
pub struct AppState<S: FlowService> {
    pub flow_service: Arc<S>,
}

impl<S: FlowService> AppState<S> {
    pub fn new(flow_service: Arc<S>) -> Self {
        Self { flow_service }
    }
}
