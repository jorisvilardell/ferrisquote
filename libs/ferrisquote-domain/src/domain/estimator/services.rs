use std::collections::{HashMap, HashSet, VecDeque};

use crate::domain::{error::DomainError, flows::entities::ids::FlowId};

use super::{
    entities::{
        estimator::Estimator,
        ids::{EstimatorId, EstimatorVariableId},
        submission::SubmissionData,
        variable::EstimatorVariable,
    },
    ports::{EstimatorRepository, EstimatorService},
};

#[derive(Clone)]
pub struct EstimatorServiceImpl<ER> {
    repo: ER,
}

impl<ER> EstimatorServiceImpl<ER> {
    pub fn new(repo: ER) -> Self {
        Self { repo }
    }
}

impl<ER> EstimatorService for EstimatorServiceImpl<ER>
where
    ER: EstimatorRepository + Send + Sync,
{
    async fn create_estimator(
        &self,
        flow_id: FlowId,
        name: String,
    ) -> Result<Estimator, DomainError> {
        let estimator = Estimator::new(flow_id, name);
        self.repo.create_estimator(estimator).await
    }

    async fn get_estimator(&self, id: EstimatorId) -> Result<Estimator, DomainError> {
        self.repo.get_estimator(id).await
    }

    async fn list_estimators_for_flow(
        &self,
        flow_id: FlowId,
    ) -> Result<Vec<Estimator>, DomainError> {
        self.repo.list_estimators_for_flow(flow_id).await
    }

    async fn update_estimator(
        &self,
        id: EstimatorId,
        name: Option<String>,
    ) -> Result<Estimator, DomainError> {
        self.repo.update_estimator(id, name).await
    }

    async fn delete_estimator(&self, id: EstimatorId) -> Result<(), DomainError> {
        self.repo.delete_estimator(id).await
    }

    async fn add_variable(
        &self,
        estimator_id: EstimatorId,
        name: String,
        expression: String,
        description: String,
    ) -> Result<EstimatorVariable, DomainError> {
        let variable = EstimatorVariable::new(name, expression, description);
        self.repo.add_variable(estimator_id, variable).await
    }

    async fn update_variable(
        &self,
        id: EstimatorVariableId,
        name: Option<String>,
        expression: Option<String>,
        description: Option<String>,
    ) -> Result<EstimatorVariable, DomainError> {
        self.repo.update_variable(id, name, expression, description).await
    }

    async fn remove_variable(&self, id: EstimatorVariableId) -> Result<(), DomainError> {
        self.repo.remove_variable(id).await
    }

    async fn evaluate(
        &self,
        estimator_id: EstimatorId,
        field_values: HashMap<String, f64>,
    ) -> Result<HashMap<String, f64>, DomainError> {
        let estimator = self.repo.get_estimator(estimator_id).await?;
        evaluate_estimator(&estimator, &field_values)
    }

    async fn evaluate_submission(
        &self,
        estimator_id: EstimatorId,
        data: SubmissionData,
    ) -> Result<HashMap<String, f64>, DomainError> {
        let estimator = self.repo.get_estimator(estimator_id).await?;
        evaluate_estimator_with_submission(&estimator, &data)
    }

    async fn evaluate_flow(
        &self,
        flow_id: FlowId,
        data: SubmissionData,
    ) -> Result<HashMap<String, HashMap<String, f64>>, DomainError> {
        let estimators = self.repo.list_estimators_for_flow(flow_id).await?;
        evaluate_flow_estimators(&estimators, &data)
    }
}

// ============================================================================
// Expression evaluation (pure, no I/O)
// ============================================================================

/// Evaluate all variables of an estimator in dependency order, in
/// **preview mode**. Cross-estimator references silently default to `0.0`
/// since this entry point has no way to provide stubs — use
/// [`evaluate_estimator_with_submission`] if you need to inject
/// `cross_values` stubs.
pub fn evaluate_estimator(
    estimator: &Estimator,
    field_values: &HashMap<String, f64>,
) -> Result<HashMap<String, f64>, DomainError> {
    let order = topological_sort(&estimator.variables)?;

    use evalexpr::ContextWithMutableVariables;
    let mut ctx = evalexpr::HashMapContext::<evalexpr::DefaultNumericTypes>::new();
    for (key, &value) in field_values {
        ctx.set_value(key.clone(), evalexpr::Value::Float(value))
            .map_err(|e| DomainError::internal(e.to_string()))?;
    }

    let var_by_id: HashMap<EstimatorVariableId, &EstimatorVariable> =
        estimator.variables.iter().map(|v| (v.id, v)).collect();

    let empty_cross: HashMap<(String, String), f64> = HashMap::new();
    let mut results = HashMap::new();

    for id in order {
        let var = var_by_id[&id];
        // Preview mode: missing cross-refs default to 0.0
        let expr = resolve_cross_refs(&var.expression, &empty_cross, false)?;
        let expr = prepare_expression(&expr);

        let value = evalexpr::eval_float_with_context(&expr, &ctx).map_err(|e| {
            DomainError::validation(format!(
                "Failed to evaluate variable '{}': {}",
                var.name, e
            ))
        })?;

        ctx.set_value(var.name.clone(), evalexpr::Value::Float(value))
            .map_err(|e| DomainError::internal(e.to_string()))?;

        results.insert(var.name.clone(), value);
    }

    Ok(results)
}

