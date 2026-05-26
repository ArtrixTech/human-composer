//! External project source abstraction.
//! Implement this trait to add new project integrations (Linear, GitHub, Jira, etc.)

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalProject {
    pub external_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalTask {
    pub external_id: String,
    pub title: String,
    pub description: Option<String>,
    pub branch_hint: Option<String>,
}

pub trait ProjectSource: Send + Sync {
    fn source_type(&self) -> &str;
    fn fetch_projects(&self) -> Result<Vec<ExternalProject>, String>;
    fn sync_tasks(&self, project_external_id: &str) -> Result<Vec<ExternalTask>, String>;
}

/// Manual (built-in) source — no external sync.
pub struct ManualSource;

impl ProjectSource for ManualSource {
    fn source_type(&self) -> &str {
        "manual"
    }
    fn fetch_projects(&self) -> Result<Vec<ExternalProject>, String> {
        Ok(vec![])
    }
    fn sync_tasks(&self, _project_external_id: &str) -> Result<Vec<ExternalTask>, String> {
        Ok(vec![])
    }
}

// Future sources to implement:
// pub struct LinearSource { api_key: String }
// pub struct GithubSource { token: String, owner: String, repo: String }
