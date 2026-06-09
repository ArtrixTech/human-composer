use chrono::{DateTime, Local, NaiveTime, Timelike, Utc};

use crate::models::{
    Branch, DayLane, DayLaneSnapshot, DayLaneType, DayRunwaySnapshot, ExternalStatus, RecommendedTask,
    Task, TaskDependency, TaskStatus, TaskType, TimeBudget, TodayTaskContext,
};
use crate::recommend::compute_recommendations;
use crate::today::{add_minutes_to_time, format_time, minutes_until_day_end, DEFAULT_DAY_END, DEFAULT_ESTIMATE_MINUTES};

pub fn local_date_string() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

pub fn previous_date_string(date: &str) -> Option<String> {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .ok()
        .and_then(|d| d.pred_opt())
        .map(|d| d.format("%Y-%m-%d").to_string())
}

pub struct RunwayBuildInput<'a> {
    pub date: &'a str,
    pub lanes: &'a [DayLane],
    pub lane_tasks: &'a [(String, String, i32)], // lane_id, task_id, sort_order
    pub projects: &'a [(String, String)],
    pub branches: &'a [Branch],
    pub tasks: &'a [Task],
    pub dependencies: &'a [TaskDependency],
    pub day_end_time: &'a str,
    pub carry_over_count: i32,
    pub enabled_lane_count: i32,
}

