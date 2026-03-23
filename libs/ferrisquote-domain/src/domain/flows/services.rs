use crate::domain::{
    error::DomainError,
    rank::{entities::Rank, ports::RankService},
};

use super::{
    entities::{
        field::{Field, FieldConfig},
        flow::Flow,
        ids::{FieldId, FlowId, StepId},
        step::Step,
    },
    ports::{
        FieldRepository, FieldService, FlowRepository, FlowService, StepRepository, StepService,
    },
};

/// A concrete implementation that provides the application-level services for
/// flows, steps and fields.
///
/// The `FlowServiceImpl` acts as an orchestrator: it implements the `FlowService`,
/// `StepService` and `FieldService` traits and delegates persistence to the
/// provided repository implementations. It also uses a `RankService` to compute
/// ordering ranks for steps and fields.
///
/// Type parameters:
/// - `FR`: type implementing `FlowRepository` (storage for flows)
/// - `SR`: type implementing `StepRepository` (storage for steps)
/// - `FDR`: type implementing `FieldRepository` (storage for fields)
/// - `RS`: type implementing `RankService` (rank generation)
///
/// Example:
/// ```no_run
/// # use ferrisquote::domain::flows::ports::*;
/// # use ferrisquote::domain::rank::ports::RankService;
/// # struct MyFlowRepo; struct MyStepRepo; struct MyFieldRepo; struct MyRankSvc;
/// # impl FlowRepository for MyFlowRepo { /* ... */ }
/// # impl StepRepository for MyStepRepo { /* ... */ }
/// # impl FieldRepository for MyFieldRepo { /* ... */ }
/// # impl RankService for MyRankSvc { /* ... */ }
/// let svc = FlowServiceImpl::new(MyFlowRepo, MyStepRepo, MyFieldRepo, MyRankSvc);
/// ```
#[derive(Clone)]
pub struct FlowServiceImpl<FR, SR, FDR, RS> {
    flow_repo: FR,
    step_repo: SR,
    field_repo: FDR,
    rank_service: RS,
}

impl<FR, SR, FDR, RS> FlowServiceImpl<FR, SR, FDR, RS> {
    /// Construct a new `FlowServiceImpl`.
    ///
    /// Parameters:
    /// - `flow_repo`: repository handling `Flow` persistence.
    /// - `step_repo`: repository handling `Step` persistence.
    /// - `field_repo`: repository handling `Field` persistence.
    /// - `rank_service`: service used to compute lexicographic ranks.
    ///
    /// The returned value implements `FlowService`, `StepService` and `FieldService`
    /// as long as the repository/service types implement the corresponding traits.
    pub fn new(flow_repo: FR, step_repo: SR, field_repo: FDR, rank_service: RS) -> Self {
        Self {
            flow_repo,
            step_repo,
            field_repo,
            rank_service,
        }
    }
}

impl<FR, SR, FDR, RS> FlowService for FlowServiceImpl<FR, SR, FDR, RS>
where
    FR: FlowRepository + Send + Sync,
    SR: StepRepository + Send + Sync,
    FDR: FieldRepository + Send + Sync,
    RS: RankService + Send + Sync,
{
    async fn create_flow(&self, name: String) -> Result<Flow, DomainError> {
        let flow = Flow::new(name, String::new());
        self.flow_repo.create_flow(flow).await
    }

    async fn get_flow(&self, id: FlowId) -> Result<Flow, DomainError> {
        self.flow_repo.get_flow(id).await
    }

    async fn list_flows(&self) -> Result<Vec<Flow>, DomainError> {
        self.flow_repo.list_flows().await
    }

    async fn update_flow_metadata(
        &self,
        id: FlowId,
        name: Option<String>,
        description: Option<String>,
    ) -> Result<Flow, DomainError> {
        self.flow_repo.update_flow(id, name, description).await
    }

    async fn delete_flow(&self, id: FlowId) -> Result<(), DomainError> {
        self.flow_repo.delete_flow(id).await
    }
}

