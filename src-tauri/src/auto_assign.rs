use crate::models::{Branch, BranchSuggestion};

const KEYWORD_MAP: &[(&str, &[&str])] = &[
    ("前端", &["ui", "前端", "react", "页面", "组件", "css", "tsx", "界面", "dashboard", "登录"]),
    ("后端", &["api", "后端", "rust", "server", "数据库", "auth", "认证", "middleware", "中间件"]),
    ("部署", &["deploy", "部署", "ci", "cd", "docker", "release", "发布", "pipeline"]),
    ("设计", &["设计", "design", "figma", "uiux", "视觉"]),
];

pub fn suggest_branch(title: &str, branches: &[Branch]) -> Option<BranchSuggestion> {
    let lower = title.to_lowercase();
    let mut best: Option<(String, String, f64)> = None;

    for branch in branches {
        if branch.archived {
            continue;
        }

        let mut score = 0.0;

        if lower.contains(&branch.name.to_lowercase()) {
            score += 5.0;
        }

        for (branch_key, keywords) in KEYWORD_MAP {
            if branch.name.contains(branch_key) {
                for kw in *keywords {
                    if lower.contains(kw) {
                        score += 2.0;
                    }
                }
            }
        }

        if score > 0.0 {
            if best.as_ref().map(|(_, _, s)| score > *s).unwrap_or(true) {
                best = Some((branch.id.clone(), branch.name.clone(), score));
            }
        }
    }

    best.map(|(branch_id, branch_name, score)| BranchSuggestion {
        branch_id,
        branch_name,
        confidence: (score / 10.0_f64).min(1.0_f64),
    })
}
