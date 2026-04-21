use std::collections::{HashMap, HashSet, VecDeque};

use crate::domain::{error::DomainError, flows::entities::id::FlowId};

use super::{
    entities::{
        estimator::Estimator,
        id::{EstimatorId, EstimatorInputId, EstimatorOutputId},
        output::EstimatorOutput,
        parameter::{EstimatorParameter, EstimatorParameterType},
        submission::SubmissionData,
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
        validate_estimator_name(&name)?;
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
        description: Option<String>,
    ) -> Result<Estimator, DomainError> {
        if let Some(n) = &name {
            validate_estimator_name(n)?;
        }
        self.repo.update_estimator(id, name, description).await
    }

    async fn delete_estimator(&self, id: EstimatorId) -> Result<(), DomainError> {
        self.repo.delete_estimator(id).await
    }

    async fn add_input(
        &self,
        estimator_id: EstimatorId,
        key: String,
        description: String,
        parameter_type: EstimatorParameterType,
    ) -> Result<EstimatorParameter, DomainError> {
        validate_identifier("Input key", &key)?;
        let input = EstimatorParameter::new(key, description, parameter_type);
        self.repo.add_input(estimator_id, input).await
    }

    async fn update_input(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorInputId,
        key: Option<String>,
        description: Option<String>,
        parameter_type: Option<EstimatorParameterType>,
    ) -> Result<EstimatorParameter, DomainError> {
        if let Some(k) = &key {
            validate_identifier("Input key", k)?;
        }
        self.repo
            .update_input(estimator_id, id, key, description, parameter_type)
            .await
    }

    async fn remove_input(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorInputId,
    ) -> Result<(), DomainError> {
        self.repo.remove_input(estimator_id, id).await
    }

    async fn add_output(
        &self,
        estimator_id: EstimatorId,
        key: String,
        expression: String,
        description: String,
    ) -> Result<EstimatorOutput, DomainError> {
        validate_identifier("Output key", &key)?;
        let output = EstimatorOutput::new(key, expression, description);
        self.repo.add_output(estimator_id, output).await
    }

    async fn update_output(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorOutputId,
        key: Option<String>,
        expression: Option<String>,
        description: Option<String>,
    ) -> Result<EstimatorOutput, DomainError> {
        if let Some(k) = &key {
            validate_identifier("Output key", k)?;
        }
        self.repo
            .update_output(estimator_id, id, key, expression, description)
            .await
    }

    async fn remove_output(
        &self,
        estimator_id: EstimatorId,
        id: EstimatorOutputId,
    ) -> Result<(), DomainError> {
        self.repo.remove_output(estimator_id, id).await
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
// Validation
// ============================================================================

fn validate_estimator_name(name: &str) -> Result<(), DomainError> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(DomainError::validation("Estimator name cannot be empty"));
    }
    if trimmed.len() > 255 {
        return Err(DomainError::validation(
            "Estimator name must be at most 255 characters",
        ));
    }
    if trimmed != name {
        return Err(DomainError::validation(
            "Estimator name cannot start or end with whitespace",
        ));
    }
    if !name.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err(DomainError::validation(
            "Estimator name can only contain alphanumeric characters and underscores",
        ));
    }
    Ok(())
}

fn validate_identifier(field: &str, value: &str) -> Result<(), DomainError> {
    if value.is_empty() {
        return Err(DomainError::validation(format!("{field} cannot be empty")));
    }
    if value.len() > 255 {
        return Err(DomainError::validation(format!(
            "{field} must be at most 255 characters"
        )));
    }
    if !value.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err(DomainError::validation(format!(
            "{field} can only contain alphanumeric characters and underscores"
        )));
    }
    Ok(())
}

// ============================================================================
// Expression evaluation (pure, no I/O)
// ============================================================================

