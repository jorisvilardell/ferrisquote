use std::collections::{HashMap, HashSet, VecDeque};

use crate::domain::{
    error::DomainError,
    estimator::{
        entities::estimator::Estimator,
        ports::EstimatorRepository,
        services::{evaluate_estimator_with_cross, extract_expr_refs, ExprRef},
    },
    flows::{
        entities::{
            binding::{AggregationStrategy, EstimatorBinding, InputBindingValue},
            flow::Flow,
            id::{BindingId, FieldId, FlowId, StepId},
        },
        ports::FlowRepository,
    },
    submission::entities::{FieldValue, Submission},
};

use super::{
    ports::{FlowEvaluationResult, FlowEvaluationService, FlowPreviewResult},
    random::generate_random_submission,
};

#[derive(Clone)]
pub struct FlowEvaluationServiceImpl<FR, ER> {
    flow_repo: FR,
    estimator_repo: ER,
}

impl<FR, ER> FlowEvaluationServiceImpl<FR, ER> {
    pub fn new(flow_repo: FR, estimator_repo: ER) -> Self {
        Self { flow_repo, estimator_repo }
    }
}

impl<FR, ER> FlowEvaluationService for FlowEvaluationServiceImpl<FR, ER>
where
    FR: FlowRepository + Send + Sync,
    ER: EstimatorRepository + Send + Sync,
{
    async fn evaluate_flow_bindings(
        &self,
        flow_id: FlowId,
        submission: Submission,
    ) -> Result<FlowEvaluationResult, DomainError> {
        let flow = self.flow_repo.get_flow(flow_id).await?;
        evaluate_bindings(&flow, &submission, &self.estimator_repo).await
    }

    async fn preview_flow(&self, flow_id: FlowId) -> Result<FlowPreviewResult, DomainError> {
        let flow = self.flow_repo.get_flow(flow_id).await?;
        let submission = generate_random_submission(&flow);
        let evaluation = evaluate_bindings(&flow, &submission, &self.estimator_repo).await?;
        Ok(FlowPreviewResult { submission, evaluation })
    }
}

// ============================================================================
// Core evaluator
// ============================================================================