/// Evaluate an estimator with full submission data, in **preview mode**:
/// cross-estimator references are resolved from `data.cross_values` when
/// present, and silently default to `0.0` otherwise. Useful for evaluating
/// a single estimator during editing without loading the whole flow.
pub fn evaluate_estimator_with_submission(
    estimator: &Estimator,
    data: &SubmissionData,
) -> Result<HashMap<String, f64>, DomainError> {
    let order = topological_sort(&estimator.variables)?;

    use evalexpr::ContextWithMutableVariables;
    let mut ctx = evalexpr::HashMapContext::<evalexpr::DefaultNumericTypes>::new();

    for (key, &value) in &data.field_values {
        ctx.set_value(key.clone(), evalexpr::Value::Float(value))
            .map_err(|e| DomainError::internal(e.to_string()))?;
    }

    // Build the cross-ref resolver map from SubmissionData.cross_values
    let cross_resolved = flatten_cross_values(&data.cross_values);

    let var_by_id: HashMap<EstimatorVariableId, &EstimatorVariable> =
        estimator.variables.iter().map(|v| (v.id, v)).collect();

    let mut results = HashMap::new();

    for id in order {
        let var = var_by_id[&id];
        // Preview mode: lenient cross-ref resolution (missing refs → 0.0)
        let expr = resolve_cross_refs(&var.expression, &cross_resolved, false)?;
        let expr = resolve_aggregations(&expr, data)?;
        let expr = prepare_expression(&expr);

        let value = evalexpr::eval_float_with_context(&expr, &ctx).map_err(|e| {
            DomainError::validation(format!(
                "Failed to evaluate variable '{}': {}",
                var.name, e
            ))
        })?;

        ctx.set_value(var.name.clone(), evalexpr::Value::Float(value))
            .map_err(|e| DomainError::internal(e.to_string()))?;

        results.insert(var.name.clone(), value);
    }

    Ok(results)
}

/// Flatten a `HashMap<String, HashMap<String, f64>>` into a
/// `HashMap<(String, String), f64>` for quick lookup.
fn flatten_cross_values(
    nested: &HashMap<String, HashMap<String, f64>>,
) -> HashMap<(String, String), f64> {
    let mut out = HashMap::new();
    for (est_name, vars) in nested {
        for (var_name, &value) in vars {
            out.insert((est_name.clone(), var_name.clone()), value);
        }
    }
    out
}

fn resolve_aggregations(expr: &str, data: &SubmissionData) -> Result<String, DomainError> {
    let mut result = expr.to_string();

    while let Some(pos) = find_aggregation(&result) {
        let (func_name, arg, start, end) = pos;
        let replacement = match func_name.as_str() {
            "SUM" => {
                let values = data
                    .iteration_values
                    .get(&arg)
                    .ok_or_else(|| {
                        DomainError::validation(format!(
                            "SUM references unknown repeatable field '{arg}'"
                        ))
                    })?;
                values.iter().sum::<f64>()
            }
            "AVG" => {
                let values = data
                    .iteration_values
                    .get(&arg)
                    .ok_or_else(|| {
                        DomainError::validation(format!(
                            "AVG references unknown repeatable field '{arg}'"
                        ))
                    })?;
                if values.is_empty() {
                    0.0
                } else {
                    values.iter().sum::<f64>() / values.len() as f64
                }
            }
            "COUNT_ITER" => {
                let count = data
                    .iteration_counts
                    .get(&arg)
                    .ok_or_else(|| {
                        DomainError::validation(format!(
                            "COUNT_ITER references unknown step '{arg}'"
                        ))
                    })?;
                *count as f64
            }
            _ => {
                return Err(DomainError::validation(format!(
                    "Unknown aggregation function '{func_name}'"
                )));
            }
        };
        let formatted = format_float(replacement);
        result = format!("{}{formatted}{}", &result[..start], &result[end..]);
    }

    Ok(result)
}

