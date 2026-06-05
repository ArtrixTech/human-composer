use std::path::Path;

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::models::{
    AppSnapshot, Branch, DayLane, DayLaneTask, DayLaneType, DayRunwaySnapshot, ExternalStatus,
    Project, ProjectGraph, ProjectSummary, RecommendedTask, Task, TaskDependency, TaskStatus,
    TaskType, TaskWithBranch, TodaySnapshot,
};
use crate::recommend::compute_recommendations;
use crate::runway::{self, local_date_string, previous_date_string, RunwayBuildInput};
use crate::today::{self, DEFAULT_DAY_END};

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(path)?;
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;",
        )?;

        let db = Self { conn };
        db.migrate()?;
        db.seed_if_empty()?;
        Ok(db)
    }

    fn migrate(&self) -> rusqlite::Result<()> {
        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                source_type TEXT NOT NULL DEFAULT 'manual',
                source_ref TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS branches (
                id TEXT PRIMARY KEY NOT NULL,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                archived INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY NOT NULL,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                completed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS task_dependencies (
                task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                PRIMARY KEY (task_id, depends_on_task_id)
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS day_lanes (
                id TEXT PRIMARY KEY NOT NULL,
                date TEXT NOT NULL,
                name TEXT NOT NULL,
                lane_type TEXT NOT NULL DEFAULT 'focus',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS day_lane_tasks (
                id TEXT PRIMARY KEY NOT NULL,
                lane_id TEXT NOT NULL REFERENCES day_lanes(id) ON DELETE CASCADE,
                task_id TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                UNIQUE(lane_id, task_id)
            );
            ",
        )?;

        self.ensure_column("tasks", "pinned", "INTEGER NOT NULL DEFAULT 0")?;
        self.ensure_column("tasks", "project_id", "TEXT")?;
        self.ensure_column("tasks", "estimated_minutes", "INTEGER DEFAULT 30")?;
        self.ensure_column("tasks", "task_type", "TEXT NOT NULL DEFAULT 'normal'")?;
        self.ensure_column("tasks", "external_status", "TEXT")?;
        self.ensure_column("tasks", "external_started_at", "TEXT")?;
        self.ensure_column("tasks", "external_completed_at", "TEXT")?;
        self.ensure_column("tasks", "external_note", "TEXT")?;
        self.ensure_column("tasks", "priority", "INTEGER")?;
        self.ensure_column("tasks", "archived", "INTEGER NOT NULL DEFAULT 0")?;
        self.ensure_column("tasks", "postponed", "INTEGER NOT NULL DEFAULT 0")?;

        if self.get_setting("day_end_time")?.is_none() {
            self.set_setting("day_end_time", DEFAULT_DAY_END)?;
        }

        Ok(())
    }

    fn map_task_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Task> {
        let status_str: String = row.get(5)?;
        let task_type_str: String = row.get(11)?;
        let external_status_str: Option<String> = row.get(12)?;
        Ok(Task {
            id: row.get(0)?,
            project_id: row.get(1)?,
            branch_id: row.get(2)?,
            title: row.get(3)?,
            description: row.get(4)?,
            status: TaskStatus::from_str(&status_str).unwrap_or(TaskStatus::Pending),
            sort_order: row.get(6)?,
            pinned: row.get::<_, i32>(7)? != 0,
            estimated_minutes: row.get(8)?,
            created_at: row.get::<_, String>(9)?.parse().unwrap_or_else(|_| Utc::now()),
            completed_at: row.get::<_, Option<String>>(10)?.and_then(|s| s.parse().ok()),
            task_type: TaskType::from_str(&task_type_str),
            external_status: external_status_str
                .as_deref()
                .and_then(ExternalStatus::from_str),
            external_started_at: row.get::<_, Option<String>>(13)?.and_then(|s| s.parse().ok()),
            external_completed_at: row.get::<_, Option<String>>(14)?.and_then(|s| s.parse().ok()),
            external_note: row.get(15)?,
            priority: row.get(16)?,
            archived: row.get::<_, i32>(17)? != 0,
            postponed: row.get::<_, i32>(18)? != 0,
        })
    }

    const TASK_SELECT: &'static str = "SELECT id, project_id, branch_id, title, description, status,
                    sort_order, pinned, estimated_minutes, created_at, completed_at,
                    task_type, external_status, external_started_at, external_completed_at, external_note,
                    priority, archived, postponed";

    fn ensure_column(&self, table: &str, column: &str, definition: &str) -> rusqlite::Result<()> {
        let mut stmt = self
            .conn
            .prepare(&format!("PRAGMA table_info({table})"))?;
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .filter_map(|r| r.ok())
            .collect();

        if !columns.iter().any(|c| c == column) {
            self.conn.execute(
                &format!("ALTER TABLE {table} ADD COLUMN {column} {definition}"),
                [],
            )?;
        }
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> rusqlite::Result<Option<String>> {
        self.conn
            .query_row(
                "SELECT value FROM app_settings WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()
            .map(|r| r.flatten())
    }

    pub fn set_setting(&self, key: &str, value: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    fn seed_if_empty(&self) -> rusqlite::Result<()> {
        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))?;

        if count > 0 {
            return Ok(());
        }

        let project_id = self.create_project("Human Composer 开发")?;
        let frontend = self.create_branch(&project_id, "前端")?;
        let backend = self.create_branch(&project_id, "后端")?;
        let deploy = self.create_branch(&project_id, "部署")?;

        let login = self.create_task_in_branch(&project_id, &frontend, "登录页面", 0)?;
        let dashboard = self.create_task_in_branch(&project_id, &frontend, "Dashboard", 1)?;
        let chart = self.create_task_in_branch(&project_id, &frontend, "图表组件", 2)?;

        let user_api = self.create_task_in_branch(&project_id, &backend, "用户 API", 0)?;
        let auth = self.create_task_in_branch(&project_id, &backend, "认证中间件", 1)?;

        let ci = self.create_task_in_branch(&project_id, &deploy, "CI 配置", 0)?;
        let first_deploy = self.create_task_in_branch(&project_id, &deploy, "首次部署", 1)?;

        self.add_dependency(&dashboard, &login)?;
        self.add_dependency(&chart, &dashboard)?;
        self.add_dependency(&auth, &user_api)?;
        self.add_dependency(&first_deploy, &ci)?;
        self.add_dependency(&first_deploy, &auth)?;

        self.set_task_status(&login, TaskStatus::Done)?;
        self.set_task_status(&user_api, TaskStatus::Done)?;
        self.set_task_status(&auth, TaskStatus::Done)?;
        self.set_task_status(&dashboard, TaskStatus::Active)?;

        self.recalculate_project_statuses(&project_id)?;
        self.set_setting("active_project_id", &project_id)?;
        Ok(())
    }

    pub fn list_projects(&self) -> rusqlite::Result<Vec<ProjectSummary>> {
        let mut stmt = self.conn.prepare(
            "SELECT p.id, p.name,
                    COALESCE(SUM(CASE WHEN t.status = 'active' THEN 1 ELSE 0 END), 0) AS active_count,
                    COALESCE(SUM(CASE WHEN t.status = 'ready' THEN 1 ELSE 0 END), 0) AS ready_count,
                    COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0) AS done_count,
                    COALESCE(SUM(CASE WHEN t.status != 'inbox' THEN 1 ELSE 0 END), 0) AS task_count
             FROM projects p
             LEFT JOIN branches b ON b.project_id = p.id AND b.archived = 0
             LEFT JOIN tasks t ON t.branch_id = b.id
             GROUP BY p.id
             ORDER BY p.created_at ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(ProjectSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                active_count: row.get(2)?,
                ready_count: row.get(3)?,
                done_count: row.get(4)?,
                task_count: row.get(5)?,
            })
        })?;

        rows.collect()
    }

    pub fn list_archived_branches(&self, project_id: &str) -> rusqlite::Result<Vec<Branch>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, project_id, name, sort_order, archived
             FROM branches WHERE project_id = ?1 AND archived = 1
             ORDER BY sort_order ASC",
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(Branch {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                sort_order: row.get(3)?,
                archived: row.get::<_, i32>(4)? != 0,
            })
        })?;
        rows.collect()
    }

    pub fn create_project(&self, name: &str) -> rusqlite::Result<String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO projects (id, name, source_type, created_at) VALUES (?1, ?2, 'manual', ?3)",
            params![id, name, now],
        )?;
        Ok(id)
    }

    pub fn create_branch(&self, project_id: &str, name: &str) -> rusqlite::Result<String> {
        let id = Uuid::new_v4().to_string();
        let sort_order: i32 = self.conn.query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM branches WHERE project_id = ?1",
            params![project_id],
            |row| row.get(0),
        )?;

        self.conn.execute(
            "INSERT INTO branches (id, project_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![id, project_id, name, sort_order],
        )?;
        Ok(id)
    }

    pub fn create_task_in_branch(
        &self,
        project_id: &str,
        branch_id: &str,
        title: &str,
        sort_order: i32,
    ) -> rusqlite::Result<String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO tasks (id, project_id, branch_id, title, status, sort_order, created_at)
             VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6)",
            params![id, project_id, branch_id, title, sort_order, now],
        )?;
        Ok(id)
    }

    pub fn append_task_to_branch(&self, project_id: &str, branch_id: &str, title: &str) -> rusqlite::Result<String> {
        let sort_order: i32 = self.conn.query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks WHERE branch_id = ?1",
            params![branch_id],
            |row| row.get(0),
        )?;
        self.create_task_in_branch(project_id, branch_id, title, sort_order)
    }

    pub fn create_inbox_task(&self, project_id: &str, title: &str) -> rusqlite::Result<String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO tasks (id, project_id, branch_id, title, status, sort_order, created_at)
             VALUES (?1, ?2, NULL, ?3, 'inbox', 0, ?4)",
            params![id, project_id, title, now],
        )?;
        Ok(id)
    }

    pub fn add_dependency(&self, task_id: &str, depends_on_task_id: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id) VALUES (?1, ?2)",
            params![task_id, depends_on_task_id],
        )?;
        Ok(())
    }

    pub fn get_project_graph(&self, project_id: &str) -> rusqlite::Result<ProjectGraph> {
        self.recalculate_project_statuses(project_id)?;

        let project = self.get_project(project_id)?;
        let branches = self.get_branches(project_id)?;
        let tasks = self.get_tasks_for_project(project_id)?;
        let dependencies = self.get_dependencies_for_project(project_id)?;

        Ok(ProjectGraph {
            project,
            branches,
            tasks,
            dependencies,
        })
    }

    fn get_project(&self, project_id: &str) -> rusqlite::Result<Project> {
        self.conn.query_row(
            "SELECT id, name, source_type, source_ref, created_at FROM projects WHERE id = ?1",
            params![project_id],
            |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    source_type: row.get(2)?,
                    source_ref: row.get(3)?,
                    created_at: row.get::<_, String>(4)?.parse().unwrap_or_else(|_| Utc::now()),
                })
            },
        )
    }

    fn get_branches(&self, project_id: &str) -> rusqlite::Result<Vec<Branch>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, project_id, name, sort_order, archived
             FROM branches WHERE project_id = ?1 AND archived = 0
             ORDER BY sort_order ASC",
        )?;

        let rows = stmt.query_map(params![project_id], |row| {
            Ok(Branch {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                sort_order: row.get(3)?,
                archived: row.get::<_, i32>(4)? != 0,
            })
        })?;

        rows.collect()
    }

    fn get_tasks_for_project(&self, project_id: &str) -> rusqlite::Result<Vec<Task>> {
        let mut stmt = self.conn.prepare(
            &format!(
                "{} FROM tasks t WHERE t.project_id = ?1 AND t.archived = 0
                 ORDER BY CASE WHEN t.priority IS NULL THEN 1 ELSE 0 END,
                          t.priority ASC, t.sort_order ASC, t.created_at ASC",
                Self::TASK_SELECT
            ),
        )?;

        let rows = stmt.query_map(params![project_id], Self::map_task_row)?;
        rows.collect()
    }

    pub fn get_archived_tasks_for_project(&self, project_id: &str) -> rusqlite::Result<Vec<Task>> {
        let mut stmt = self.conn.prepare(
            &format!(
                "{} FROM tasks t WHERE t.project_id = ?1 AND t.archived = 1
                 ORDER BY t.created_at DESC",
                Self::TASK_SELECT
            ),
        )?;
        let rows = stmt.query_map(params![project_id], Self::map_task_row)?;
        rows.collect()
    }

    fn get_dependencies_for_project(&self, project_id: &str) -> rusqlite::Result<Vec<TaskDependency>> {
        let mut stmt = self.conn.prepare(
            "SELECT td.task_id, td.depends_on_task_id
             FROM task_dependencies td
             JOIN tasks t ON td.task_id = t.id
             JOIN tasks d ON td.depends_on_task_id = d.id
             WHERE t.project_id = ?1 AND t.archived = 0 AND d.archived = 0",
        )?;

        let rows = stmt.query_map(params![project_id], |row| {
            Ok(TaskDependency {
                task_id: row.get(0)?,
                depends_on_task_id: row.get(1)?,
            })
        })?;

        rows.collect()
    }

    pub fn update_task(
        &self,
        task_id: &str,
        title: Option<&str>,
        description: Option<&str>,
    ) -> rusqlite::Result<Task> {
        if let Some(t) = title {
            self.conn.execute(
                "UPDATE tasks SET title = ?1 WHERE id = ?2",
                params![t, task_id],
            )?;
        }
        if let Some(d) = description {
            self.conn.execute(
                "UPDATE tasks SET description = ?1 WHERE id = ?2",
                params![d, task_id],
            )?;
        }
        self.get_task(task_id)
    }

    pub fn delete_task(&self, task_id: &str) -> rusqlite::Result<()> {
        self.conn
            .execute("DELETE FROM tasks WHERE id = ?1", params![task_id])?;
        Ok(())
    }

    pub fn set_task_status(&self, task_id: &str, status: TaskStatus) -> rusqlite::Result<Task> {
        let completed_at = if status == TaskStatus::Done {
            Some(Utc::now().to_rfc3339())
        } else {
            None
        };

        if status == TaskStatus::Done {
            self.conn.execute(
                "UPDATE tasks SET status = ?1, completed_at = ?2, postponed = 0 WHERE id = ?3",
                params![status.as_str(), completed_at, task_id],
            )?;
        } else if status == TaskStatus::Active {
            self.conn.execute(
                "UPDATE tasks SET status = ?1, completed_at = NULL, postponed = 0 WHERE id = ?2",
                params![status.as_str(), task_id],
            )?;
        } else {
            self.conn.execute(
                "UPDATE tasks SET status = ?1, completed_at = NULL WHERE id = ?2",
                params![status.as_str(), task_id],
            )?;
        }

        let _previous = self.get_task(task_id)?;
        if let Ok(project_id) = self.project_id_for_task(task_id) {
            let _ = self.recalculate_project_statuses(&project_id);
        }
        self.get_task(task_id)
    }

    pub fn get_task(&self, task_id: &str) -> rusqlite::Result<Task> {
        self.conn.query_row(
            &format!("{} FROM tasks WHERE id = ?1", Self::TASK_SELECT),
            params![task_id],
            Self::map_task_row,
        )
    }

    pub fn project_id_for_branch(&self, branch_id: &str) -> rusqlite::Result<String> {
        self.conn.query_row(
            "SELECT project_id FROM branches WHERE id = ?1",
            params![branch_id],
            |row| row.get(0),
        )
    }

    pub fn recalculate_project_statuses(&self, project_id: &str) -> rusqlite::Result<()> {
        let tasks = self.get_tasks_for_project(project_id)?;
        let dependencies = self.get_dependencies_for_project(project_id)?;

        for task in &tasks {
            if task.status == TaskStatus::Inbox
                || task.status == TaskStatus::Active
                || task.status == TaskStatus::Done
            {
                continue;
            }

            let has_unfinished_dep = dependencies
                .iter()
                .filter(|d| d.task_id == task.id)
                .any(|d| {
                    tasks
                        .iter()
                        .find(|t| t.id == d.depends_on_task_id)
                        .map(|t| t.status != TaskStatus::Done)
                        .unwrap_or(false)
                });

            let new_status = if has_unfinished_dep {
                TaskStatus::Pending
            } else {
                TaskStatus::Ready
            };

            if task.status != new_status {
                self.conn.execute(
                    "UPDATE tasks SET status = ?1 WHERE id = ?2",
                    params![new_status.as_str(), task.id],
                )?;
            }
        }

        Ok(())
    }

    pub fn activate_task(&self, task_id: &str, _project_id: &str) -> rusqlite::Result<Task> {
        if let Ok(lane_id) = self.lane_id_for_task_on_date(task_id, &local_date_string()) {
            return self.claim_task(task_id, &lane_id);
        }
        self.conn.execute(
            "UPDATE tasks SET status = 'ready' WHERE status = 'active'",
            [],
        )?;
        self.set_task_status(task_id, TaskStatus::Active)
    }

    pub fn claim_task(&self, task_id: &str, lane_id: &str) -> rusqlite::Result<Task> {
        let lane_task_ids: Vec<String> = self.get_lane_task_ids(lane_id)?;
        for other_id in lane_task_ids {
            if other_id != task_id {
                let task = self.get_task(&other_id)?;
                // Do not pause externally-delegated or needs-review tasks; they run independently
                if task.status == TaskStatus::Active && !runway::is_external_active(&task) {
                    self.set_task_status(&other_id, TaskStatus::Ready)?;
                    self.set_task_postponed(&other_id, true)?;
                }
            }
        }
        self.set_task_postponed(task_id, false)?;
        self.set_task_status(task_id, TaskStatus::Active)
    }

    pub fn postpone_task(&self, task_id: &str, lane_id: &str) -> rusqlite::Result<Task> {
        let lane_task_ids = self.get_lane_task_ids(lane_id)?;
        if !lane_task_ids.iter().any(|id| id == task_id) {
            return Err(rusqlite::Error::InvalidParameterName(
                "task not in lane".into(),
            ));
        }
        let task = self.get_task(task_id)?;
        if task.status != TaskStatus::Active {
            return Err(rusqlite::Error::InvalidParameterName(
                "task is not active".into(),
            ));
        }
        if runway::is_external_active(&task) {
            return Err(rusqlite::Error::InvalidParameterName(
                "external tasks cannot be postponed".into(),
            ));
        }
        self.set_task_status(task_id, TaskStatus::Ready)?;
        self.set_task_postponed(task_id, true)?;
        self.get_task(task_id)
    }

    fn set_task_postponed(&self, task_id: &str, postponed: bool) -> rusqlite::Result<()> {
        self.conn.execute(
            "UPDATE tasks SET postponed = ?1 WHERE id = ?2",
            params![if postponed { 1 } else { 0 }, task_id],
        )?;
        Ok(())
    }

    pub fn assign_task_to_branch(&self, task_id: &str, branch_id: &str) -> rusqlite::Result<Task> {
        let project_id = self.project_id_for_branch(branch_id)?;
        let sort_order: i32 = self.conn.query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks WHERE branch_id = ?1",
            params![branch_id],
            |row| row.get(0),
        )?;

        self.conn.execute(
            "UPDATE tasks SET branch_id = ?1, status = 'pending', sort_order = ?2 WHERE id = ?3",
            params![branch_id, sort_order, task_id],
        )?;
        self.recalculate_project_statuses(&project_id)?;
        self.get_task(task_id)
    }

    pub fn remove_dependency(&self, task_id: &str, depends_on_task_id: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "DELETE FROM task_dependencies WHERE task_id = ?1 AND depends_on_task_id = ?2",
            params![task_id, depends_on_task_id],
        )?;
        if let Ok(task) = self.get_task(task_id) {
            if let Some(branch_id) = &task.branch_id {
                if let Ok(project_id) = self.project_id_for_branch(branch_id) {
                    let _ = self.recalculate_project_statuses(&project_id);
                }
            }
        }
        Ok(())
    }

    pub fn archive_branch(&self, branch_id: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "UPDATE branches SET archived = 1 WHERE id = ?1",
            params![branch_id],
        )?;
        Ok(())
    }

    pub fn delete_branch(&self, branch_id: &str) -> rusqlite::Result<()> {
        let task_ids: Vec<String> = self
            .conn
            .prepare("SELECT id FROM tasks WHERE branch_id = ?1")?
            .query_map(params![branch_id], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        for task_id in task_ids {
            self.conn.execute(
                "DELETE FROM day_lane_tasks WHERE task_id = ?1",
                params![task_id],
            )?;
            self.delete_task(&task_id)?;
        }
        self.conn
            .execute("DELETE FROM branches WHERE id = ?1", params![branch_id])?;
        Ok(())
    }

    pub fn reorder_branches(&self, project_id: &str, branch_ids: &[String]) -> rusqlite::Result<()> {
        for (i, branch_id) in branch_ids.iter().enumerate() {
            self.conn.execute(
                "UPDATE branches SET sort_order = ?1 WHERE id = ?2 AND project_id = ?3",
                params![i as i32, branch_id, project_id],
            )?;
        }
        Ok(())
    }

    pub fn set_task_priority(&self, task_id: &str, priority: Option<i32>) -> rusqlite::Result<Task> {
        if let Some(p) = priority {
            if !(1..=5).contains(&p) {
                return Err(rusqlite::Error::InvalidParameterName(
                    "priority must be 1-5".into(),
                ));
            }
        }
        self.conn.execute(
            "UPDATE tasks SET priority = ?1 WHERE id = ?2",
            params![priority, task_id],
        )?;
        self.get_task(task_id)
    }

    pub fn archive_task(&self, task_id: &str) -> rusqlite::Result<Task> {
        let task = self.get_task(task_id)?;
        if task.status == TaskStatus::Active {
            self.set_task_status(task_id, TaskStatus::Ready)?;
        }
        self.conn.execute(
            "DELETE FROM day_lane_tasks WHERE task_id = ?1",
            params![task_id],
        )?;
        self.conn
            .execute("UPDATE tasks SET archived = 1 WHERE id = ?1", params![task_id])?;
        if let Ok(project_id) = self.project_id_for_task(task_id) {
            let _ = self.recalculate_project_statuses(&project_id);
        }
        self.get_task(task_id)
    }

    pub fn unarchive_task(&self, task_id: &str) -> rusqlite::Result<Task> {
        self.conn
            .execute("UPDATE tasks SET archived = 0 WHERE id = ?1", params![task_id])?;
        if let Ok(project_id) = self.project_id_for_task(task_id) {
            let _ = self.recalculate_project_statuses(&project_id);
        }
        self.get_task(task_id)
    }

    pub fn reorder_branch_tasks(&self, branch_id: &str, task_ids: &[String]) -> rusqlite::Result<()> {
        for (i, task_id) in task_ids.iter().enumerate() {
            self.conn.execute(
                "UPDATE tasks SET sort_order = ?1 WHERE id = ?2 AND branch_id = ?3",
                params![i as i32, task_id, branch_id],
            )?;
        }
        Ok(())
    }

    pub fn set_task_pinned(&self, task_id: &str, pinned: bool) -> rusqlite::Result<Task> {
        self.conn.execute(
            "UPDATE tasks SET pinned = ?1 WHERE id = ?2",
            params![pinned as i32, task_id],
        )?;
        self.get_task(task_id)
    }

    pub fn complete_task(&self, task_id: &str, project_id: &str) -> rusqlite::Result<(Task, Vec<RecommendedTask>)> {
        let date = local_date_string();
        let source_lane = self.lane_id_for_task_on_date(task_id, &date).ok();
        let _previous = self.get_task(task_id)?;
        self.set_task_status(task_id, TaskStatus::Done)?;
        self.recalculate_project_statuses(project_id)?;
        if let Some(lane_id) = source_lane {
            self.append_newly_ready_to_lane(&lane_id, project_id, task_id)?;
        }
        let runway = self.build_day_runway_snapshot()?;
        let completed = self.get_task(task_id)?;
        Ok((completed, runway.recommendations))
    }

    pub fn build_app_snapshot(&self, project_id: &str) -> rusqlite::Result<AppSnapshot> {
        let graph = self.get_project_graph(project_id)?;
        let branch_map: std::collections::HashMap<String, String> = graph
            .branches
            .iter()
            .map(|b| (b.id.clone(), b.name.clone()))
            .collect();

        let mut recommendations =
            compute_recommendations(&graph.branches, &graph.tasks, &graph.dependencies);
        for rec in &mut recommendations {
            rec.project_id = Some(graph.project.id.clone());
            rec.project_name = Some(graph.project.name.clone());
        }

        let wrap = |task: &Task| TaskWithBranch {
            task: task.clone(),
            branch_name: task
                .branch_id
                .as_ref()
                .and_then(|id| branch_map.get(id).cloned()),
        };

        let active_task = graph
            .tasks
            .iter()
            .find(|t| t.status == TaskStatus::Active)
            .map(wrap);

        let ready_tasks: Vec<TaskWithBranch> = graph
            .tasks
            .iter()
            .filter(|t| t.status == TaskStatus::Ready)
            .map(wrap)
            .collect();

        let inbox_count = graph
            .tasks
            .iter()
            .filter(|t| t.status == TaskStatus::Inbox)
            .count() as i32;

        Ok(AppSnapshot {
            project_id: graph.project.id.clone(),
            project_name: graph.project.name.clone(),
            active_task,
            ready_tasks,
            recommendations,
            inbox_count,
        })
    }

    pub fn project_id_for_task(&self, task_id: &str) -> rusqlite::Result<String> {
        self.conn.query_row(
            "SELECT project_id FROM tasks WHERE id = ?1",
            params![task_id],
            |row| row.get(0),
        )
    }

    pub fn get_active_project_id(&self) -> rusqlite::Result<Option<String>> {
        self.get_setting("active_project_id")
    }

    pub fn set_active_project_id(&self, project_id: &str) -> rusqlite::Result<()> {
        self.set_setting("active_project_id", project_id)
    }

    pub fn get_all_tasks(&self) -> rusqlite::Result<Vec<Task>> {
        let mut stmt = self.conn.prepare(
            &format!(
                "{} FROM tasks WHERE archived = 0 ORDER BY sort_order ASC, created_at ASC",
                Self::TASK_SELECT
            ),
        )?;
        let rows = stmt.query_map([], Self::map_task_row)?;
        rows.collect()
    }

    pub fn get_all_branches(&self) -> rusqlite::Result<Vec<Branch>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, project_id, name, sort_order, archived FROM branches ORDER BY sort_order ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Branch {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                sort_order: row.get(3)?,
                archived: row.get::<_, i32>(4)? != 0,
            })
        })?;
        rows.collect()
    }

    pub fn get_all_dependencies(&self) -> rusqlite::Result<Vec<TaskDependency>> {
        let mut stmt = self
            .conn
            .prepare("SELECT task_id, depends_on_task_id FROM task_dependencies")?;
        let rows = stmt.query_map([], |row| {
            Ok(TaskDependency {
                task_id: row.get(0)?,
                depends_on_task_id: row.get(1)?,
            })
        })?;
        rows.collect()
    }

    pub fn build_today_snapshot(&self) -> rusqlite::Result<TodaySnapshot> {
        let runway = self.build_day_runway_snapshot()?;
        Ok(today_snapshot_from_runway(&runway))
    }

    pub fn build_day_runway_snapshot(&self) -> rusqlite::Result<DayRunwaySnapshot> {
        let date = local_date_string();
        self.sync_day_runway(&date)?;
        let carry_over_count = self
            .get_setting(&format!("carry_over_{date}"))?
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        let projects_raw = self.list_projects()?;
        let projects: Vec<(String, String)> = projects_raw
            .into_iter()
            .map(|p| (p.id, p.name))
            .collect();
        let branches = self.get_all_branches()?;
        let tasks = self.get_all_tasks()?;
        let dependencies = self.get_all_dependencies()?;
        let lanes = self.get_lanes_for_date(&date)?;
        let lane_tasks = self.get_all_lane_tasks_for_date(&date)?;
        let day_end = self
            .get_setting("day_end_time")?
            .unwrap_or_else(|| DEFAULT_DAY_END.to_string());

        Ok(runway::build_day_runway_snapshot(RunwayBuildInput {
            date: &date,
            lanes: &lanes,
            lane_tasks: &lane_tasks,
            projects: &projects,
            branches: &branches,
            tasks: &tasks,
            dependencies: &dependencies,
            day_end_time: &day_end,
            carry_over_count,
        }))
    }

    pub fn set_task_estimated_minutes(
        &self,
        task_id: &str,
        minutes: i32,
    ) -> rusqlite::Result<Task> {
        self.conn.execute(
            "UPDATE tasks SET estimated_minutes = ?1 WHERE id = ?2",
            params![minutes, task_id],
        )?;
        self.get_task(task_id)
    }

    pub fn rename_branch(&self, branch_id: &str, name: &str) -> rusqlite::Result<Branch> {
        self.conn.execute(
            "UPDATE branches SET name = ?1 WHERE id = ?2",
            params![name, branch_id],
        )?;
        self.get_branch(branch_id)
    }

    pub fn unarchive_branch(&self, branch_id: &str) -> rusqlite::Result<Branch> {
        self.conn.execute(
            "UPDATE branches SET archived = 0 WHERE id = ?1",
            params![branch_id],
        )?;
        self.get_branch(branch_id)
    }

    pub fn get_branch(&self, branch_id: &str) -> rusqlite::Result<Branch> {
        self.conn.query_row(
            "SELECT id, project_id, name, sort_order, archived FROM branches WHERE id = ?1",
            params![branch_id],
            |row| {
                Ok(Branch {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    sort_order: row.get(3)?,
                    archived: row.get::<_, i32>(4)? != 0,
                })
            },
        )
    }

    pub fn delete_project(&self, project_id: &str) -> rusqlite::Result<()> {
        self.conn
            .execute("DELETE FROM projects WHERE id = ?1", params![project_id])?;
        Ok(())
    }

    pub fn reorder_task(&self, task_id: &str, direction: &str) -> rusqlite::Result<Task> {
        let task = self.get_task(task_id)?;
        let branch_id = task
            .branch_id
            .as_deref()
            .ok_or(rusqlite::Error::InvalidQuery)?;
        let mut siblings: Vec<Task> = self
            .get_tasks_for_project(&task.project_id)?
            .into_iter()
            .filter(|t| t.branch_id.as_deref() == Some(branch_id))
            .collect();
        siblings.sort_by_key(|t| t.sort_order);
        let idx = siblings
            .iter()
            .position(|t| t.id == task_id)
            .ok_or(rusqlite::Error::InvalidQuery)?;
        let swap_idx = match direction {
            "up" if idx > 0 => idx - 1,
            "down" if idx + 1 < siblings.len() => idx + 1,
            _ => return Ok(task),
        };
        let a = siblings[idx].sort_order;
        let b = siblings[swap_idx].sort_order;
        self.conn.execute(
            "UPDATE tasks SET sort_order = ?1 WHERE id = ?2",
            params![b, siblings[idx].id],
        )?;
        self.conn.execute(
            "UPDATE tasks SET sort_order = ?1 WHERE id = ?2",
            params![a, siblings[swap_idx].id],
        )?;
        self.get_task(task_id)
    }

    pub fn list_project_tasks_for_dependency(&self, project_id: &str) -> rusqlite::Result<Vec<Task>> {
        self.get_tasks_for_project(project_id)
    }

    // --- Day runway / lane operations ---

    fn map_lane_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<DayLane> {
        let lane_type_str: String = row.get(3)?;
        Ok(DayLane {
            id: row.get(0)?,
            date: row.get(1)?,
            name: row.get(2)?,
            lane_type: DayLaneType::from_str(&lane_type_str),
            sort_order: row.get(4)?,
            created_at: row.get::<_, String>(5)?.parse().unwrap_or_else(|_| Utc::now()),
        })
    }

    pub fn get_lanes_for_date(&self, date: &str) -> rusqlite::Result<Vec<DayLane>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, date, name, lane_type, sort_order, created_at
             FROM day_lanes WHERE date = ?1 ORDER BY sort_order ASC",
        )?;
        let rows = stmt.query_map(params![date], Self::map_lane_row)?;
        rows.collect()
    }

    pub fn get_all_lane_tasks_for_date(
        &self,
        date: &str,
    ) -> rusqlite::Result<Vec<(String, String, i32)>> {
        let mut stmt = self.conn.prepare(
            "SELECT dlt.lane_id, dlt.task_id, dlt.sort_order
             FROM day_lane_tasks dlt
             JOIN day_lanes dl ON dl.id = dlt.lane_id
             WHERE dl.date = ?1
             ORDER BY dlt.sort_order ASC",
        )?;
        let rows = stmt.query_map(params![date], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?;
        rows.collect()
    }

    pub fn get_lane_task_ids(&self, lane_id: &str) -> rusqlite::Result<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT task_id FROM day_lane_tasks WHERE lane_id = ?1 ORDER BY sort_order ASC",
        )?;
        let rows = stmt.query_map(params![lane_id], |row| row.get(0))?;
        rows.collect()
    }

    pub fn lane_id_for_task_on_date(&self, task_id: &str, date: &str) -> rusqlite::Result<String> {
        self.conn.query_row(
            "SELECT dlt.lane_id FROM day_lane_tasks dlt
             JOIN day_lanes dl ON dl.id = dlt.lane_id
             WHERE dlt.task_id = ?1 AND dl.date = ?2",
            params![task_id, date],
            |row| row.get(0),
        )
    }

    pub fn create_day_lane(
        &self,
        date: &str,
        name: &str,
        lane_type: DayLaneType,
    ) -> rusqlite::Result<DayLane> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let sort_order: i32 = self.conn.query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM day_lanes WHERE date = ?1",
            params![date],
            |row| row.get(0),
        )?;
        self.conn.execute(
            "INSERT INTO day_lanes (id, date, name, lane_type, sort_order, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, date, name, lane_type.as_str(), sort_order, now],
        )?;
        self.get_day_lane(&id)
    }

    pub fn get_day_lane(&self, lane_id: &str) -> rusqlite::Result<DayLane> {
        self.conn.query_row(
            "SELECT id, date, name, lane_type, sort_order, created_at FROM day_lanes WHERE id = ?1",
            params![lane_id],
            Self::map_lane_row,
        )
    }

    pub fn rename_day_lane(&self, lane_id: &str, name: &str) -> rusqlite::Result<DayLane> {
        self.conn.execute(
            "UPDATE day_lanes SET name = ?1 WHERE id = ?2",
            params![name, lane_id],
        )?;
        self.get_day_lane(lane_id)
    }

    pub fn close_day_lane(&self, lane_id: &str) -> rusqlite::Result<()> {
        let lane = self.get_day_lane(lane_id)?;
        let date = lane.date;
        let task_ids = self.get_lane_task_ids(lane_id)?;

        let remaining: Vec<DayLane> = self
            .get_lanes_for_date(&date)?
            .into_iter()
            .filter(|l| l.id != lane_id)
            .collect();

        let target_lane_id = if let Some(target) = remaining.first() {
            target.id.clone()
        } else {
            self.create_day_lane(&date, "主线", DayLaneType::Focus)?.id
        };

        for task_id in task_ids {
            self.assign_task_to_lane(&task_id, &target_lane_id, None)?;
        }

        self.conn.execute("DELETE FROM day_lanes WHERE id = ?1", params![lane_id])?;
        Ok(())
    }

    pub fn reorder_day_lanes(&self, date: &str, lane_ids: &[String]) -> rusqlite::Result<()> {
        for (idx, lane_id) in lane_ids.iter().enumerate() {
            self.conn.execute(
                "UPDATE day_lanes SET sort_order = ?1 WHERE id = ?2 AND date = ?3",
                params![idx as i32, lane_id, date],
            )?;
        }
        Ok(())
    }

    pub fn assign_task_to_lane(
        &self,
        task_id: &str,
        lane_id: &str,
        position: Option<i32>,
    ) -> rusqlite::Result<()> {
        self.conn.execute(
            "DELETE FROM day_lane_tasks WHERE task_id = ?1 AND lane_id IN (
                SELECT id FROM day_lanes WHERE date = (SELECT date FROM day_lanes WHERE id = ?2)
             )",
            params![task_id, lane_id],
        )?;

        let sort_order = if let Some(pos) = position {
            pos
        } else {
            self.conn.query_row(
                "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM day_lane_tasks WHERE lane_id = ?1",
                params![lane_id],
                |row| row.get(0),
            )?
        };

        let id = Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO day_lane_tasks (id, lane_id, task_id, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![id, lane_id, task_id, sort_order],
        )?;
        Ok(())
    }

    pub fn remove_task_from_lane(&self, task_id: &str, lane_id: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "DELETE FROM day_lane_tasks WHERE task_id = ?1 AND lane_id = ?2",
            params![task_id, lane_id],
        )?;
        Ok(())
    }

    pub fn reorder_lane_tasks(&self, lane_id: &str, task_ids: &[String]) -> rusqlite::Result<()> {
        for (idx, task_id) in task_ids.iter().enumerate() {
            self.conn.execute(
                "UPDATE day_lane_tasks SET sort_order = ?1 WHERE lane_id = ?2 AND task_id = ?3",
                params![idx as i32, lane_id, task_id],
            )?;
        }
        Ok(())
    }

    pub fn move_task_between_lanes(
        &self,
        task_id: &str,
        from_lane_id: &str,
        to_lane_id: &str,
        position: Option<i32>,
    ) -> rusqlite::Result<()> {
        self.remove_task_from_lane(task_id, from_lane_id)?;
        self.assign_task_to_lane(task_id, to_lane_id, position)
    }

    pub fn append_newly_ready_to_lane(
        &self,
        lane_id: &str,
        project_id: &str,
        completed_task_id: &str,
    ) -> rusqlite::Result<()> {
        let graph = self.get_project_graph(project_id)?;
        let assigned: std::collections::HashSet<String> = self
            .get_lane_task_ids(lane_id)?
            .into_iter()
            .collect();

        let downstream: Vec<String> = graph
            .dependencies
            .iter()
            .filter(|d| d.depends_on_task_id == completed_task_id)
            .map(|d| d.task_id.clone())
            .collect();

        for task_id in downstream {
            if assigned.contains(&task_id) {
                continue;
            }
            if let Some(task) = graph.tasks.iter().find(|t| t.id == task_id) {
                if task.status == TaskStatus::Ready {
                    self.assign_task_to_lane(&task_id, lane_id, None)?;
                }
            }
        }
        Ok(())
    }

    pub fn ensure_runway_initialized(&self, date: &str) -> rusqlite::Result<()> {
        self.sync_day_runway(date)
    }

    fn default_focus_lane_id(&self, date: &str) -> rusqlite::Result<Option<String>> {
        let lanes = self.get_lanes_for_date(date)?;
        Ok(lanes
            .iter()
            .find(|l| l.lane_type == DayLaneType::Focus)
            .or(lanes.first())
            .map(|l| l.id.clone()))
    }

    fn assigned_task_ids_for_date(&self, date: &str) -> rusqlite::Result<std::collections::HashSet<String>> {
        Ok(self
            .get_all_lane_tasks_for_date(date)?
            .into_iter()
            .map(|(_, task_id, _)| task_id)
            .collect())
    }

    fn count_live_lane_tasks_for_date(&self, date: &str) -> rusqlite::Result<i32> {
        let task_map: std::collections::HashMap<String, Task> = self
            .get_all_tasks()?
            .into_iter()
            .map(|t| (t.id.clone(), t))
            .collect();
        let count = self
            .get_all_lane_tasks_for_date(date)?
            .iter()
            .filter(|(_, task_id, _)| {
                task_map
                    .get(task_id.as_str())
                    .map(|t| t.status != TaskStatus::Done)
                    .unwrap_or(false)
            })
            .count() as i32;
        Ok(count)
    }

    fn populate_lane_with_actionable_tasks(
        &self,
        lane_id: &str,
    ) -> rusqlite::Result<()> {
        let projects_raw = self.list_projects()?;
        let projects: Vec<(String, String)> = projects_raw
            .into_iter()
            .map(|p| (p.id, p.name))
            .collect();
        let branches = self.get_all_branches()?;
        let tasks = self.get_all_tasks()?;
        let dependencies = self.get_all_dependencies()?;
        let day_end = self
            .get_setting("day_end_time")?
            .unwrap_or_else(|| DEFAULT_DAY_END.to_string());

        for task in &tasks {
            if task.status == TaskStatus::Active {
                self.assign_task_to_lane(&task.id, lane_id, None)?;
            }
        }

        let rec_snapshot = today::build_today_snapshot(
            &projects,
            &branches,
            &tasks,
            &dependencies,
            &day_end,
        );
        for item in rec_snapshot.schedule {
            self.assign_task_to_lane(&item.task.id, lane_id, None)?;
        }

        self.append_pending_pipeline_to_lane(lane_id, &tasks, &dependencies)?;
        self.append_all_unassigned_actionable_to_lane(lane_id)
    }

    /// Assign every Ready/Pending task not yet on any lane today into `lane_id`.
    fn append_all_unassigned_actionable_to_lane(&self, lane_id: &str) -> rusqlite::Result<()> {
        let date = self.get_day_lane(lane_id)?.date;
        let mut assigned = self.assigned_task_ids_for_date(&date)?;
        for task in self.get_all_tasks()? {
            if matches!(task.status, TaskStatus::Ready | TaskStatus::Pending)
                && !assigned.contains(&task.id)
            {
                self.assign_task_to_lane(&task.id, lane_id, None)?;
                assigned.insert(task.id);
            }
        }
        Ok(())
    }

    /// Append pending tasks to a lane: downstream of active/ready seeds, or all pending if lane is empty.
    fn append_pending_pipeline_to_lane(
        &self,
        lane_id: &str,
        tasks: &[Task],
        dependencies: &[TaskDependency],
    ) -> rusqlite::Result<()> {
        let assigned: std::collections::HashSet<String> = self
            .get_lane_task_ids(lane_id)?
            .into_iter()
            .collect();

        let pending_to_assign = if assigned.is_empty() {
            topo_sort_pending_tasks(tasks, dependencies, None)
        } else {
            let seeds: Vec<String> = tasks
                .iter()
                .filter(|t| {
                    assigned.contains(&t.id)
                        && (t.status == TaskStatus::Active || t.status == TaskStatus::Ready)
                })
                .map(|t| t.id.clone())
                .collect();
            let downstream = collect_downstream_pending(&seeds, tasks, dependencies, &assigned);
            if downstream.is_empty() {
                Vec::new()
            } else {
                topo_sort_pending_tasks(tasks, dependencies, Some(&downstream))
            }
        };

        for task_id in pending_to_assign {
            if !assigned.contains(&task_id) {
                self.assign_task_to_lane(&task_id, lane_id, None)?;
            }
        }
        Ok(())
    }

    /// Keep today's runway aligned with actionable tasks: create lanes if missing,
    /// attach orphaned active tasks, and fill empty lanes on first use.
    pub fn sync_day_runway(&self, date: &str) -> rusqlite::Result<()> {
        let mut lanes = self.get_lanes_for_date(date)?;
        if lanes.is_empty() {
            self.auto_populate_runway(date)?;
            lanes = self.get_lanes_for_date(date)?;
        }
        let Some(default_lane_id) = self.default_focus_lane_id(date)? else {
            return Ok(());
        };

        let mut assigned = self.assigned_task_ids_for_date(date)?;
        let all_tasks = self.get_all_tasks()?;

        for task in &all_tasks {
            if task.status == TaskStatus::Active && !assigned.contains(&task.id) {
                self.assign_task_to_lane(&task.id, &default_lane_id, None)?;
                assigned.insert(task.id.clone());
            }
        }

        if self.count_live_lane_tasks_for_date(date)? == 0 {
            self.populate_lane_with_actionable_tasks(&default_lane_id)?;
            assigned = self.assigned_task_ids_for_date(date)?;
        }

        for task in &all_tasks {
            if matches!(task.status, TaskStatus::Ready | TaskStatus::Pending)
                && !assigned.contains(&task.id)
            {
                self.assign_task_to_lane(&task.id, &default_lane_id, None)?;
            }
        }

        Ok(())
    }

    pub fn auto_populate_runway(&self, date: &str) -> rusqlite::Result<()> {
        let yesterday = previous_date_string(date);
        let mut carry_over = 0i32;

        if let Some(prev_date) = yesterday {
            let prev_lanes = self.get_lanes_for_date(&prev_date)?;
            if !prev_lanes.is_empty() {
                let prev_lane_tasks = self.get_all_lane_tasks_for_date(&prev_date)?;
                let all_tasks: std::collections::HashMap<String, Task> = self
                    .get_all_tasks()?
                    .into_iter()
                    .map(|t| (t.id.clone(), t))
                    .collect();

                let mut lane_id_map: std::collections::HashMap<String, String> =
                    std::collections::HashMap::new();

                for prev_lane in &prev_lanes {
                    let new_lane = self.create_day_lane(date, &prev_lane.name, prev_lane.lane_type.clone())?;
                    lane_id_map.insert(prev_lane.id.clone(), new_lane.id.clone());

                    let mut tasks_for_lane: Vec<(String, i32)> = prev_lane_tasks
                        .iter()
                        .filter(|(lid, _, _)| lid == &prev_lane.id)
                        .map(|(_, tid, order)| (tid.clone(), *order))
                        .collect();
                    tasks_for_lane.sort_by_key(|(_, order)| *order);

                    for (task_id, order) in tasks_for_lane {
                        if let Some(task) = all_tasks.get(&task_id) {
                            if task.status != TaskStatus::Done {
                                self.assign_task_to_lane(&task_id, &new_lane.id, Some(order))?;
                                carry_over += 1;
                            }
                        }
                    }
                }

                self.set_setting(&format!("carry_over_{date}"), &carry_over.to_string())?;
                self.sync_day_runway(date)?;
                return Ok(());
            }
        }

        let lane = self.create_day_lane(date, "主线", DayLaneType::Focus)?;
        self.populate_lane_with_actionable_tasks(&lane.id)?;

        self.set_setting(&format!("carry_over_{date}"), "0")?;
        Ok(())
    }

    pub fn start_external_task(
        &self,
        task_id: &str,
        estimated_minutes: i32,
        note: Option<&str>,
    ) -> rusqlite::Result<Task> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE tasks SET task_type = 'external', external_status = 'delegated',
             external_started_at = ?1, external_note = ?2, estimated_minutes = ?3,
             status = 'active' WHERE id = ?4",
            params![now, note, estimated_minutes, task_id],
        )?;
        self.get_task(task_id)
    }

    pub fn complete_external_task(&self, task_id: &str) -> rusqlite::Result<Task> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE tasks SET external_status = 'needs_review', external_completed_at = ?1 WHERE id = ?2",
            params![now, task_id],
        )?;
        self.get_task(task_id)
    }

    pub fn review_external_task(&self, task_id: &str, action: &str) -> rusqlite::Result<Task> {
        if action == "done" {
            let project_id = self.project_id_for_task(task_id)?;
            self.set_task_status(task_id, TaskStatus::Done)?;
            self.recalculate_project_statuses(&project_id)?;
        } else {
            self.conn.execute(
                "UPDATE tasks SET task_type = 'normal', external_status = NULL,
                 external_started_at = NULL, external_completed_at = NULL,
                 status = 'ready' WHERE id = ?1",
                params![task_id],
            )?;
        }
        self.get_task(task_id)
    }

    pub fn find_or_create_watch_lane(&self, date: &str, name: &str) -> rusqlite::Result<DayLane> {
        let lanes = self.get_lanes_for_date(date)?;
        if let Some(lane) = lanes.iter().find(|l| l.lane_type == DayLaneType::Watch && l.name == name) {
            return self.get_day_lane(&lane.id);
        }
        self.create_day_lane(date, name, DayLaneType::Watch)
    }
}