pub fn evaluate_estimator(
    estimator: &Estimator,
    field_values: &HashMap<String, f64>,
) -> Result<HashMap<String, f64>, DomainError> {
    let order = topological_sort(&estimator.outputs)?;

    use evalexpr::ContextWithMutableVariables;
    let mut ctx = evalexpr::HashMapContext::<evalexpr::DefaultNumericTypes>::new();
    for (key, &value) in field_values {
        ctx.set_value(key.clone(), evalexpr::Value::Float(value))
            .map_err(|e| DomainError::internal(e.to_string()))?;
    }

    let output_by_id: HashMap<EstimatorOutputId, &EstimatorOutput> =
        estimator.outputs.iter().map(|v| (v.id, v)).collect();

    let empty_cross: HashMap<(String, String), f64> = HashMap::new();
    let mut results = HashMap::new();

    for id in order {
        let output = output_by_id[&id];
        let expr = resolve_cross_refs(&output.expression, &empty_cross, false)?;
        let expr = prepare_expression(&expr);

        let value = evalexpr::eval_float_with_context(&expr, &ctx).map_err(|e| {
            DomainError::validation(format!(
                "Failed to evaluate output '{}': {}",
                output.key, e
            ))
        })?;

        ctx.set_value(output.key.clone(), evalexpr::Value::Float(value))
            .map_err(|e| DomainError::internal(e.to_string()))?;

        results.insert(output.key.clone(), value);
    }

    Ok(results)
}

pub fn evaluate_estimator_with_submission(
    estimator: &Estimator,
    data: &SubmissionData,
) -> Result<HashMap<String, f64>, DomainError> {
    let order = topological_sort(&estimator.outputs)?;

    use evalexpr::ContextWithMutableVariables;
    let mut ctx = evalexpr::HashMapContext::<evalexpr::DefaultNumericTypes>::new();

    for (key, &value) in &data.field_values {
        ctx.set_value(key.clone(), evalexpr::Value::Float(value))
            .map_err(|e| DomainError::internal(e.to_string()))?;
    }

    let cross_resolved = flatten_cross_values(&data.cross_values);

    let output_by_id: HashMap<EstimatorOutputId, &EstimatorOutput> =
        estimator.outputs.iter().map(|v| (v.id, v)).collect();

    let mut results = HashMap::new();

    for id in order {
        let output = output_by_id[&id];
        let expr = resolve_cross_refs(&output.expression, &cross_resolved, false)?;
        let expr = resolve_aggregations(&expr, data)?;
        let expr = prepare_expression(&expr);

        let value = evalexpr::eval_float_with_context(&expr, &ctx).map_err(|e| {
            DomainError::validation(format!(
                "Failed to evaluate output '{}': {}",
                output.key, e
            ))
        })?;

        ctx.set_value(output.key.clone(), evalexpr::Value::Float(value))
            .map_err(|e| DomainError::internal(e.to_string()))?;

        results.insert(output.key.clone(), value);
    }

    Ok(results)
}