fn format_float(v: f64) -> String {
    let s = v.to_string();
    if s.contains('.') { s } else { format!("{s}.0") }
}

fn find_aggregation(expr: &str) -> Option<(String, String, usize, usize)> {
    for func in &["SUM", "AVG", "COUNT_ITER"] {
        if let Some(start) = expr.find(&format!("{func}(")) {
            let after_paren = start + func.len() + 1;
            if let Some(close) = expr[after_paren..].find(')') {
                let end = after_paren + close + 1;
                let inner = expr[after_paren..after_paren + close].trim();
                let arg = inner.strip_prefix('@').unwrap_or(inner).to_string();
                return Some((func.to_string(), arg, start, end));
            }
        }
    }
    None
}

/// Strip `@` prefixes so `@surface * @prix` becomes `surface * prix`,
/// which is the syntax evalexpr expects.
///
/// Cross-estimator refs (`@Name.var`) should already have been resolved to
/// numeric literals by `resolve_cross_refs` before this is called.
fn prepare_expression(expr: &str) -> String {
    let chars: Vec<char> = expr.chars().collect();
    let mut result = String::with_capacity(expr.len());
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '@' {
            // skip the @ — the identifier that follows is kept as-is
            i += 1;
        } else {
            result.push(chars[i]);
            i += 1;
        }
    }
    result
}

/// A parsed reference found in an expression.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum ExprRef {
    /// Bare identifier: `@field_key` or `@variable_name`.
    /// Used for field lookups and intra-estimator variable dependencies.
    Bare(String),
    /// Cross-estimator reference: `@EstimatorName.variable_name`.
    Cross {
        estimator: String,
        variable: String,
    },
}

/// Extract all `@...` references from an expression, distinguishing bare
/// references from cross-estimator ones (`@Name.var`).
pub fn extract_expr_refs(expr: &str) -> Vec<ExprRef> {
    let chars: Vec<char> = expr.chars().collect();
    let mut refs = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '@' {
            i += 1;
            let name_start = i;
            while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            if i == name_start {
                continue;
            }
            let first_part: String = chars[name_start..i].iter().collect();

            // Check for dot → cross-estimator ref
            if i < chars.len() && chars[i] == '.' {
                i += 1;
                let var_start = i;
                while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                    i += 1;
                }
                if i > var_start {
                    let variable: String = chars[var_start..i].iter().collect();
                    refs.push(ExprRef::Cross {
                        estimator: first_part,
                        variable,
                    });
                    continue;
                }
            }

            refs.push(ExprRef::Bare(first_part));
        } else {
            i += 1;
        }
    }
    refs
}

/// Legacy helper used by the intra-estimator topological sort: returns only
/// bare `@name` references (ignores cross-estimator refs).
fn extract_bare_references(expr: &str) -> Vec<String> {
    extract_expr_refs(expr)
        .into_iter()
        .filter_map(|r| match r {
            ExprRef::Bare(name) => Some(name),
            ExprRef::Cross { .. } => None,
        })
        .collect()
}

/// Topological sort of variables using Kahn's algorithm.
///
/// Returns variable IDs in evaluation order (dependencies first).
/// Returns `DomainError::ValidationError` if a circular dependency is detected.
fn topological_sort(
    variables: &[EstimatorVariable],
) -> Result<Vec<EstimatorVariableId>, DomainError> {
    let name_to_id: HashMap<&str, EstimatorVariableId> =
        variables.iter().map(|v| (v.name.as_str(), v.id)).collect();

    // in_degree[id] = number of variable dependencies not yet resolved
    let mut in_degree: HashMap<EstimatorVariableId, usize> =
        variables.iter().map(|v| (v.id, 0)).collect();

    // adj[id] = list of variables that have `id` as a dependency
    let mut adj: HashMap<EstimatorVariableId, Vec<EstimatorVariableId>> =
        variables.iter().map(|v| (v.id, Vec::new())).collect();

    for var in variables {
        let refs = extract_bare_references(&var.expression);
        // Deduplicate references to the same variable
        let unique_deps: HashSet<EstimatorVariableId> = refs
            .iter()
            .filter_map(|name| name_to_id.get(name.as_str()).copied())
            .collect();

        for dep_id in unique_deps {
            adj.entry(dep_id).or_default().push(var.id);
            *in_degree.entry(var.id).or_insert(0) += 1;
        }
    }

    // Seed the queue with nodes that have no variable dependencies
    let mut queue: VecDeque<EstimatorVariableId> = in_degree
        .iter()
        .filter(|&(_, &deg)| deg == 0)
        .map(|(&id, _)| id)
        .collect();

    let mut order = Vec::with_capacity(variables.len());

    while let Some(id) = queue.pop_front() {
        order.push(id);
        if let Some(dependents) = adj.get(&id) {
            for &dep in dependents {
                let deg = in_degree.entry(dep).or_insert(1);
                *deg -= 1;
                if *deg == 0 {
                    queue.push_back(dep);
                }
            }
        }
    }

    if order.len() != variables.len() {
        return Err(DomainError::validation(
            "Circular dependency detected in estimator variables",
        ));
    }

    Ok(order)
}