/// Collect pending task IDs reachable downstream from seed tasks via dependency edges.
fn collect_downstream_pending(
    seeds: &[String],
    tasks: &[Task],
    dependencies: &[TaskDependency],
    already_assigned: &std::collections::HashSet<String>,
) -> std::collections::HashSet<String> {
    use std::collections::{HashSet, VecDeque};

    let pending_ids: HashSet<String> = tasks
        .iter()
        .filter(|t| t.status == TaskStatus::Pending)
        .map(|t| t.id.clone())
        .collect();

    let mut result = HashSet::new();
    let mut queue: VecDeque<String> = seeds.iter().cloned().collect();
    let mut visited: HashSet<String> = seeds.iter().cloned().collect();

    while let Some(upstream_id) = queue.pop_front() {
        for dep in dependencies
            .iter()
            .filter(|d| d.depends_on_task_id == upstream_id)
        {
            if !pending_ids.contains(&dep.task_id) {
                continue;
            }
            if already_assigned.contains(&dep.task_id) || result.contains(&dep.task_id) {
                continue;
            }
            result.insert(dep.task_id.clone());
            if visited.insert(dep.task_id.clone()) {
                queue.push_back(dep.task_id.clone());
            }
        }
    }
    result
}

/// Topologically sort pending tasks (upstream blockers before downstream).
fn topo_sort_pending_tasks(
    tasks: &[Task],
    dependencies: &[TaskDependency],
    subset: Option<&std::collections::HashSet<String>>,
) -> Vec<String> {
    use std::collections::{HashMap, HashSet};

    let pending: Vec<&Task> = tasks
        .iter()
        .filter(|t| t.status == TaskStatus::Pending)
        .filter(|t| subset.map(|s| s.contains(&t.id)).unwrap_or(true))
        .collect();

    if pending.is_empty() {
        return Vec::new();
    }

    let pending_ids: HashSet<String> = pending.iter().map(|t| t.id.clone()).collect();

    let mut in_degree: HashMap<String, usize> = pending_ids
        .iter()
        .map(|id| (id.clone(), 0))
        .collect();

    let mut adj: HashMap<String, Vec<String>> = HashMap::new();

    for dep in dependencies {
        if !pending_ids.contains(&dep.task_id) {
            continue;
        }
        if pending_ids.contains(&dep.depends_on_task_id) {
            adj.entry(dep.depends_on_task_id.clone())
                .or_default()
                .push(dep.task_id.clone());
            *in_degree.entry(dep.task_id.clone()).or_insert(0) += 1;
        }
    }

    let mut queue: Vec<String> = in_degree
        .iter()
        .filter(|(_, deg)| **deg == 0)
        .map(|(id, _)| id.clone())
        .collect();
    queue.sort();

    let mut sorted = Vec::new();
    while let Some(id) = queue.pop() {
        sorted.push(id.clone());
        if let Some(neighbors) = adj.get(&id) {
            for next in neighbors {
                if let Some(deg) = in_degree.get_mut(next) {
                    *deg -= 1;
                    if *deg == 0 {
                        queue.push(next.clone());
                    }
                }
            }
        }
    }

    for task in &pending {
        if !sorted.contains(&task.id) {
            sorted.push(task.id.clone());
        }
    }

    sorted
}