impl<FR, SR, FDR, RS> StepService for FlowServiceImpl<FR, SR, FDR, RS>
where
    FR: FlowRepository + Send + Sync,
    SR: StepRepository + Send + Sync,
    FDR: FieldRepository + Send + Sync,
    RS: RankService + Send + Sync,
{
    async fn add_step(&self, flow_id: FlowId, title: String) -> Result<Step, DomainError> {
        let flow = self.flow_repo.get_flow(flow_id).await?;

        let next_rank = match flow.steps.get(flow.steps.len().saturating_sub(1)) {
            Some(last_step) => self.rank_service.after(&Rank::from_string(last_step.rank.clone())),
            None => self.rank_service.initial(),
        };

        let step = Step::new(title, String::new(), next_rank.as_str().to_string());
        self.step_repo.create_step(flow_id, step).await
    }

    async fn remove_step(&self, step_id: StepId) -> Result<(), DomainError> {
        self.step_repo.delete_step(step_id).await
    }

    async fn reorder_step(
        &self,
        step_id: StepId,
        after_id: Option<StepId>,
        before_id: Option<StepId>,
    ) -> Result<Flow, DomainError> {
        let after_rank = if let Some(id) = after_id {
            Some(self.step_repo.get_step(id).await?.rank)
        } else {
            None
        };
        let before_rank = if let Some(id) = before_id {
            Some(self.step_repo.get_step(id).await?.rank)
        } else {
            None
        };

        let new_rank = match (after_rank, before_rank) {
            (Some(a), Some(b)) => {
                self.rank_service.between(&Rank::from_string(a), &Rank::from_string(b))
            }
            (Some(a), None) => self.rank_service.after(&Rank::from_string(a)),
            (None, Some(b)) => self.rank_service.before(&Rank::from_string(b)),
            (None, None) => self.rank_service.initial(),
        };

        self.step_repo
            .update_step(step_id, None, None, Some(new_rank.as_str().to_string()))
            .await?;

        let flows = self.flow_repo.list_flows().await?;
        flows
            .into_iter()
            .find(|f| f.get_step(&step_id).is_some())
            .ok_or_else(|| DomainError::not_found("Flow containing step", format!("{:?}", step_id)))
    }

    async fn update_step_metadata(
        &self,
        step_id: StepId,
        title: Option<String>,
        description: Option<String>,
    ) -> Result<Step, DomainError> {
        self.step_repo.update_step(step_id, title, description, None).await
    }
}

impl<FR, SR, FDR, RS> FieldService for FlowServiceImpl<FR, SR, FDR, RS>
where
    FR: FlowRepository + Send + Sync,
    SR: StepRepository + Send + Sync,
    FDR: FieldRepository + Send + Sync,
    RS: RankService + Send + Sync,
{
    async fn add_field(
        &self,
        step_id: StepId,
        label: String,
        key: String,
        config: FieldConfig,
    ) -> Result<Field, DomainError> {
        let step = self.step_repo.get_step(step_id).await?;

        let next_rank = match step.fields.get(step.fields.len().saturating_sub(1)) {
            Some(last_field) => self.rank_service.after(&Rank::from_string(last_field.rank.clone())),
            None => self.rank_service.initial(),
        };

        let field = Field::new(
            key,
            label,
            String::new(),
            next_rank.as_str().to_string(),
            config,
        );

        self.field_repo.create_field(step_id, field).await
    }

    async fn update_field_config(
        &self,
        field_id: FieldId,
        label: Option<String>,
        config: Option<FieldConfig>,
    ) -> Result<Field, DomainError> {
        self.field_repo
            .update_field(field_id, None, label, None, config)
            .await
    }

    async fn remove_field(&self, field_id: FieldId) -> Result<(), DomainError> {
        self.field_repo.delete_field(field_id).await
    }

    async fn move_field(
        &self,
        field_id: FieldId,
        target_step_id: Option<StepId>,
        after_id: Option<FieldId>,
        before_id: Option<FieldId>,
    ) -> Result<Flow, DomainError> {
        let flows = self.flow_repo.list_flows().await?;
        let mut found: Option<(Flow, StepId, Field)> = None;
        for f in flows.into_iter() {
            for s in f.steps.iter() {
                if let Some(field) = s.get_field(&field_id) {
                    found = Some((f.clone(), s.id, field.clone()));
                    break;
                }
            }
            if found.is_some() {
                break;
            }
        }

        let (flow, source_step_id, field) =
            found.ok_or_else(|| DomainError::not_found("Field", format!("{:?}", field_id)))?;

        let target_step = target_step_id.unwrap_or(source_step_id);

        let find_field_rank = |fid: FieldId| -> Option<String> {
            for s in flow.steps.iter() {
                if let Some(fld) = s.get_field(&fid) {
                    return Some(fld.rank.clone());
                }
            }
            None
        };

        let after_rank = after_id.and_then(find_field_rank);
        let before_rank = before_id.and_then(find_field_rank);

        let new_rank = match (after_rank, before_rank) {
            (Some(a), Some(b)) => {
                self.rank_service.between(&Rank::from_string(a), &Rank::from_string(b))
            }
            (Some(a), None) => self.rank_service.after(&Rank::from_string(a)),
            (None, Some(b)) => self.rank_service.before(&Rank::from_string(b)),
            (None, None) => {
                if let Ok(ts) = self.step_repo.get_step(target_step).await {
                    if let Some(last) = ts.fields.get(ts.fields.len().saturating_sub(1)) {
                        self.rank_service.after(&Rank::from_string(last.rank.clone()))
                    } else {
                        self.rank_service.initial()
                    }
                } else {
                    self.rank_service.initial()
                }
            }
        };

        self.field_repo.delete_field(field_id).await?;

        let new_field = Field::with_id(
            field.id,
            field.key,
            field.label,
            field.description,
            new_rank.as_str().to_string(),
            field.config,
        );

        self.field_repo.create_field(target_step, new_field).await?;

        self.flow_repo.get_flow(flow.id).await
    }

    async fn search_flow_fields(
        &self,
        flow_id: FlowId,
        query: Option<String>,
    ) -> Result<Vec<Field>, DomainError> {
        self.field_repo.get_flow_fields(flow_id, query).await
    }
}
