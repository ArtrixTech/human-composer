use chrono::{DateTime, Local, NaiveTime, Timelike, Utc};

use crate::models::{
    Branch, RecommendedTask, Task, TaskDependency, TaskStatus, TimeBudget, TodayScheduleItem,
    TodaySnapshot, TodayTaskContext,
};
use crate::recommend::compute_recommendations;

pub const DEFAULT_DAY_END: &str = "22:00";
pub const DEFAULT_ESTIMATE_MINUTES: i32 = 30;

pub fn build_today_snapshot(
    projects: &[(String, String)],
    all_branches: &[Branch],
    all_tasks: &[Task],
    all_dependencies: &[TaskDependency],
    day_end_time: &str,
) -> TodaySnapshot {
    let branch_map: std::collections::HashMap<&str, &Branch> = all_branches
        .iter()
        .map(|b| (b.id.as_str(), b))
        .collect();
    let project_map: std::collections::HashMap<&str, &str> = projects
        .iter()
        .map(|(id, name)| (id.as_str(), name.as_str()))
        .collect();

    let wrap_context = |task: &Task| -> Option<TodayTaskContext> {
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
        Some(TodayTaskContext {
            task: task.clone(),
            project_id: task.project_id.clone(),
            project_name,
            branch_name,
        })
    };

    let today_start = Local::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
    let today_start_utc: DateTime<Utc> = today_start.and_local_timezone(Local).unwrap().into();

    let active_task = all_tasks
        .iter()
        .find(|t| t.status == TaskStatus::Active)
        .and_then(wrap_context);

    let completed_today: Vec<TodayTaskContext> = all_tasks
        .iter()
        .filter(|t| {
            t.status == TaskStatus::Done
                && t.completed_at
                    .map(|c| c >= today_start_utc)
                    .unwrap_or(false)
        })
        .filter_map(wrap_context)
        .collect();

    let mut all_recommendations: Vec<RecommendedTask> = Vec::new();
    for (project_id, project_name) in projects {
        let branches: Vec<Branch> = all_branches
            .iter()
            .filter(|b| b.project_id == *project_id)
            .cloned()
            .collect();
        let tasks: Vec<Task> = all_tasks
            .iter()
            .filter(|t| t.project_id == *project_id)
            .cloned()
            .collect();
        let deps: Vec<TaskDependency> = all_dependencies
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

    let ready_ordered: Vec<&Task> = all_recommendations
        .iter()
        .map(|r| &r.task)
        .filter(|t| t.status == TaskStatus::Ready)
        .collect();

    let schedule = build_schedule(&ready_ordered, &branch_map, &project_map);

    let active_mins = active_task
        .as_ref()
        .map(|a| a.task.estimated_minutes.unwrap_or(DEFAULT_ESTIMATE_MINUTES))
        .unwrap_or(0);
    let remaining_minutes: i32 =
        active_mins + schedule.iter().map(|s| s.estimated_minutes).sum::<i32>();

    let available_minutes = minutes_until_day_end(day_end_time);
    let estimated_finish = estimate_finish_time(
        if active_task.is_some() {
            Some(active_mins)
        } else {
            None
        },
        &schedule,
    );

    let time_budget = TimeBudget {
        remaining_minutes,
        available_minutes,
        estimated_finish_time: estimated_finish,
        completed_count: completed_today.len() as i32,
        remaining_count: schedule.len() as i32 + if active_task.is_some() { 1 } else { 0 },
    };

    TodaySnapshot {
        active_task,
        schedule,
        completed_today,
        recommendations: all_recommendations,
        time_budget,
        day_end_time: day_end_time.to_string(),
    }
}

fn build_schedule(
    ready_tasks: &[&Task],
    branch_map: &std::collections::HashMap<&str, &Branch>,
    project_map: &std::collections::HashMap<&str, &str>,
) -> Vec<TodayScheduleItem> {
    let mut cursor = Local::now().time();
    let mut items = Vec::new();
    for task in ready_tasks {
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
        let est = task.estimated_minutes.unwrap_or(DEFAULT_ESTIMATE_MINUTES);
        let start = cursor;
        let end = add_minutes_to_time(start, est);
        cursor = end;

        items.push(TodayScheduleItem {
            task: (*task).clone(),
            project_id: task.project_id.clone(),
            project_name,
            branch_name,
            estimated_minutes: est,
            scheduled_start: format_time(start),
            scheduled_end: format_time(end),
        });
    }
    items
}

pub fn minutes_until_day_end(day_end_time: &str) -> i32 {
    let end = parse_time(day_end_time).unwrap_or_else(|| NaiveTime::from_hms_opt(22, 0, 0).unwrap());
    let now = Local::now().time();
    let now_mins = now.hour() as i32 * 60 + now.minute() as i32;
    let end_mins = end.hour() as i32 * 60 + end.minute() as i32;
    (end_mins - now_mins).max(0)
}

fn estimate_finish_time(
    active_minutes: Option<i32>,
    schedule: &[TodayScheduleItem],
) -> Option<String> {
    let total: i32 = active_minutes.unwrap_or(0)
        + schedule.iter().map(|s| s.estimated_minutes).sum::<i32>();
    if total <= 0 {
        return None;
    }
    let finish = add_minutes_to_time(Local::now().time(), total);
    Some(format_time(finish))
}

fn parse_time(s: &str) -> Option<NaiveTime> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let h: u32 = parts[0].parse().ok()?;
    let m: u32 = parts[1].parse().ok()?;
    NaiveTime::from_hms_opt(h, m, 0)
}

pub fn format_time(t: NaiveTime) -> String {
    format!("{:02}:{:02}", t.hour(), t.minute())
}

pub fn add_minutes_to_time(t: NaiveTime, minutes: i32) -> NaiveTime {
    let total = t.hour() as i32 * 60 + t.minute() as i32 + minutes;
    let h = ((total / 60) % 24).max(0) as u32;
    let m = (total % 60).max(0) as u32;
    NaiveTime::from_hms_opt(h, m, 0).unwrap_or(t)
}