// ============================================================================
// Cross-estimator evaluation
// ============================================================================

/// Topological sort of estimators based on their cross-estimator references.
///
/// Each estimator's expressions are scanned for `@EstimatorName.var` patterns.
/// If any such reference points to another estimator in `estimators`, that
/// creates a dependency edge.
///
/// Returns estimator IDs in evaluation order (dependencies first).
/// Returns `DomainError::ValidationError` on circular dependency.
fn topological_sort_estimators(
    estimators: &[Estimator],
) -> Result<Vec<EstimatorId>, DomainError> {
    let name_to_id: HashMap<&str, EstimatorId> = estimators
        .iter()
        .map(|e| (e.name.as_str(), e.id))
        .collect();

    let mut in_degree: HashMap<EstimatorId, usize> =
        estimators.iter().map(|e| (e.id, 0)).collect();
    let mut adj: HashMap<EstimatorId, Vec<EstimatorId>> =
        estimators.iter().map(|e| (e.id, Vec::new())).collect();

    for est in estimators {
        let mut referenced: HashSet<EstimatorId> = HashSet::new();
        for var in &est.variables {
            for r in extract_expr_refs(&var.expression) {
                if let ExprRef::Cross { estimator: name, .. } = r {
                    if let Some(&dep_id) = name_to_id.get(name.as_str()) {
                        if dep_id != est.id {
                            referenced.insert(dep_id);
                        }
                    }
                }
            }
        }

        for dep_id in referenced {
            adj.entry(dep_id).or_default().push(est.id);
            *in_degree.entry(est.id).or_insert(0) += 1;
        }
    }

    let mut queue: VecDeque<EstimatorId> = in_degree
        .iter()
        .filter(|&(_, &deg)| deg == 0)
        .map(|(&id, _)| id)
        .collect();

    let mut order = Vec::with_capacity(estimators.len());

    while let Some(id) = queue.pop_front() {
        order.push(id);
        if let Some(dependents) = adj.get(&id) {
            for &dep in dependents {
                let deg = in_degree.entry(dep).or_insert(1);
                *deg -= 1;
                if *deg == 0 {
                    queue.push_back(dep);
                }
            }
        }
    }

    if order.len() != estimators.len() {
        return Err(DomainError::validation(
            "Circular dependency detected across estimators",
        ));
    }

    Ok(order)
}

/// Replace every `@EstimatorName.variable_name` in `expr` with the numeric
/// value from `resolved` (keyed by `(estimator_name, variable_name)`).
///
/// If `strict` is true, returns `DomainError::ValidationError` for any
/// reference that cannot be resolved. If `strict` is false, missing
/// references are silently substituted with `0.0` (preview mode).
fn resolve_cross_refs(
    expr: &str,
    resolved: &HashMap<(String, String), f64>,
    strict: bool,
) -> Result<String, DomainError> {
    // Walk the expression, replacing each cross-ref with its literal value.
    // We rebuild the string in one pass rather than repeated find/replace.
    let chars: Vec<char> = expr.chars().collect();
    let mut out = String::with_capacity(expr.len());
    let mut i = 0;

    while i < chars.len() {
        if chars[i] == '@' {
            let at_pos = i;
            i += 1;
            let name_start = i;
            while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            if i == name_start {
                out.push('@');
                continue;
            }
            let first_part: String = chars[name_start..i].iter().collect();

            if i < chars.len() && chars[i] == '.' {
                let dot_pos = i;
                i += 1;
                let var_start = i;
                while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                    i += 1;
                }
                if i > var_start {
                    let variable: String = chars[var_start..i].iter().collect();
                    let key = (first_part, variable);
                    let value = match resolved.get(&key).copied() {
                        Some(v) => v,
                        None if strict => {
                            return Err(DomainError::validation(format!(
                                "Unresolved cross-estimator reference '@{}.{}'",
                                key.0, key.1
                            )));
                        }
                        None => 0.0,
                    };
                    out.push_str(&format_float(value));
                    continue;
                } else {
                    // Malformed — put back the chunk as-is
                    out.push_str(&chars[at_pos..=dot_pos].iter().collect::<String>());
                    continue;
                }
            }

            // Bare ref: keep as @name for later prepare_expression to strip
            out.push('@');
            out.push_str(&first_part);
        } else {
            out.push(chars[i]);
            i += 1;
        }
    }

    Ok(out)
}