/// Execute every binding of a flow in dependency order, accumulating each
/// binding's outputs into a shared context so later bindings can reference
/// earlier ones via `BindingOutput`. For bindings with `map_over_step`,
/// runs the estimator once per iteration in an isolated input context, then
/// reduces per-output results using `outputs_reduce_strategy`.
async fn evaluate_bindings<ER>(
    flow: &Flow,
    submission: &Submission,
    estimator_repo: &ER,
) -> Result<FlowEvaluationResult, DomainError>
where
    ER: EstimatorRepository + Send + Sync,
{
    // Fetch each estimator up-front so the topological sort can inspect
    // output expressions for cross-estimator refs (and the loop below can
    // reuse them without re-fetching).
    let mut estimators_by_binding: HashMap<BindingId, Estimator> = HashMap::new();
    for b in &flow.bindings {
        let est = estimator_repo.get_estimator(b.estimator_id).await?;
        estimators_by_binding.insert(b.id, est);
    }

    // estimator_id (string) → binding that produces its outputs. When two
    // bindings target the same estimator, first-in-flow wins — matches the
    // single-cross-context shape in `evaluate_flow_estimators`.
    let mut est_id_to_binding: HashMap<String, BindingId> = HashMap::new();
    for b in &flow.bindings {
        est_id_to_binding
            .entry(b.estimator_id.to_string())
            .or_insert(b.id);
    }

    let order = topological_sort_bindings(
        &flow.bindings,
        &estimators_by_binding,
        &est_id_to_binding,
    )?;

    // field_id → step_id lookup (so we know which iteration set to pull from)
    let field_step: HashMap<FieldId, StepId> = flow
        .steps
        .iter()
        .flat_map(|s| s.fields.iter().map(|f| (f.id, s.id)))
        .collect();

    let bindings_by_id: HashMap<BindingId, &EstimatorBinding> =
        flow.bindings.iter().map(|b| (b.id, b)).collect();

    let mut accumulator: HashMap<BindingId, HashMap<String, f64>> = HashMap::new();
    // Cross-estimator context keyed by (estimator_id_string, output_key).
    // Populated with the *reduced* outputs of each binding so downstream
    // output expressions can resolve `@#<id>.var` against it.
    let mut cross_ctx: HashMap<(String, String), f64> = HashMap::new();

    for binding_id in order {
        let binding = bindings_by_id[&binding_id];
        let estimator = &estimators_by_binding[&binding_id];

        let iteration_count = iteration_count_for(binding, submission);

        // Non-mapped bindings always run exactly once. Mapped bindings run
        // `iteration_count` times; if 0, we still produce an empty output
        // map (aggregations handle the empty case).
        let run_count = if binding.map_over_step.is_some() { iteration_count } else { 1 };

        let mut per_iteration_outputs: Vec<HashMap<String, f64>> =
            Vec::with_capacity(run_count);

        for iter_idx in 0..run_count {
            let inputs = resolve_inputs(
                binding,
                estimator,
                submission,
                &field_step,
                iter_idx,
                &accumulator,
            )?;
            let outputs = evaluate_estimator_with_cross(
                estimator,
                &inputs,
                &cross_ctx,
                true,
            )?;
            per_iteration_outputs.push(outputs);
        }

        let final_outputs = reduce_outputs(binding, estimator, &per_iteration_outputs);
        // Expose this binding's results in the cross-estimator context
        // before any downstream binding runs. Only the binding elected in
        // `est_id_to_binding` exposes its outputs, so later duplicates
        // don't clobber the first-in-flow winner.
        if est_id_to_binding.get(&estimator.id.to_string()) == Some(&binding.id) {
            let est_id_str = estimator.id.to_string();
            for (k, v) in &final_outputs {
                cross_ctx.insert((est_id_str.clone(), k.clone()), *v);
            }
        }
        accumulator.insert(binding.id, final_outputs);
    }

    let flat: HashMap<String, f64> = accumulator
        .iter()
        .flat_map(|(bid, outs)| {
            outs.iter()
                .map(move |(k, v)| (format!("{bid}.{k}"), *v))
        })
        .collect();

    Ok(FlowEvaluationResult { bindings: accumulator, flat })
}

fn iteration_count_for(binding: &EstimatorBinding, submission: &Submission) -> usize {
    match binding.map_over_step {
        Some(step_id) => submission
            .answers
            .get(&step_id)
            .map(|v| v.len())
            .unwrap_or(0),
        None => 1,
    }
}

/// Build the estimator input map for a single invocation (one iteration when
/// mapped, otherwise the sole run). Fields whose owning step is the mapped
/// step pull from the current iteration; all other fields pull from the
/// first iteration of their step (stable across the map loop).
fn resolve_inputs(
    binding: &EstimatorBinding,
    estimator: &Estimator,
    submission: &Submission,
    field_step: &HashMap<FieldId, StepId>,
    iter_idx: usize,
    accumulator: &HashMap<BindingId, HashMap<String, f64>>,
) -> Result<HashMap<String, f64>, DomainError> {
    let mut inputs: HashMap<String, f64> = HashMap::new();

    for (input_key, source) in &binding.inputs_mapping {
        // Fail fast if the binding references an input key the estimator no
        // longer declares — would otherwise silently feed a dead variable.
        if !estimator.inputs.iter().any(|i| &i.key == input_key) {
            return Err(DomainError::validation(format!(
                "Binding input '{input_key}' does not match any declared input on estimator '{}'",
                estimator.name
            )));
        }

        let value = match source {
            InputBindingValue::Constant { value } => coerce_to_number(value).ok_or_else(|| {
                DomainError::validation(format!(
                    "Binding input '{input_key}': constant value is not numeric"
                ))
            })?,
            InputBindingValue::Field { field_id } => {
                let step_id = field_step.get(field_id).ok_or_else(|| {
                    DomainError::validation(format!(
                        "Binding input '{input_key}': field '{field_id}' does not belong to this flow"
                    ))
                })?;
                // Use iter_idx only when this field lives on the mapped step.
                let target_idx = if binding.map_over_step == Some(*step_id) {
                    iter_idx
                } else {
                    0
                };
                let iteration = submission
                    .answers
                    .get(step_id)
                    .and_then(|iters| iters.get(target_idx))
                    .ok_or_else(|| {
                        DomainError::validation(format!(
                            "Binding input '{input_key}': no iteration {target_idx} for step '{step_id}'"
                        ))
                    })?;
                let fv = iteration.answers.get(field_id).ok_or_else(|| {
                    DomainError::validation(format!(
                        "Binding input '{input_key}': field '{field_id}' not answered in iteration {target_idx}"
                    ))
                })?;
                coerce_to_number(fv).ok_or_else(|| {
                    DomainError::validation(format!(
                        "Binding input '{input_key}': field answer is not numeric"
                    ))
                })?
            }
            InputBindingValue::BindingOutput { binding_id, output_key } => {
                let upstream = accumulator.get(binding_id).ok_or_else(|| {
                    DomainError::validation(format!(
                        "Binding input '{input_key}': upstream binding '{binding_id}' has not produced outputs (cycle or wrong order)"
                    ))
                })?;
                *upstream.get(output_key).ok_or_else(|| {
                    DomainError::validation(format!(
                        "Binding input '{input_key}': upstream binding does not expose output '{output_key}'"
                    ))
                })?
            }
        };

        inputs.insert(input_key.clone(), value);
    }

    Ok(inputs)
}

