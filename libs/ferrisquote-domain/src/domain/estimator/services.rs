use std::collections::{HashMap, HashSet, VecDeque};

use crate::domain::{error::DomainError, flows::entities::ids::FlowId};

use super::{
    entities::{
        estimator::Estimator,
        ids::{EstimatorId, EstimatorVariableId},
        variable::EstimatorVariable,
    },
    ports::{EstimatorRepository, EstimatorService},
};

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
}

// ============================================================================
// Expression evaluation (pure, no I/O)
// ============================================================================

/// Evaluate all variables of an estimator in dependency order.
pub fn evaluate_estimator(
    estimator: &Estimator,
    field_values: &HashMap<String, f64>,
) -> Result<HashMap<String, f64>, DomainError> {
    let order = topological_sort(&estimator.variables)?;

    // Seed the evalexpr context with field values
    use evalexpr::ContextWithMutableVariables;
    let mut ctx = evalexpr::HashMapContext::<evalexpr::DefaultNumericTypes>::new();
    for (key, &value) in field_values {
        ctx.set_value(key.clone(), evalexpr::Value::Float(value))
            .map_err(|e| DomainError::internal(e.to_string()))?;
    }

    let var_by_id: HashMap<EstimatorVariableId, &EstimatorVariable> =
        estimator.variables.iter().map(|v| (v.id, v)).collect();

    let mut results = HashMap::new();

    for id in order {
        let var = var_by_id[&id];
        let expr = prepare_expression(&var.expression);

        let value = evalexpr::eval_float_with_context(&expr, &ctx).map_err(|e| {
            DomainError::validation(format!(
                "Failed to evaluate variable '{}': {}",
                var.name, e
            ))
        })?;

        use evalexpr::ContextWithMutableVariables;
        ctx.set_value(var.name.clone(), evalexpr::Value::Float(value))
            .map_err(|e| DomainError::internal(e.to_string()))?;

        results.insert(var.name.clone(), value);
    }

    Ok(results)
}

/// Strip `@` prefixes so `@surface * @prix` becomes `surface * prix`,
/// which is the syntax evalexpr expects.
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

/// Extract all `@name` references from an expression.
fn extract_references(expr: &str) -> Vec<String> {
    let chars: Vec<char> = expr.chars().collect();
    let mut refs = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '@' {
            i += 1;
            let start = i;
            while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            if i > start {
                refs.push(chars[start..i].iter().collect());
            }
        } else {
            i += 1;
        }
    }
    refs
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
        let refs = extract_references(&var.expression);
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
        // ht depends on surface and prix, ttc depends on ht
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
}
