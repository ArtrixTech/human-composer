use std::collections::{HashMap, HashSet};

use crate::models::{Branch, RecommendedTask, Task, TaskDependency, TaskStatus};

pub fn compute_recommendations(
    branches: &[Branch],
    tasks: &[Task],
    dependencies: &[TaskDependency],
) -> Vec<RecommendedTask> {
    let branch_names: HashMap<&str, &str> = branches
        .iter()
        .map(|b| (b.id.as_str(), b.name.as_str()))
        .collect();

    let ready: Vec<&Task> = tasks
        .iter()
        .filter(|t| t.status == TaskStatus::Ready)
        .collect();

    if ready.is_empty() {
        return vec![];
    }

    let downstream = build_downstream_map(dependencies);
    let branch_last_activity = branch_activity(tasks, branches);

    let mut scored: Vec<RecommendedTask> = ready
        .into_iter()
        .map(|task| {
            let blocked_count = count_transitive_downstream(&downstream, &task.id, tasks);
            let branch_name = task
                .branch_id
                .as_deref()
                .and_then(|id| branch_names.get(id).copied())
                .map(String::from);

            let branch_stale = task
                .branch_id
                .as_deref()
                .and_then(|id| branch_last_activity.get(id))
                .copied()
                .unwrap_or(0.0);

            let mut score = blocked_count as f64 * 10.0 + branch_stale * 3.0;
            if task.pinned {
                score += 1000.0;
            }

            RecommendedTask {
                task: task.clone(),
                branch_name,
                score,
                blocked_count,
            }
        })
        .collect();

    scored.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.task.title.cmp(&b.task.title))
    });

    scored
}

fn build_downstream_map(dependencies: &[TaskDependency]) -> HashMap<String, Vec<String>> {
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    for dep in dependencies {
        map.entry(dep.depends_on_task_id.clone())
            .or_default()
            .push(dep.task_id.clone());
    }
    map
}

fn count_transitive_downstream(
    downstream: &HashMap<String, Vec<String>>,
    task_id: &str,
    tasks: &[Task],
) -> i32 {
    let mut visited = HashSet::new();
    let mut queue = vec![task_id.to_string()];
    let mut count = 0;

    while let Some(current) = queue.pop() {
        if let Some(children) = downstream.get(&current) {
            for child in children {
                if visited.insert(child.clone()) {
                    if tasks
                        .iter()
                        .find(|t| t.id == *child)
                        .map(|t| t.status != TaskStatus::Done)
                        .unwrap_or(false)
                    {
                        count += 1;
                        queue.push(child.clone());
                    }
                }
            }
        }
    }

    count
}

fn branch_activity(tasks: &[Task], branches: &[Branch]) -> HashMap<String, f64> {
    let mut scores: HashMap<String, f64> = branches
        .iter()
        .map(|b| (b.id.clone(), 0.0))
        .collect();

    for branch in branches {
        let branch_tasks: Vec<&Task> = tasks
            .iter()
            .filter(|t| t.branch_id.as_deref() == Some(branch.id.as_str()))
            .collect();

        let has_active = branch_tasks.iter().any(|t| t.status == TaskStatus::Active);
        let has_recent_done = branch_tasks.iter().any(|t| t.status == TaskStatus::Done);

        let stale = if has_active {
            0.0
        } else if has_recent_done {
            1.0
        } else {
            2.0
        };

        scores.insert(branch.id.clone(), stale);
    }

    scores
}