fn coerce_to_number(v: &FieldValue) -> Option<f64> {
    match v {
        FieldValue::Number(n) => Some(*n),
        FieldValue::Boolean(b) => Some(if *b { 1.0 } else { 0.0 }),
        FieldValue::Text(_) | FieldValue::Array(_) => None,
    }
}

fn reduce_outputs(
    binding: &EstimatorBinding,
    estimator: &Estimator,
    iterations: &[HashMap<String, f64>],
) -> HashMap<String, f64> {
    let mut out = HashMap::new();
    // Enumerate every declared output so a mapped binding with 0 iterations
    // still produces a well-defined (empty-reduced) result map.
    for output in &estimator.outputs {
        let key = output.key.clone();
        let values: Vec<f64> = iterations
            .iter()
            .filter_map(|m| m.get(&key).copied())
            .collect();

        // For non-mapped bindings we just take the single-iteration value
        // verbatim (no reduction needed).
        let strategy = binding
            .outputs_reduce_strategy
            .get(&key)
            .copied()
            .unwrap_or(AggregationStrategy::First);

        let reduced = if binding.map_over_step.is_some() {
            apply_strategy(strategy, &values)
        } else {
            values.first().copied().unwrap_or(0.0)
        };
        out.insert(key, reduced);
    }
    out
}

fn apply_strategy(strategy: AggregationStrategy, values: &[f64]) -> f64 {
    if values.is_empty() {
        return match strategy {
            AggregationStrategy::Count => 0.0,
            _ => 0.0,
        };
    }
    match strategy {
        AggregationStrategy::Sum => values.iter().sum(),
        AggregationStrategy::Average => values.iter().sum::<f64>() / values.len() as f64,
        AggregationStrategy::Max => values.iter().cloned().fold(f64::NEG_INFINITY, f64::max),
        AggregationStrategy::Min => values.iter().cloned().fold(f64::INFINITY, f64::min),
        AggregationStrategy::Count => values.len() as f64,
        AggregationStrategy::First => values[0],
        AggregationStrategy::Last => values[values.len() - 1],
    }
}

