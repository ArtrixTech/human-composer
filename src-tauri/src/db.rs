use std::path::Path;

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::models::{
    AppSnapshot, Branch, Project, ProjectGraph, ProjectSummary, RecommendedTask, Task,
    TaskDependency, TaskStatus, TaskWithBranch, TodaySnapshot,
};
use crate::recommend::compute_recommendations;
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
            ",
        )?;

        self.ensure_column("tasks", "pinned", "INTEGER NOT NULL DEFAULT 0")?;
        self.ensure_column("tasks", "project_id", "TEXT")?;
        self.ensure_column("tasks", "estimated_minutes", "INTEGER DEFAULT 30")?;

        if self.get_setting("day_end_time")?.is_none() {
            self.set_setting("day_end_time", DEFAULT_DAY_END)?;
        }

        Ok(())
    }

    fn map_task_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Task> {
        let status_str: String = row.get(5)?;
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
        })
    }

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
            "SELECT t.id, t.project_id, t.branch_id, t.title, t.description, t.status,
                    t.sort_order, t.pinned, t.estimated_minutes, t.created_at, t.completed_at
             FROM tasks t
             WHERE t.project_id = ?1
             ORDER BY t.sort_order ASC, t.created_at ASC",
        )?;

        let rows = stmt.query_map(params![project_id], Self::map_task_row)?;
        rows.collect()
    }

    fn get_dependencies_for_project(&self, project_id: &str) -> rusqlite::Result<Vec<TaskDependency>> {
        let mut stmt = self.conn.prepare(
            "SELECT td.task_id, td.depends_on_task_id
             FROM task_dependencies td
             JOIN tasks t ON td.task_id = t.id
             WHERE t.project_id = ?1",
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
                "UPDATE tasks SET status = ?1, completed_at = ?2 WHERE id = ?3",
                params![status.as_str(), completed_at, task_id],
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
            "SELECT id, project_id, branch_id, title, description, status, sort_order, pinned,
                    estimated_minutes, created_at, completed_at
             FROM tasks WHERE id = ?1",
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
        self.conn.execute(
            "UPDATE tasks SET status = 'ready' WHERE status = 'active'",
            [],
        )?;
        self.set_task_status(task_id, TaskStatus::Active)
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

    pub fn set_task_pinned(&self, task_id: &str, pinned: bool) -> rusqlite::Result<Task> {
        self.conn.execute(
            "UPDATE tasks SET pinned = ?1 WHERE id = ?2",
            params![pinned as i32, task_id],
        )?;
        self.get_task(task_id)
    }

    pub fn complete_task(&self, task_id: &str, project_id: &str) -> rusqlite::Result<(Task, Vec<RecommendedTask>)> {
        let _previous = self.get_task(task_id)?;
        self.set_task_status(task_id, TaskStatus::Done)?;
        self.recalculate_project_statuses(project_id)?;
        let today = self.build_today_snapshot()?;
        let completed = self.get_task(task_id)?;
        Ok((completed, today.recommendations))
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
            "SELECT id, project_id, branch_id, title, description, status, sort_order, pinned,
                    estimated_minutes, created_at, completed_at
             FROM tasks ORDER BY sort_order ASC, created_at ASC",
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
        Ok(today::build_today_snapshot(
            &projects,
            &branches,
            &tasks,
            &dependencies,
            &day_end,
        ))
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
}
