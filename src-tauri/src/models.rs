use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Inbox,
    Pending,
    Ready,
    Active,
    Done,
}

impl TaskStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Inbox => "inbox",
            Self::Pending => "pending",
            Self::Ready => "ready",
            Self::Active => "active",
            Self::Done => "done",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "inbox" => Some(Self::Inbox),
            "pending" => Some(Self::Pending),
            "ready" => Some(Self::Ready),
            "active" => Some(Self::Active),
            "done" => Some(Self::Done),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub source_type: String,
    pub source_ref: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Branch {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub sort_order: i32,
    pub archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub project_id: String,
    pub branch_id: Option<String>,
    pub title: String,
    pub description: String,
    pub status: TaskStatus,
    pub sort_order: i32,
    pub pinned: bool,
    pub estimated_minutes: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDependency {
    pub task_id: String,
    pub depends_on_task_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGraph {
    pub project: Project,
    pub branches: Vec<Branch>,
    pub tasks: Vec<Task>,
    pub dependencies: Vec<TaskDependency>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub active_count: i32,
    pub ready_count: i32,
    pub done_count: i32,
    pub task_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskWithBranch {
    pub task: Task,
    pub branch_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendedTask {
    pub task: Task,
    pub branch_name: Option<String>,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub score: f64,
    pub blocked_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
    pub project_id: String,
    pub project_name: String,
    pub active_task: Option<TaskWithBranch>,
    pub ready_tasks: Vec<TaskWithBranch>,
    pub recommendations: Vec<RecommendedTask>,
    pub inbox_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteTaskResult {
    pub completed_task: Task,
    pub recommendations: Vec<RecommendedTask>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchSuggestion {
    pub branch_id: String,
    pub branch_name: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskResult {
    pub task: Task,
    pub branch_suggestion: Option<BranchSuggestion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayTaskContext {
    pub task: Task,
    pub project_id: String,
    pub project_name: String,
    pub branch_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayScheduleItem {
    pub task: Task,
    pub project_id: String,
    pub project_name: String,
    pub branch_name: Option<String>,
    pub estimated_minutes: i32,
    pub scheduled_start: String,
    pub scheduled_end: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeBudget {
    pub remaining_minutes: i32,
    pub available_minutes: i32,
    pub estimated_finish_time: Option<String>,
    pub completed_count: i32,
    pub remaining_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodaySnapshot {
    pub active_task: Option<TodayTaskContext>,
    pub schedule: Vec<TodayScheduleItem>,
    pub completed_today: Vec<TodayTaskContext>,
    pub recommendations: Vec<RecommendedTask>,
    pub time_budget: TimeBudget,
    pub day_end_time: String,
}
