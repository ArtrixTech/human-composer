use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::auto_assign::suggest_outcome;
use crate::db::Database;
use crate::models::{Branch, BranchSuggestion, LlmConfig, PriorityLevel};

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Debug, Deserialize)]
struct ChatMessage {
    tool_calls: Option<Vec<ToolCall>>,
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ToolCall {
    function: ToolFunction,
}

#[derive(Debug, Deserialize)]
struct ToolFunction {
    arguments: String,
}

#[derive(Debug, Deserialize)]
struct SelectOutcomeArgs {
    branch_id: String,
    confidence: f64,
    reason: Option<String>,
}

pub fn get_llm_config(db: &Database) -> Result<LlmConfig, String> {
    Ok(LlmConfig {
        enabled: db
            .get_setting("llm_enabled")
            .map_err(|e| e.to_string())?
            .map(|v| v == "true")
            .unwrap_or(false),
        endpoint: db
            .get_setting("llm_endpoint")
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| "https://api.openai.com/v1".to_string()),
        api_key: db
            .get_setting("llm_api_key")
            .map_err(|e| e.to_string())?
            .unwrap_or_default(),
        model: db
            .get_setting("llm_model")
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| "gpt-4o-mini".to_string()),
    })
}

pub fn set_llm_config(db: &Database, config: &LlmConfig) -> Result<(), String> {
    db.set_setting("llm_enabled", if config.enabled { "true" } else { "false" })
        .map_err(|e| e.to_string())?;
    db.set_setting("llm_endpoint", &config.endpoint)
        .map_err(|e| e.to_string())?;
    db.set_setting("llm_api_key", &config.api_key)
        .map_err(|e| e.to_string())?;
    db.set_setting("llm_model", &config.model)
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn test_llm_connection(config: &LlmConfig) -> Result<String, String> {
    if config.api_key.trim().is_empty() {
        return Err("API Key 未设置".into());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!(
        "{}/chat/completions",
        config.endpoint.trim_end_matches('/')
    );
    let body = json!({
        "model": config.model,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 5
    });
    let resp = client
        .post(&url)
        .bearer_auth(&config.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("连接失败: {e}"))?;
    let status = resp.status();
    if status.is_success() {
        Ok("连接成功".into())
    } else {
        let text = resp.text().await.unwrap_or_default();
        Err(format!("HTTP {status}: {text}"))
    }
}

pub async fn suggest_outcome_with_llm(
    config: &LlmConfig,
    title: &str,
    project_name: &str,
    branches: &[Branch],
) -> Option<BranchSuggestion> {
    if !config.enabled || config.api_key.trim().is_empty() {
        return suggest_outcome(title, branches);
    }

    let branch_list: Vec<_> = branches
        .iter()
        .filter(|b| !b.archived)
        .map(|b| json!({"id": b.id, "name": b.name}))
        .collect();

    let system = "你是任务分类助手。根据行动标题，从给定的目标列表中选择最匹配的一个。只通过工具调用返回结果。";
    let user = format!(
        "项目: {project_name}\n行动标题: {title}\n可选目标: {}",
        serde_json::to_string(&branch_list).unwrap_or_default()
    );

    match call_select_outcome(&config, system, &user).await {
        Ok(Some(mut suggestion)) => {
            if let Some(branch) = branches.iter().find(|b| b.id == suggestion.branch_id) {
                suggestion.branch_name = branch.name.clone();
            }
            Some(suggestion)
        }
        _ => suggest_outcome(title, branches),
    }
}

async fn call_select_outcome(
    config: &LlmConfig,
    system: &str,
    user: &str,
) -> Result<Option<BranchSuggestion>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!(
        "{}/chat/completions",
        config.endpoint.trim_end_matches('/')
    );

    let body = json!({
        "model": config.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
        "tools": [{
            "type": "function",
            "function": {
                "name": "select_outcome",
                "description": "选择最匹配的目标",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "branch_id": {"type": "string", "description": "目标 ID"},
                        "confidence": {"type": "number", "description": "置信度 0-1"},
                        "reason": {"type": "string", "description": "简短理由"}
                    },
                    "required": ["branch_id", "confidence"]
                }
            }
        }],
        "tool_choice": {"type": "function", "function": {"name": "select_outcome"}}
    });

    let resp = client
        .post(&url)
        .bearer_auth(&config.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(resp.text().await.unwrap_or_default());
    }

    let parsed: ChatCompletionResponse = resp.json().await.map_err(|e| e.to_string())?;
    let tool_call = parsed
        .choices
        .first()
        .and_then(|c| c.message.tool_calls.as_ref())
        .and_then(|t| t.first());

    let args: SelectOutcomeArgs = tool_call
        .map(|tc| serde_json::from_str(&tc.function.arguments).ok())
        .flatten()
        .ok_or_else(|| "LLM 未返回有效工具调用".to_string())?;

    Ok(Some(BranchSuggestion {
        branch_id: args.branch_id,
        branch_name: String::new(),
        confidence: args.confidence.clamp(0.0, 1.0),
    }))
}

/// Infer priority from action title via LLM (fallback: Low).
pub async fn infer_priority_from_title(config: &LlmConfig, title: &str) -> PriorityLevel {
    if !config.enabled || config.api_key.trim().is_empty() {
        return PriorityLevel::Low;
    }

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(_) => return PriorityLevel::Low,
    };

    let url = format!(
        "{}/chat/completions",
        config.endpoint.trim_end_matches('/')
    );
    let body = json!({
        "model": config.model,
        "messages": [
            {"role": "system", "content": "根据行动标题判断优先级，只返回 H、M 或 L 之一。H=紧急重要，M=普通，L=可选低优。"},
            {"role": "user", "content": title}
        ],
        "max_tokens": 2
    });

    let resp = match client
        .post(&url)
        .bearer_auth(&config.api_key)
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return PriorityLevel::Low,
    };

    if !resp.status().is_success() {
        return PriorityLevel::Low;
    }

    #[derive(Deserialize)]
    struct SimpleResponse {
        choices: Vec<SimpleChoice>,
    }
    #[derive(Deserialize)]
    struct SimpleChoice {
        message: SimpleMessage,
    }
    #[derive(Deserialize)]
    struct SimpleMessage {
        content: Option<String>,
    }

    let parsed: SimpleResponse = match resp.json().await {
        Ok(p) => p,
        Err(_) => return PriorityLevel::Low,
    };

    let text = parsed
        .choices
        .first()
        .and_then(|c| c.message.content.as_deref())
        .unwrap_or("L");
    PriorityLevel::from_str(text.trim())
}
