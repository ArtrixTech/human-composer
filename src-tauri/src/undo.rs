use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::models::TaskStatus;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum UndoAction {
    TaskStatus {
        task_id: String,
        previous_status: TaskStatus,
    },
    TaskCreated {
        task_id: String,
    },
}

pub struct UndoStack {
    inner: Mutex<Vec<UndoAction>>,
}

impl UndoStack {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(Vec::new()),
        }
    }

    pub fn push(&self, action: UndoAction) {
        if let Ok(mut stack) = self.inner.lock() {
            stack.push(action);
            if stack.len() > 20 {
                stack.remove(0);
            }
        }
    }

    pub fn pop(&self) -> Option<UndoAction> {
        self.inner.lock().ok()?.pop()
    }
}

impl Default for UndoStack {
    fn default() -> Self {
        Self::new()
    }
}