/// Topological sort bindings using Kahn's algorithm. Dependencies come from
/// `InputBindingValue::BindingOutput` refs — each such ref creates an edge
/// from the referenced binding to the referencing one. Unresolved refs (to
/// bindings not in the flow) are treated as no-ops here; the service-level
/// validation already rejects them on add/update.
fn topological_sort_bindings(
    bindings: &[EstimatorBinding],
    estimators_by_binding: &HashMap<BindingId, Estimator>,
    est_id_to_binding: &HashMap<String, BindingId>,
) -> Result<Vec<BindingId>, DomainError> {
    let known: HashSet<BindingId> = bindings.iter().map(|b| b.id).collect();

    let mut in_degree: HashMap<BindingId, usize> =
        bindings.iter().map(|b| (b.id, 0)).collect();
    let mut adj: HashMap<BindingId, Vec<BindingId>> =
        bindings.iter().map(|b| (b.id, Vec::new())).collect();

    for binding in bindings {
        let mut deps: HashSet<BindingId> = HashSet::new();
        for source in binding.inputs_mapping.values() {
            if let InputBindingValue::BindingOutput { binding_id, .. } = source {
                if known.contains(binding_id) && *binding_id != binding.id {
                    deps.insert(*binding_id);
                }
            }
        }
        // Output expressions can reference other estimators via `@#<id>.var`.
        // Each such ref implies this binding needs the producing binding to
        // run first. Without these edges the cross-context would be empty
        // at strict-resolve time and the eval would fail.
        if let Some(est) = estimators_by_binding.get(&binding.id) {
            for output in &est.outputs {
                for r in extract_expr_refs(&output.expression) {
                    if let ExprRef::Cross { estimator_id, .. } = r {
                        if let Some(&dep_binding) = est_id_to_binding.get(&estimator_id) {
                            if dep_binding != binding.id {
                                deps.insert(dep_binding);
                            }
                        }
                    }
                }
            }
        }
        for dep in deps {
            adj.entry(dep).or_default().push(binding.id);
            *in_degree.entry(binding.id).or_insert(0) += 1;
        }
    }

    let mut queue: VecDeque<BindingId> = in_degree
        .iter()
        .filter(|&(_, &deg)| deg == 0)
        .map(|(&id, _)| id)
        .collect();
    let mut order = Vec::with_capacity(bindings.len());
    while let Some(id) = queue.pop_front() {
        order.push(id);
        if let Some(children) = adj.get(&id) {
            for &child in children {
                let deg = in_degree.entry(child).or_insert(1);
                *deg -= 1;
                if *deg == 0 {
                    queue.push_back(child);
                }
            }
        }
    }

    if order.len() != bindings.len() {
        return Err(DomainError::validation(
            "Cyclical dependency detected between flow bindings",
        ));
    }

    Ok(order)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{
        estimator::entities::{
            estimator::Estimator as Est,
            id::{EstimatorId, EstimatorInputId, EstimatorOutputId},
            output::EstimatorOutput,
            parameter::{EstimatorParameter, EstimatorParameterType},
        },
        flows::entities::{
            binding::{AggregationStrategy, EstimatorBinding, InputBindingValue},
            field::{Field, FieldConfig},
            flow::Flow,
            id::{BindingId, FlowId, StepId},
            step::Step,
        },
        submission::entities::{FieldValue, StepIteration, Submission},
        user::entities::UserId,
    };

    fn num_input(key: &str) -> EstimatorParameter {
        EstimatorParameter::new(
            key.to_string(),
            String::new(),
            EstimatorParameterType::Number,
        )
    }

    fn output(key: &str, expr: &str) -> EstimatorOutput {
        EstimatorOutput::new(key.to_string(), expr.to_string(), String::new())
    }

    fn number_field(key: &str) -> Field {
        Field::new(
            key.to_string(),
            "label".into(),
            String::new(),
            "a".into(),
            FieldConfig::new_number(None, None),
        )
    }

    fn mk_step(title: &str, fields: Vec<Field>, repeatable: bool) -> Step {
        Step::with_fields(
            StepId::new(),
            title.into(),
            String::new(),
            "a".into(),
            repeatable,
            None,
            1,
            None,
            fields,
        )
    }

    /// A thin in-memory EstimatorRepository stub for the evaluator tests.
    #[derive(Clone)]
    struct StubEstRepo {
        estimators: HashMap<EstimatorId, Est>,
    }

    impl crate::domain::estimator::ports::EstimatorRepository for StubEstRepo {
        async fn create_estimator(&self, _: Est) -> Result<Est, DomainError> { unimplemented!() }
        async fn get_estimator(&self, id: EstimatorId) -> Result<Est, DomainError> {
            self.estimators.get(&id).cloned().ok_or_else(|| DomainError::not_found("Estimator", id.to_string()))
        }
        async fn list_estimators_for_flow(&self, _: FlowId) -> Result<Vec<Est>, DomainError> { Ok(vec![]) }
        async fn update_estimator(&self, _: EstimatorId, _: Option<String>, _: Option<String>) -> Result<Est, DomainError> { unimplemented!() }
        async fn delete_estimator(&self, _: EstimatorId) -> Result<(), DomainError> { unimplemented!() }
        async fn add_input(&self, _: EstimatorId, _: EstimatorParameter) -> Result<EstimatorParameter, DomainError> { unimplemented!() }
        async fn update_input(&self, _: EstimatorId, _: EstimatorInputId, _: Option<String>, _: Option<String>, _: Option<EstimatorParameterType>) -> Result<EstimatorParameter, DomainError> { unimplemented!() }
        async fn remove_input(&self, _: EstimatorId, _: EstimatorInputId) -> Result<(), DomainError> { unimplemented!() }
        async fn add_output(&self, _: EstimatorId, _: EstimatorOutput) -> Result<EstimatorOutput, DomainError> { unimplemented!() }
        async fn update_output(&self, _: EstimatorId, _: EstimatorOutputId, _: Option<String>, _: Option<String>, _: Option<String>) -> Result<EstimatorOutput, DomainError> { unimplemented!() }
        async fn remove_output(&self, _: EstimatorId, _: EstimatorOutputId) -> Result<(), DomainError> { unimplemented!() }
    }

    #[tokio::test]
    async fn map_reduce_sum_over_repeatable_step() {
        // Step "Pieces" repeatable with fields: surface, unit_price
        let surface = number_field("surface");
        let unit_price = number_field("unit_price");
        let surface_id = surface.id;
        let unit_price_id = unit_price.id;
        let step = mk_step("Pieces", vec![surface, unit_price], true);
        let step_id = step.id;

        // Estimator with 2 inputs + 1 output = surface * unit_price
        let in_surf = num_input("surface");
        let in_price = num_input("unit_price");
        let in_surf_id = in_surf.id;
        let in_price_id = in_price.id;
        let out_total = output("total", "@surface * @unit_price");
        let est = Est::with_full(
            EstimatorId::new(),
            FlowId::new(),
            "RoomCost".into(),
            String::new(),
            vec![in_surf, in_price],
            vec![out_total],
        );
        let est_id = est.id;
        let _ = (in_surf_id, in_price_id);

        // Binding with map_over_step + Sum reduce for `total`
        let mut inputs_mapping = HashMap::new();
        inputs_mapping.insert(
            "surface".to_string(),
            InputBindingValue::Field { field_id: surface_id },
        );
        inputs_mapping.insert(
            "unit_price".to_string(),
            InputBindingValue::Field { field_id: unit_price_id },
        );
        let mut reduce = HashMap::new();
        reduce.insert("total".to_string(), AggregationStrategy::Sum);

        let binding = EstimatorBinding::new(est_id, inputs_mapping, Some(step_id), reduce);
        let binding_id = binding.id;
        let flow = Flow::with_full(
            FlowId::new(),
            "F".into(),
            String::new(),
            vec![step],
            vec![binding],
        );

        // Submission: 3 rooms — (10,5), (20,5), (30,5) → 50 + 100 + 150 = 300
        let iter = |s: f64, p: f64| {
            let mut m = HashMap::new();
            m.insert(surface_id, FieldValue::Number(s));
            m.insert(unit_price_id, FieldValue::Number(p));
            StepIteration::new(m)
        };
        let mut answers = HashMap::new();
        answers.insert(
            step_id,
            vec![iter(10.0, 5.0), iter(20.0, 5.0), iter(30.0, 5.0)],
        );
        let sub = Submission::new(flow.id, UserId::new(), answers);

        let mut estimators = HashMap::new();
        estimators.insert(est_id, est);
        let repo = StubEstRepo { estimators };

        let res = evaluate_bindings(&flow, &sub, &repo).await.unwrap();
        let b = res.bindings.get(&binding_id).unwrap();
        assert_eq!(b["total"], 300.0);
    }

    #[tokio::test]
    async fn chain_binding_b_reads_binding_a_output() {
        // Binding A: no map, constant input, produces `value = input * 10`
        // Binding B: reads A.value, produces `double = v * 2`
        let in_a = num_input("qty");
        let in_a_id = in_a.id;
        let out_a = output("value", "@qty * 10.0");
        let est_a = Est::with_full(
            EstimatorId::new(),
            FlowId::new(),
            "A".into(),
            String::new(),
            vec![in_a],
            vec![out_a],
        );
        let est_a_id = est_a.id;

        let in_b = num_input("v");
        let in_b_id = in_b.id;
        let out_b = output("double", "@v * 2.0");
        let est_b = Est::with_full(
            EstimatorId::new(),
            FlowId::new(),
            "B".into(),
            String::new(),
            vec![in_b],
            vec![out_b],
        );
        let est_b_id = est_b.id;
        let _ = (in_a_id, in_b_id);

        // Binding A: qty = constant 3 → output value = 30
        let mut a_inputs = HashMap::new();
        a_inputs.insert(
            "qty".to_string(),
            InputBindingValue::Constant { value: FieldValue::Number(3.0) },
        );
        let binding_a = EstimatorBinding::new(est_a_id, a_inputs, None, HashMap::new());
        let binding_a_id = binding_a.id;

        // Binding B: v = BindingOutput(A.value) → output double = 60
        let mut b_inputs = HashMap::new();
        b_inputs.insert(
            "v".to_string(),
            InputBindingValue::BindingOutput {
                binding_id: binding_a_id,
                output_key: "value".to_string(),
            },
        );
        let binding_b = EstimatorBinding::new(est_b_id, b_inputs, None, HashMap::new());
        let binding_b_id = binding_b.id;

        let flow = Flow::with_full(
            FlowId::new(),
            "F".into(),
            String::new(),
            vec![],
            vec![binding_b, binding_a], // deliberately out of order
        );

        let sub = Submission::new(flow.id, UserId::new(), HashMap::new());

        let mut estimators = HashMap::new();
        estimators.insert(est_a_id, est_a);
        estimators.insert(est_b_id, est_b);
        let repo = StubEstRepo { estimators };

        let res = evaluate_bindings(&flow, &sub, &repo).await.unwrap();
        assert_eq!(res.bindings[&binding_a_id]["value"], 30.0);
        assert_eq!(res.bindings[&binding_b_id]["double"], 60.0);
    }

    #[tokio::test]
    async fn cycle_between_bindings_rejected() {
        let in_a = num_input("v");
        let out_a = output("x", "@v");
        let est = Est::with_full(
            EstimatorId::new(),
            FlowId::new(),
            "E".into(),
            String::new(),
            vec![in_a],
            vec![out_a],
        );
        let est_id = est.id;

        // Two bindings that feed each other (A ← B, B ← A)
        let a_id = BindingId::new();
        let b_id = BindingId::new();
        let mut a_map = HashMap::new();
        a_map.insert(
            "v".to_string(),
            InputBindingValue::BindingOutput { binding_id: b_id, output_key: "x".into() },
        );
        let mut b_map = HashMap::new();
        b_map.insert(
            "v".to_string(),
            InputBindingValue::BindingOutput { binding_id: a_id, output_key: "x".into() },
        );
        let binding_a = EstimatorBinding::with_id(a_id, est_id, a_map, None, HashMap::new());
        let binding_b = EstimatorBinding::with_id(b_id, est_id, b_map, None, HashMap::new());

        let flow = Flow::with_full(
            FlowId::new(),
            "F".into(),
            String::new(),
            vec![],
            vec![binding_a, binding_b],
        );
        let sub = Submission::new(flow.id, UserId::new(), HashMap::new());

        let mut estimators = HashMap::new();
        estimators.insert(est_id, est);
        let repo = StubEstRepo { estimators };

        let err = evaluate_bindings(&flow, &sub, &repo).await.unwrap_err();
        assert!(matches!(err, DomainError::ValidationError { .. }));
    }

    #[tokio::test]
    async fn cross_estimator_ref_in_output_resolves_across_bindings() {
        // Regression: an output expression on binding B that references
        // `@#<A_id>.out` must see A's reduced output, not silently 0.0.
        let in_a = num_input("qty");
        let out_a = output("total", "@qty * 10.0");
        let est_a = Est::with_full(
            EstimatorId::new(),
            FlowId::new(),
            "A".into(),
            String::new(),
            vec![in_a],
            vec![out_a],
        );
        let est_a_id = est_a.id;

        let in_b = num_input("placeholder");
        // Expression pulls from est_a via cross-ref; no flow-field input used.
        let cross_expr = format!("@#{}.total * 1.20", est_a_id);
        let out_b = output("scaled", &cross_expr);
        let est_b = Est::with_full(
            EstimatorId::new(),
            FlowId::new(),
            "B".into(),
            String::new(),
            vec![in_b],
            vec![out_b],
        );
        let est_b_id = est_b.id;

        let mut a_inputs = HashMap::new();
        a_inputs.insert(
            "qty".to_string(),
            InputBindingValue::Constant { value: FieldValue::Number(7.0) },
        );
        let binding_a = EstimatorBinding::new(est_a_id, a_inputs, None, HashMap::new());
        let binding_a_id = binding_a.id;

        let mut b_inputs = HashMap::new();
        b_inputs.insert(
            "placeholder".to_string(),
            InputBindingValue::Constant { value: FieldValue::Number(0.0) },
        );
        let binding_b = EstimatorBinding::new(est_b_id, b_inputs, None, HashMap::new());
        let binding_b_id = binding_b.id;

        let flow = Flow::with_full(
            FlowId::new(),
            "F".into(),
            String::new(),
            vec![],
            // B listed first so topo sort must detect the cross-ref dep.
            vec![binding_b, binding_a],
        );
        let sub = Submission::new(flow.id, UserId::new(), HashMap::new());

        let mut estimators = HashMap::new();
        estimators.insert(est_a_id, est_a);
        estimators.insert(est_b_id, est_b);
        let repo = StubEstRepo { estimators };

        let res = evaluate_bindings(&flow, &sub, &repo).await.unwrap();
        assert_eq!(res.bindings[&binding_a_id]["total"], 70.0);
        assert!((res.bindings[&binding_b_id]["scaled"] - 84.0).abs() < 1e-9);
    }

    #[tokio::test]
    async fn reduce_max_picks_largest() {
        let surface = number_field("surface");
        let surface_id = surface.id;
        let step = mk_step("Rooms", vec![surface], true);
        let step_id = step.id;

        let in_s = num_input("s");
        let out = output("biggest", "@s");
        let est = Est::with_full(
            EstimatorId::new(),
            FlowId::new(),
            "R".into(),
            String::new(),
            vec![in_s],
            vec![out],
        );
        let est_id = est.id;

        let mut map = HashMap::new();
        map.insert(
            "s".to_string(),
            InputBindingValue::Field { field_id: surface_id },
        );
        let mut reduce = HashMap::new();
        reduce.insert("biggest".to_string(), AggregationStrategy::Max);
        let binding = EstimatorBinding::new(est_id, map, Some(step_id), reduce);
        let binding_id = binding.id;

        let flow = Flow::with_full(
            FlowId::new(),
            "F".into(),
            String::new(),
            vec![step],
            vec![binding],
        );

        let iter = |s: f64| {
            let mut m = HashMap::new();
            m.insert(surface_id, FieldValue::Number(s));
            StepIteration::new(m)
        };
        let mut answers = HashMap::new();
        answers.insert(step_id, vec![iter(5.0), iter(42.0), iter(10.0)]);
        let sub = Submission::new(flow.id, UserId::new(), answers);

        let mut estimators = HashMap::new();
        estimators.insert(est_id, est);
        let repo = StubEstRepo { estimators };

        let res = evaluate_bindings(&flow, &sub, &repo).await.unwrap();
        assert_eq!(res.bindings[&binding_id]["biggest"], 42.0);
    }
}