/// Evaluate every estimator of a flow in cross-dependency order, resolving
/// `@EstimatorName.var` references between them.
///
/// Returns a nested map: estimator_name → variable_name → value.
///
/// Fails with `DomainError::ValidationError` if:
/// - Circular dependency across estimators
/// - Circular dependency within any estimator
/// - A `@Name.var` reference points to a missing estimator or variable
pub fn evaluate_flow_estimators(
    estimators: &[Estimator],
    data: &SubmissionData,
) -> Result<HashMap<String, HashMap<String, f64>>, DomainError> {
    let order = topological_sort_estimators(estimators)?;
    let est_by_id: HashMap<EstimatorId, &Estimator> =
        estimators.iter().map(|e| (e.id, e)).collect();

    // Flat context of all resolved cross-refs so far: (est_name, var_name) → value
    let mut cross_ctx: HashMap<(String, String), f64> = HashMap::new();
    let mut all_results: HashMap<String, HashMap<String, f64>> = HashMap::new();

    for est_id in order {
        let est = est_by_id[&est_id];
        let results = evaluate_single_estimator_in_context(est, data, &cross_ctx)?;

        // Publish this estimator's results into the cross-context
        for (var_name, value) in &results {
            cross_ctx.insert((est.name.clone(), var_name.clone()), *value);
        }

        all_results.insert(est.name.clone(), results);
    }

    Ok(all_results)
}