pub fn build_day_runway_snapshot(input: RunwayBuildInput<'_>) -> DayRunwaySnapshot {
    let branch_map: std::collections::HashMap<&str, &Branch> = input
        .branches
        .iter()
        .map(|b| (b.id.as_str(), b))
        .collect();
    let project_map: std::collections::HashMap<&str, &str> = input
        .projects
        .iter()
        .map(|(id, name)| (id.as_str(), name.as_str()))
        .collect();
    let task_map: std::collections::HashMap<&str, &Task> = input
        .tasks
        .iter()
        .map(|t| (t.id.as_str(), t))
        .collect();

    let wrap_context = |task: &Task| -> TodayTaskContext {
        let project_name = project_map
            .get(task.project_id.as_str())
            .copied()
            .unwrap_or("Unknown")
            .to_string();
        let branch_name = task
            .branch_id
            .as_deref()
            .and_then(|id| branch_map.get(id))
            .map(|b| b.name.clone());
        TodayTaskContext {
            task: task.clone(),
            project_id: task.project_id.clone(),
            project_name,
            branch_name,
        }
    };

    let today_start = Local::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
    let today_start_utc: DateTime<Utc> = today_start.and_local_timezone(Local).unwrap().into();

    let completed_today: Vec<TodayTaskContext> = input
        .tasks
        .iter()
        .filter(|t| {
            t.status == TaskStatus::Done
                && t.completed_at
                    .map(|c| c >= today_start_utc)
                    .unwrap_or(false)
        })
        .map(wrap_context)
        .collect();

    let mut all_recommendations: Vec<RecommendedTask> = Vec::new();
    for (project_id, project_name) in input.projects {
        let branches: Vec<Branch> = input
            .branches
            .iter()
            .filter(|b| b.project_id == *project_id)
            .cloned()
            .collect();
        let tasks: Vec<Task> = input
            .tasks
            .iter()
            .filter(|t| t.project_id == *project_id)
            .cloned()
            .collect();
        let deps: Vec<TaskDependency> = input
            .dependencies
            .iter()
            .filter(|d| tasks.iter().any(|t| t.id == d.task_id))
            .cloned()
            .collect();

        for mut rec in compute_recommendations(&branches, &tasks, &deps) {
            rec.project_id = Some(project_id.clone());
            rec.project_name = Some(project_name.clone());
            all_recommendations.push(rec);
        }
    }
    all_recommendations.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.task.title.cmp(&b.task.title))
    });

    let assigned_task_ids: std::collections::HashSet<String> = input
        .lane_tasks
        .iter()
        .map(|(_, task_id, _)| task_id.clone())
        .collect();

    let mut lane_snapshots: Vec<DayLaneSnapshot> = Vec::new();
    let mut remaining_minutes = 0i32;
    let mut remaining_count = 0i32;

    for lane in input.lanes {
        let mut lane_task_rows: Vec<(String, i32)> = input
            .lane_tasks
            .iter()
            .filter(|(lane_id, _, _)| lane_id == &lane.id)
            .map(|(_, task_id, sort_order)| (task_id.clone(), *sort_order))
            .collect();
        lane_task_rows.sort_by_key(|(_, order)| *order);

        let lane_tasks: Vec<TodayTaskContext> = lane_task_rows
            .iter()
            .filter_map(|(task_id, _)| task_map.get(task_id.as_str()).copied())
            .filter(|t| t.status != TaskStatus::Done)
            .map(wrap_context)
            .collect();

        // Only track focus-active tasks in active_task_id; external delegated/review tasks
        // run independently and should not occupy the focus slot.
        let active_task_id = lane_tasks
            .iter()
            .find(|t| is_focus_active(&t.task))
            .map(|t| t.task.id.clone());

        let completed_in_lane = input
            .lane_tasks
            .iter()
            .filter(|(lane_id, _, _)| lane_id == &lane.id)
            .filter_map(|(_, task_id, _)| task_map.get(task_id.as_str()).copied())
            .filter(|t| t.status == TaskStatus::Done)
            .count() as i32;

        let total_in_lane = lane_tasks.len() as i32 + completed_in_lane;

        let lane_remaining: i32 = lane_tasks
            .iter()
            .map(|t| t.task.estimated_minutes.unwrap_or(DEFAULT_ESTIMATE_MINUTES))
            .sum();
        remaining_minutes += lane_remaining;
        remaining_count += lane_tasks.len() as i32;

        let estimated_finish = if lane_remaining > 0 {
            Some(format_time(add_minutes_to_time(
                Local::now().time(),
                lane_remaining,
            )))
        } else {
            None
        };

        lane_snapshots.push(DayLaneSnapshot {
            lane: lane.clone(),
            tasks: lane_tasks,
            active_task_id,
            completed_count: completed_in_lane,
            total_count: total_in_lane,
            estimated_finish_time: estimated_finish,
        });
    }

    let backlog: Vec<TodayTaskContext> = input
        .tasks
        .iter()
        .filter(|t| {
            matches!(t.status, TaskStatus::Ready | TaskStatus::Pending)
                && !assigned_task_ids.contains(&t.id)
        })
        .map(wrap_context)
        .collect();

    let backlog_minutes: i32 = backlog
        .iter()
        .map(|t| t.task.estimated_minutes.unwrap_or(DEFAULT_ESTIMATE_MINUTES))
        .sum();
    remaining_minutes += backlog_minutes;
    remaining_count += backlog.len() as i32;

    let available_minutes = minutes_until_day_end(input.day_end_time);
    let estimated_finish = if remaining_minutes > 0 {
        Some(format_time(add_minutes_to_time(
            Local::now().time(),
            remaining_minutes,
        )))
    } else {
        None
    };

    // Count focus lanes that have an actively worked-on task (not just any focus lane).
    // This gives an honest "parallel mode" indicator rather than a lane-count badge.
    let focus_lane_count = lane_snapshots
        .iter()
        .filter(|ls| ls.lane.lane_type == DayLaneType::Focus && ls.active_task_id.is_some())
        .count() as i32;

    let time_budget = TimeBudget {
        remaining_minutes,
        available_minutes,
        estimated_finish_time: estimated_finish,
        completed_count: completed_today.len() as i32,
        remaining_count,
    };

    let mut runway_task_ids: std::collections::HashSet<String> = assigned_task_ids.clone();
    for ctx in &backlog {
        runway_task_ids.insert(ctx.task.id.clone());
    }

    let runway_dependencies: Vec<TaskDependency> = input
        .dependencies
        .iter()
        .filter(|d| {
            runway_task_ids.contains(&d.task_id)
                && runway_task_ids.contains(&d.depends_on_task_id)
        })
        .cloned()
        .collect();

    DayRunwaySnapshot {
        date: input.date.to_string(),
        lanes: lane_snapshots,
        backlog,
        completed_today,
        recommendations: all_recommendations,
        dependencies: runway_dependencies,
        time_budget,
        day_end_time: input.day_end_time.to_string(),
        carry_over_count: input.carry_over_count,
        focus_lane_count,
        enabled_lane_count: input.enabled_lane_count,
    }
}

pub fn is_external_active(task: &Task) -> bool {
    task.task_type == TaskType::External
        && task
            .external_status
            .as_ref()
            .is_some_and(|s| *s == ExternalStatus::Delegated || *s == ExternalStatus::NeedsReview)
}

/// A focus-active task is one the user is actively working on (not delegated externally).
pub fn is_focus_active(task: &Task) -> bool {
    task.status == TaskStatus::Active && !is_external_active(task)
}

pub fn needs_review_count(tasks: &[Task]) -> i32 {
    tasks
        .iter()
        .filter(|t| {
            t.task_type == TaskType::External
                && t.external_status.as_ref() == Some(&ExternalStatus::NeedsReview)
        })
        .count() as i32
}
