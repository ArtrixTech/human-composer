use crate::models::Project;

pub trait ProjectSource: Send + Sync {
    fn source_type(&self) -> &'static str;
    fn list_projects(&self) -> Result<Vec<Project>, String>;
    fn sync_project(&self, _source_ref: &str) -> Result<Project, String> {
        Err("sync not implemented".into())
    }
}

pub struct ManualSource;

impl ProjectSource for ManualSource {
    fn source_type(&self) -> &'static str {
        "manual"
    }

    fn list_projects(&self) -> Result<Vec<Project>, String> {
        Ok(vec![])
    }
}

pub fn registry() -> Vec<Box<dyn ProjectSource>> {
    vec![Box::new(ManualSource)]
}