/// Evaluate a single estimator using its own variables + a context of
/// already-resolved cross-estimator values.
fn evaluate_single_estimator_in_context(
    estimator: &Estimator,
    data: &SubmissionData,
    cross_ctx: &HashMap<(String, String), f64>,
) -> Result<HashMap<String, f64>, DomainError> {
    let order = topological_sort(&estimator.variables)?;

    use evalexpr::ContextWithMutableVariables;
    let mut ctx = evalexpr::HashMapContext::<evalexpr::DefaultNumericTypes>::new();

    for (key, &value) in &data.field_values {
        ctx.set_value(key.clone(), evalexpr::Value::Float(value))
            .map_err(|e| DomainError::internal(e.to_string()))?;
    }

    let var_by_id: HashMap<EstimatorVariableId, &EstimatorVariable> =
        estimator.variables.iter().map(|v| (v.id, v)).collect();

    let mut results = HashMap::new();

    for id in order {
        let var = var_by_id[&id];
        // 1. Resolve cross-estimator refs to literals (strict in full-flow eval)
        let expr = resolve_cross_refs(&var.expression, cross_ctx, true)?;
        // 2. Resolve aggregation functions to literals
        let expr = resolve_aggregations(&expr, data)?;
        // 3. Strip @ prefixes
        let expr = prepare_expression(&expr);

        let value = evalexpr::eval_float_with_context(&expr, &ctx).map_err(|e| {
            DomainError::validation(format!(
                "Failed to evaluate variable '{}' of estimator '{}': {}",
                var.name, estimator.name, e
            ))
        })?;

        ctx.set_value(var.name.clone(), evalexpr::Value::Float(value))
            .map_err(|e| DomainError::internal(e.to_string()))?;

        results.insert(var.name.clone(), value);
    }

    Ok(results)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::flows::entities::ids::FlowId;

    fn make_var(name: &str, expr: &str) -> EstimatorVariable {
        EstimatorVariable::new(name.to_string(), expr.to_string(), String::new())
    }

    fn make_estimator(vars: Vec<EstimatorVariable>) -> Estimator {
        Estimator::with_variables(EstimatorId::new(), FlowId::new(), "test".to_string(), vars)
    }

    #[test]
    fn test_simple_field_reference() {
        let estimator = make_estimator(vec![make_var("total", "@surface * 10.0")]);
        let fields = HashMap::from([("surface".to_string(), 5.0)]);
        let result = evaluate_estimator(&estimator, &fields).unwrap();
        assert_eq!(result["total"], 50.0);
    }

    #[test]
    fn test_variable_dependency_chain() {
        let estimator = make_estimator(vec![
            make_var("ht", "@surface * @prix"),
            make_var("ttc", "@ht * 1.2"),
        ]);
        let fields = HashMap::from([("surface".to_string(), 10.0), ("prix".to_string(), 100.0)]);
        let result = evaluate_estimator(&estimator, &fields).unwrap();
        assert_eq!(result["ht"], 1000.0);
        assert!((result["ttc"] - 1200.0).abs() < 1e-9);
    }

    #[test]
    fn test_circular_dependency_detected() {
        let estimator = make_estimator(vec![
            make_var("a", "@b + 1.0"),
            make_var("b", "@a + 1.0"),
        ]);
        let result = evaluate_estimator(&estimator, &HashMap::new());
        assert!(matches!(result, Err(DomainError::ValidationError { .. })));
    }

    #[test]
    fn test_literal_only_expression() {
        let estimator = make_estimator(vec![make_var("tva", "0.2")]);
        let result = evaluate_estimator(&estimator, &HashMap::new()).unwrap();
        assert_eq!(result["tva"], 0.2);
    }

    // ========================================================================
    // Aggregation tests
    // ========================================================================

    #[test]
    fn test_sum_with_multiple_iterations() {
        let estimator = make_estimator(vec![make_var("total", "SUM(@surface) * @prix")]);
        let data = SubmissionData {
            field_values: HashMap::from([("prix".to_string(), 10.0)]),
            iteration_values: HashMap::from([(
                "surface".to_string(),
                vec![5.0, 10.0, 15.0],
            )]),
            iteration_counts: HashMap::new(),
            cross_values: HashMap::new(),
        };
        let result = evaluate_estimator_with_submission(&estimator, &data).unwrap();
        assert_eq!(result["total"], 300.0);
    }

    #[test]
    fn test_sum_with_zero_iterations() {
        let estimator = make_estimator(vec![make_var("total", "SUM(@surface)")]);
        let data = SubmissionData {
            field_values: HashMap::new(),
            iteration_values: HashMap::from([("surface".to_string(), vec![])]),
            iteration_counts: HashMap::new(),
            cross_values: HashMap::new(),
        };
        let result = evaluate_estimator_with_submission(&estimator, &data).unwrap();
        assert_eq!(result["total"], 0.0);
    }

    #[test]
    fn test_sum_with_single_iteration() {
        let estimator = make_estimator(vec![make_var("total", "SUM(@surface)")]);
        let data = SubmissionData {
            field_values: HashMap::new(),
            iteration_values: HashMap::from([("surface".to_string(), vec![42.0])]),
            iteration_counts: HashMap::new(),
            cross_values: HashMap::new(),
        };
        let result = evaluate_estimator_with_submission(&estimator, &data).unwrap();
        assert_eq!(result["total"], 42.0);
    }

    #[test]
    fn test_avg_with_multiple_iterations() {
        let estimator = make_estimator(vec![make_var("avg_surface", "AVG(@surface)")]);
        let data = SubmissionData {
            field_values: HashMap::new(),
            iteration_values: HashMap::from([(
                "surface".to_string(),
                vec![10.0, 20.0, 30.0],
            )]),
            iteration_counts: HashMap::new(),
            cross_values: HashMap::new(),
        };
        let result = evaluate_estimator_with_submission(&estimator, &data).unwrap();
        assert_eq!(result["avg_surface"], 20.0);
    }

    #[test]
    fn test_avg_with_zero_iterations() {
        let estimator = make_estimator(vec![make_var("avg_surface", "AVG(@surface)")]);
        let data = SubmissionData {
            field_values: HashMap::new(),
            iteration_values: HashMap::from([("surface".to_string(), vec![])]),
            iteration_counts: HashMap::new(),
            cross_values: HashMap::new(),
        };
        let result = evaluate_estimator_with_submission(&estimator, &data).unwrap();
        assert_eq!(result["avg_surface"], 0.0);
    }

    #[test]
    fn test_count_iterations() {
        let estimator = make_estimator(vec![
            make_var("count", "COUNT_ITER(@rooms)"),
            make_var("cost", "@count * 100.0"),
        ]);
        let data = SubmissionData {
            field_values: HashMap::new(),
            iteration_values: HashMap::new(),
            iteration_counts: HashMap::from([("rooms".to_string(), 5)]),
            cross_values: HashMap::new(),
        };
        let result = evaluate_estimator_with_submission(&estimator, &data).unwrap();
        assert_eq!(result["count"], 5.0);
        assert_eq!(result["cost"], 500.0);
    }

    #[test]
    fn test_mixed_static_and_aggregated() {
        let estimator = make_estimator(vec![
            make_var("total_surface", "SUM(@surface)"),
            make_var("ht", "@total_surface * @prix_unitaire"),
            make_var("ttc", "@ht * 1.2"),
        ]);
        let data = SubmissionData {
            field_values: HashMap::from([("prix_unitaire".to_string(), 50.0)]),
            iteration_values: HashMap::from([(
                "surface".to_string(),
                vec![10.0, 20.0, 30.0],
            )]),
            iteration_counts: HashMap::new(),
            cross_values: HashMap::new(),
        };
        let result = evaluate_estimator_with_submission(&estimator, &data).unwrap();
        assert_eq!(result["total_surface"], 60.0);
        assert_eq!(result["ht"], 3000.0);
        assert!((result["ttc"] - 3600.0).abs() < 1e-9);
    }

    #[test]
    fn test_sum_unknown_field_errors() {
        let estimator = make_estimator(vec![make_var("total", "SUM(@unknown)")]);
        let data = SubmissionData::default();
        let result = evaluate_estimator_with_submission(&estimator, &data);
        assert!(matches!(result, Err(DomainError::ValidationError { .. })));
    }

    #[test]
    fn test_count_iter_unknown_step_errors() {
        let estimator = make_estimator(vec![make_var("n", "COUNT_ITER(@unknown_step)")]);
        let data = SubmissionData::default();
        let result = evaluate_estimator_with_submission(&estimator, &data);
        assert!(matches!(result, Err(DomainError::ValidationError { .. })));
    }

    // ========================================================================
    // Cross-estimator tests
    // ========================================================================

    fn make_named_estimator(name: &str, vars: Vec<EstimatorVariable>) -> Estimator {
        Estimator::with_variables(EstimatorId::new(), FlowId::new(), name.to_string(), vars)
    }

    #[test]
    fn test_parser_bare_refs() {
        let refs = extract_expr_refs("@surface * @prix");
        assert_eq!(
            refs,
            vec![
                ExprRef::Bare("surface".to_string()),
                ExprRef::Bare("prix".to_string()),
            ]
        );
    }

    #[test]
    fn test_parser_cross_ref() {
        let refs = extract_expr_refs("@Materials.total + @Labor.total");
        assert_eq!(
            refs,
            vec![
                ExprRef::Cross {
                    estimator: "Materials".to_string(),
                    variable: "total".to_string()
                },
                ExprRef::Cross {
                    estimator: "Labor".to_string(),
                    variable: "total".to_string()
                },
            ]
        );
    }

    #[test]
    fn test_parser_mixed_refs() {
        let refs = extract_expr_refs("@Materials.total * @tva_rate + @surface");
        assert_eq!(
            refs,
            vec![
                ExprRef::Cross {
                    estimator: "Materials".to_string(),
                    variable: "total".to_string()
                },
                ExprRef::Bare("tva_rate".to_string()),
                ExprRef::Bare("surface".to_string()),
            ]
        );
    }

    #[test]
    fn test_evaluate_single_estimator_preview_defaults_cross_refs_to_zero() {
        // In preview mode, unknown cross-refs default to 0
        let est = make_named_estimator(
            "Final",
            vec![make_var("total", "@Other.total + 10.0")],
        );
        let result = evaluate_estimator(&est, &HashMap::new()).unwrap();
        assert_eq!(result["total"], 10.0); // 0 + 10

        let result2 =
            evaluate_estimator_with_submission(&est, &SubmissionData::default()).unwrap();
        assert_eq!(result2["total"], 10.0);
    }

    #[test]
    fn test_evaluate_single_estimator_preview_uses_cross_values_stubs() {
        // User provides stub values for cross-refs
        let est = make_named_estimator(
            "Final",
            vec![make_var("total", "@Other.total * 2.0")],
        );
        let mut cross_values = HashMap::new();
        cross_values.insert(
            "Other".to_string(),
            HashMap::from([("total".to_string(), 50.0)]),
        );
        let data = SubmissionData {
            cross_values,
            ..Default::default()
        };
        let result = evaluate_estimator_with_submission(&est, &data).unwrap();
        assert_eq!(result["total"], 100.0); // 50 * 2
    }

    #[test]
    fn test_evaluate_flow_no_cross_refs() {
        let a = make_named_estimator("A", vec![make_var("x", "@surface * 2.0")]);
        let b = make_named_estimator("B", vec![make_var("y", "@prix + 1.0")]);
        let data = SubmissionData {
            field_values: HashMap::from([
                ("surface".to_string(), 5.0),
                ("prix".to_string(), 9.0),
            ]),
            iteration_values: HashMap::new(),
            iteration_counts: HashMap::new(),
            cross_values: HashMap::new(),
        };
        let result = evaluate_flow_estimators(&[a, b], &data).unwrap();
        assert_eq!(result["A"]["x"], 10.0);
        assert_eq!(result["B"]["y"], 10.0);
    }

    #[test]
    fn test_evaluate_flow_with_cross_refs() {
        // Materials.total = @surface * @prix_m2
        // Labor.total     = @hours * @rate
        // Final.ttc       = (@Materials.total + @Labor.total) * 1.2
        let materials = make_named_estimator(
            "Materials",
            vec![make_var("total", "@surface * @prix_m2")],
        );
        let labor = make_named_estimator(
            "Labor",
            vec![make_var("total", "@hours * @rate")],
        );
        let final_est = make_named_estimator(
            "Final",
            vec![make_var("ttc", "(@Materials.total + @Labor.total) * 1.2")],
        );

        let data = SubmissionData {
            field_values: HashMap::from([
                ("surface".to_string(), 100.0),
                ("prix_m2".to_string(), 10.0), // Materials.total = 1000
                ("hours".to_string(), 20.0),
                ("rate".to_string(), 50.0),    // Labor.total = 1000
            ]),
            iteration_values: HashMap::new(),
            iteration_counts: HashMap::new(),
            cross_values: HashMap::new(),
        };

        let result = evaluate_flow_estimators(&[materials, labor, final_est], &data).unwrap();
        assert_eq!(result["Materials"]["total"], 1000.0);
        assert_eq!(result["Labor"]["total"], 1000.0);
        assert!((result["Final"]["ttc"] - 2400.0).abs() < 1e-9);
    }

    #[test]
    fn test_evaluate_flow_circular_across_estimators() {
        // A.x depends on B.y, B.y depends on A.x → cycle
        let a = make_named_estimator("A", vec![make_var("x", "@B.y + 1.0")]);
        let b = make_named_estimator("B", vec![make_var("y", "@A.x + 1.0")]);
        let result = evaluate_flow_estimators(&[a, b], &SubmissionData::default());
        assert!(matches!(result, Err(DomainError::ValidationError { .. })));
    }

    #[test]
    fn test_evaluate_flow_unresolved_cross_ref() {
        // Final.total references @Unknown.x which doesn't exist
        let final_est = make_named_estimator(
            "Final",
            vec![make_var("total", "@Unknown.x + 1.0")],
        );
        let result = evaluate_flow_estimators(&[final_est], &SubmissionData::default());
        assert!(matches!(result, Err(DomainError::ValidationError { .. })));
    }

    #[test]
    fn test_evaluate_flow_missing_cross_variable() {
        // Final references @Other.missing, but Other only has `present`
        let other = make_named_estimator("Other", vec![make_var("present", "1.0")]);
        let final_est = make_named_estimator(
            "Final",
            vec![make_var("total", "@Other.missing + 1.0")],
        );
        let result = evaluate_flow_estimators(&[other, final_est], &SubmissionData::default());
        assert!(matches!(result, Err(DomainError::ValidationError { .. })));
    }

    #[test]
    fn test_evaluate_flow_empty() {
        let result = evaluate_flow_estimators(&[], &SubmissionData::default()).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_evaluate_flow_with_aggregations_and_cross_refs() {
        // Rooms.total = SUM(@room_surface)
        // Devis.ttc   = @Rooms.total * @prix_unitaire
        let rooms = make_named_estimator(
            "Rooms",
            vec![make_var("total", "SUM(@room_surface)")],
        );
        let devis = make_named_estimator(
            "Devis",
            vec![make_var("ttc", "@Rooms.total * @prix_unitaire")],
        );

        let data = SubmissionData {
            field_values: HashMap::from([("prix_unitaire".to_string(), 10.0)]),
            iteration_values: HashMap::from([(
                "room_surface".to_string(),
                vec![15.0, 20.0, 25.0], // sum = 60
            )]),
            iteration_counts: HashMap::new(),
            cross_values: HashMap::new(),
        };
        let result = evaluate_flow_estimators(&[rooms, devis], &data).unwrap();
        assert_eq!(result["Rooms"]["total"], 60.0);
        assert_eq!(result["Devis"]["ttc"], 600.0);
    }

    #[test]
    fn test_evaluate_flow_diamond_dependency() {
        // A → B, A → C, B → D, C → D
        let a = make_named_estimator("A", vec![make_var("x", "10.0")]);
        let b = make_named_estimator("B", vec![make_var("y", "@A.x * 2.0")]);
        let c = make_named_estimator("C", vec![make_var("z", "@A.x * 3.0")]);
        let d = make_named_estimator("D", vec![make_var("w", "@B.y + @C.z")]);

        let result =
            evaluate_flow_estimators(&[d, c, b, a], &SubmissionData::default()).unwrap();
        assert_eq!(result["A"]["x"], 10.0);
        assert_eq!(result["B"]["y"], 20.0);
        assert_eq!(result["C"]["z"], 30.0);
        assert_eq!(result["D"]["w"], 50.0);
    }
}