fn today_snapshot_from_runway(runway: &DayRunwaySnapshot) -> TodaySnapshot {
    let active_task = runway
        .lanes
        .iter()
        .find_map(|l| {
            l.active_task_id
                .as_ref()
                .and_then(|id| l.tasks.iter().find(|t| t.task.id == *id))
                .cloned()
        })
        .or_else(|| {
            runway
                .lanes
                .iter()
                .flat_map(|l| l.tasks.iter())
                .find(|t| t.task.status == TaskStatus::Active)
                .cloned()
        });

    let mut schedule = Vec::new();
    for lane in &runway.lanes {
        for ctx in &lane.tasks {
            if ctx.task.status == TaskStatus::Ready {
                let est = ctx.task.estimated_minutes.unwrap_or(30);
                schedule.push(crate::models::TodayScheduleItem {
                    task: ctx.task.clone(),
                    project_id: ctx.project_id.clone(),
                    project_name: ctx.project_name.clone(),
                    branch_name: ctx.branch_name.clone(),
                    estimated_minutes: est,
                    scheduled_start: String::new(),
                    scheduled_end: String::new(),
                });
            }
        }
    }
    for ctx in &runway.backlog {
        let est = ctx.task.estimated_minutes.unwrap_or(30);
        schedule.push(crate::models::TodayScheduleItem {
            task: ctx.task.clone(),
            project_id: ctx.project_id.clone(),
            project_name: ctx.project_name.clone(),
            branch_name: ctx.branch_name.clone(),
            estimated_minutes: est,
            scheduled_start: String::new(),
            scheduled_end: String::new(),
        });
    }

    TodaySnapshot {
        active_task,
        schedule,
        completed_today: runway.completed_today.clone(),
        recommendations: runway.recommendations.clone(),
        time_budget: runway.time_budget.clone(),
        day_end_time: runway.day_end_time.clone(),
    }
}
