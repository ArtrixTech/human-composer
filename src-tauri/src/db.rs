use rusqlite::{Connection, Result};

pub fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;

         CREATE TABLE IF NOT EXISTS projects (
             id          TEXT PRIMARY KEY,
             name        TEXT NOT NULL,
             source_type TEXT NOT NULL DEFAULT 'manual',
             source_ref  TEXT,
             created_at  TEXT NOT NULL
         );

         CREATE TABLE IF NOT EXISTS branches (
             id          TEXT PRIMARY KEY,
             project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
             name        TEXT NOT NULL,
             sort_order  INTEGER NOT NULL DEFAULT 0,
             archived    INTEGER NOT NULL DEFAULT 0
         );

         CREATE TABLE IF NOT EXISTS tasks (
             id           TEXT PRIMARY KEY,
             branch_id    TEXT REFERENCES branches(id) ON DELETE SET NULL,
             project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
             title        TEXT NOT NULL,
             description  TEXT,
             status       TEXT NOT NULL DEFAULT 'inbox',
             sort_order   INTEGER NOT NULL DEFAULT 0,
             pinned       INTEGER NOT NULL DEFAULT 0,
             created_at   TEXT NOT NULL,
             completed_at TEXT
         );

         CREATE TABLE IF NOT EXISTS task_dependencies (
             task_id             TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
             depends_on_task_id  TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
             PRIMARY KEY (task_id, depends_on_task_id)
         );",
    )?;
    Ok(())
}