fn flatten_cross_values(
    nested: &HashMap<String, HashMap<String, f64>>,
) -> HashMap<(String, String), f64> {
    let mut out = HashMap::new();
    for (est_name, outs) in nested {
        for (output_key, &value) in outs {
            out.insert((est_name.clone(), output_key.clone()), value);
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
                let values = data.iteration_values.get(&arg).ok_or_else(|| {
                    DomainError::validation(format!(
                        "SUM references unknown repeatable field '{arg}'"
                    ))
                })?;
                values.iter().sum::<f64>()
            }
            "AVG" => {
                let values = data.iteration_values.get(&arg).ok_or_else(|| {
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
                let count = data.iteration_counts.get(&arg).ok_or_else(|| {
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

fn prepare_expression(expr: &str) -> String {
    let chars: Vec<char> = expr.chars().collect();
    let mut result = String::with_capacity(expr.len());
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '@' {
            i += 1;
        } else {
            result.push(chars[i]);
            i += 1;
        }
    }
    result
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum ExprRef {
    Bare(String),
    Cross {
        estimator_id: String,
        variable: String,
    },
}

pub fn extract_expr_refs(expr: &str) -> Vec<ExprRef> {
    let chars: Vec<char> = expr.chars().collect();
    let mut refs = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '@' {
            i += 1;
            if i < chars.len() && chars[i] == '#' {
                i += 1;
                let id_start = i;
                while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '-') {
                    i += 1;
                }
                if i > id_start && i < chars.len() && chars[i] == '.' {
                    let id: String = chars[id_start..i].iter().collect();
                    i += 1;
                    let var_start = i;
                    while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                        i += 1;
                    }
                    if i > var_start {
                        let variable: String = chars[var_start..i].iter().collect();
                        refs.push(ExprRef::Cross {
                            estimator_id: id,
                            variable,
                        });
                        continue;
                    }
                }
                continue;
            }

            let name_start = i;
            while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            if i > name_start {
                refs.push(ExprRef::Bare(chars[name_start..i].iter().collect()));
            }
        } else {
            i += 1;
        }
    }
    refs
}

fn extract_bare_references(expr: &str) -> Vec<String> {
    extract_expr_refs(expr)
        .into_iter()
        .filter_map(|r| match r {
            ExprRef::Bare(name) => Some(name),
            ExprRef::Cross { .. } => None,
        })
        .collect()
}

fn topological_sort(
    outputs: &[EstimatorOutput],
) -> Result<Vec<EstimatorOutputId>, DomainError> {
    let key_to_id: HashMap<&str, EstimatorOutputId> =
        outputs.iter().map(|v| (v.key.as_str(), v.id)).collect();

    let mut in_degree: HashMap<EstimatorOutputId, usize> =
        outputs.iter().map(|v| (v.id, 0)).collect();
    let mut adj: HashMap<EstimatorOutputId, Vec<EstimatorOutputId>> =
        outputs.iter().map(|v| (v.id, Vec::new())).collect();

    for output in outputs {
        let refs = extract_bare_references(&output.expression);
        let unique_deps: HashSet<EstimatorOutputId> = refs
            .iter()
            .filter_map(|name| key_to_id.get(name.as_str()).copied())
            .collect();

        for dep_id in unique_deps {
            adj.entry(dep_id).or_default().push(output.id);
            *in_degree.entry(output.id).or_insert(0) += 1;
        }
    }

    let mut queue: VecDeque<EstimatorOutputId> = in_degree
        .iter()
        .filter(|&(_, &deg)| deg == 0)
        .map(|(&id, _)| id)
        .collect();

    let mut order = Vec::with_capacity(outputs.len());

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

    if order.len() != outputs.len() {
        return Err(DomainError::validation(
            "Circular dependency detected in estimator outputs",
        ));
    }

    Ok(order)
}

fn topological_sort_estimators(
    estimators: &[Estimator],
) -> Result<Vec<EstimatorId>, DomainError> {
    let uuid_to_id: HashMap<String, EstimatorId> = estimators
        .iter()
        .map(|e| (e.id.to_string(), e.id))
        .collect();

    let mut in_degree: HashMap<EstimatorId, usize> =
        estimators.iter().map(|e| (e.id, 0)).collect();
    let mut adj: HashMap<EstimatorId, Vec<EstimatorId>> =
        estimators.iter().map(|e| (e.id, Vec::new())).collect();

    for est in estimators {
        let mut referenced: HashSet<EstimatorId> = HashSet::new();
        for output in &est.outputs {
            for r in extract_expr_refs(&output.expression) {
                if let ExprRef::Cross { estimator_id, .. } = r {
                    if let Some(&dep_id) = uuid_to_id.get(&estimator_id) {
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

fn resolve_cross_refs(
    expr: &str,
    resolved: &HashMap<(String, String), f64>,
    strict: bool,
) -> Result<String, DomainError> {
    let chars: Vec<char> = expr.chars().collect();
    let mut out = String::with_capacity(expr.len());
    let mut i = 0;

    while i < chars.len() {
        if chars[i] == '@' {
            let at_pos = i;
            i += 1;

            if i < chars.len() && chars[i] == '#' {
                i += 1;
                let id_start = i;
                while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '-') {
                    i += 1;
                }
                if i > id_start && i < chars.len() && chars[i] == '.' {
                    let id: String = chars[id_start..i].iter().collect();
                    i += 1;
                    let var_start = i;
                    while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                        i += 1;
                    }
                    if i > var_start {
                        let variable: String = chars[var_start..i].iter().collect();
                        let key = (id, variable);
                        let value = match resolved.get(&key).copied() {
                            Some(v) => v,
                            None if strict => {
                                return Err(DomainError::validation(format!(
                                    "Unresolved cross-estimator reference '@#{}.{}'",
                                    key.0, key.1
                                )));
                            }
                            None => 0.0,
                        };
                        out.push_str(&format_float(value));
                        continue;
                    }
                }
                out.push_str(&chars[at_pos..i].iter().collect::<String>());
                continue;
            }

            let name_start = i;
            while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            if i > name_start {
                out.push('@');
                out.push_str(&chars[name_start..i].iter().collect::<String>());
            } else {
                out.push('@');
            }
        } else {
            out.push(chars[i]);
            i += 1;
        }
    }

    Ok(out)
}

pub fn evaluate_flow_estimators(
    estimators: &[Estimator],
    data: &SubmissionData,
) -> Result<HashMap<String, HashMap<String, f64>>, DomainError> {
    let order = topological_sort_estimators(estimators)?;
    let est_by_id: HashMap<EstimatorId, &Estimator> =
        estimators.iter().map(|e| (e.id, e)).collect();

    let mut cross_ctx: HashMap<(String, String), f64> = HashMap::new();
    let mut all_results: HashMap<String, HashMap<String, f64>> = HashMap::new();

    for est_id in order {
        let est = est_by_id[&est_id];
        let results = evaluate_single_estimator_in_context(est, data, &cross_ctx)?;

        let id_str = est.id.to_string();
        for (output_key, value) in &results {
            cross_ctx.insert((id_str.clone(), output_key.clone()), *value);
        }

        all_results.insert(est.name.clone(), results);
    }

    Ok(all_results)
}

fn evaluate_single_estimator_in_context(
    estimator: &Estimator,
    data: &SubmissionData,
    cross_ctx: &HashMap<(String, String), f64>,
) -> Result<HashMap<String, f64>, DomainError> {
    let order = topological_sort(&estimator.outputs)?;

    use evalexpr::ContextWithMutableVariables;
    let mut ctx = evalexpr::HashMapContext::<evalexpr::DefaultNumericTypes>::new();

    for (key, &value) in &data.field_values {
        ctx.set_value(key.clone(), evalexpr::Value::Float(value))
            .map_err(|e| DomainError::internal(e.to_string()))?;
    }

    let output_by_id: HashMap<EstimatorOutputId, &EstimatorOutput> =
        estimator.outputs.iter().map(|v| (v.id, v)).collect();

    let mut results = HashMap::new();

    for id in order {
        let output = output_by_id[&id];
        let expr = resolve_cross_refs(&output.expression, cross_ctx, true)?;
        let expr = resolve_aggregations(&expr, data)?;
        let expr = prepare_expression(&expr);

        let value = evalexpr::eval_float_with_context(&expr, &ctx).map_err(|e| {
            DomainError::validation(format!(
                "Failed to evaluate output '{}' of estimator '{}': {}",
                output.key, estimator.name, e
            ))
        })?;

        ctx.set_value(output.key.clone(), evalexpr::Value::Float(value))
            .map_err(|e| DomainError::internal(e.to_string()))?;

        results.insert(output.key.clone(), value);
    }

    Ok(results)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::flows::entities::id::FlowId;

    fn make_output(key: &str, expr: &str) -> EstimatorOutput {
        EstimatorOutput::new(key.to_string(), expr.to_string(), String::new())
    }

    fn make_estimator(outputs: Vec<EstimatorOutput>) -> Estimator {
        Estimator::with_full(
            EstimatorId::new(),
            FlowId::new(),
            "test".to_string(),
            String::new(),
            Vec::new(),
            outputs,
        )
    }

    fn make_named_estimator(name: &str, outputs: Vec<EstimatorOutput>) -> Estimator {
        Estimator::with_full(
            EstimatorId::new(),
            FlowId::new(),
            name.to_string(),
            String::new(),
            Vec::new(),
            outputs,
        )
    }

    fn xref(est: &Estimator, key: &str) -> String {
        format!("@#{}.{}", est.id, key)
    }

    #[test]
    fn test_simple_field_reference() {
        let estimator = make_estimator(vec![make_output("total", "@surface * 10.0")]);
        let fields = HashMap::from([("surface".to_string(), 5.0)]);
        let result = evaluate_estimator(&estimator, &fields).unwrap();
        assert_eq!(result["total"], 50.0);
    }

    #[test]
    fn test_output_dependency_chain() {
        let estimator = make_estimator(vec![
            make_output("ht", "@surface * @prix"),
            make_output("ttc", "@ht * 1.2"),
        ]);
        let fields = HashMap::from([("surface".to_string(), 10.0), ("prix".to_string(), 100.0)]);
        let result = evaluate_estimator(&estimator, &fields).unwrap();
        assert_eq!(result["ht"], 1000.0);
        assert!((result["ttc"] - 1200.0).abs() < 1e-9);
    }

    #[test]
    fn test_circular_dependency_detected() {
        let estimator = make_estimator(vec![
            make_output("a", "@b + 1.0"),
            make_output("b", "@a + 1.0"),
        ]);
        let result = evaluate_estimator(&estimator, &HashMap::new());
        assert!(matches!(result, Err(DomainError::ValidationError { .. })));
    }

    #[test]
    fn test_sum_multiple_iterations() {
        let estimator = make_estimator(vec![make_output("total", "SUM(@surface) * @prix")]);
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
    fn test_count_iterations() {
        let estimator = make_estimator(vec![
            make_output("count", "COUNT_ITER(@rooms)"),
            make_output("cost", "@count * 100.0"),
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
    fn test_evaluate_flow_with_cross_refs() {
        let materials = make_named_estimator(
            "Materials",
            vec![make_output("total", "@surface * @prix_m2")],
        );
        let labor = make_named_estimator("Labor", vec![make_output("total", "@hours * @rate")]);
        let final_ttc_expr = format!(
            "({} + {}) * 1.2",
            xref(&materials, "total"),
            xref(&labor, "total")
        );
        let final_est = make_named_estimator("Final", vec![make_output("ttc", &final_ttc_expr)]);

        let data = SubmissionData {
            field_values: HashMap::from([
                ("surface".to_string(), 100.0),
                ("prix_m2".to_string(), 10.0),
                ("hours".to_string(), 20.0),
                ("rate".to_string(), 50.0),
            ]),
            ..Default::default()
        };

        let result = evaluate_flow_estimators(&[materials, labor, final_est], &data).unwrap();
        assert_eq!(result["Materials"]["total"], 1000.0);
        assert_eq!(result["Labor"]["total"], 1000.0);
        assert!((result["Final"]["ttc"] - 2400.0).abs() < 1e-9);
    }

    #[test]
    fn test_evaluate_flow_empty() {
        let result = evaluate_flow_estimators(&[], &SubmissionData::default()).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_validate_estimator_name_rejects_spaces() {
        assert!(matches!(
            validate_estimator_name("Cost superficie"),
            Err(DomainError::ValidationError { .. })
        ));
    }

    #[test]
    fn test_validate_estimator_name_accepts_valid() {
        assert!(validate_estimator_name("Materials").is_ok());
        assert!(validate_estimator_name("cost_superficie").is_ok());
    }
}
