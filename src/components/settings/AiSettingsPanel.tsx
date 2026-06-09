import { useEffect, useState } from "react";
import { Bot, X } from "lucide-react";

import * as api from "../../api/tauri";
import type { LlmConfig } from "../../types";
import "./AiSettingsPanel.css";

const ENDPOINT_PRESETS = [
  { label: "OpenAI", value: "https://api.openai.com/v1" },
  { label: "Ollama (本地)", value: "http://localhost:11434/v1" },
];

const MODEL_PRESETS = ["gpt-4o-mini", "gpt-4o", "claude-3-5-haiku-latest", "qwen2.5:7b"];

export function AiSettingsPanel({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<LlmConfig | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api.getLlmConfig().then(setConfig);
  }, []);

  if (!config) return null;

  const save = async () => {
    setSaving(true);
    try {
      await api.setLlmConfig(config);
      setStatus("已保存");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const msg = await api.testLlmConnection(config);
      setStatus(msg);
    } catch (e) {
      setStatus(String(e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <aside className="ai-settings">
      <header className="ai-settings__header">
        <div className="ai-settings__title">
          <Bot size={16} />
          <span>AI 设置</span>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭">
          <X size={14} />
        </button>
      </header>

      <label className="ai-settings__toggle">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
        />
        启用 LLM 辅助（目标推荐等）
      </label>

      <label className="ai-settings__field">
        Endpoint
        <input
          value={config.endpoint}
          onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
          placeholder="https://api.openai.com/v1"
        />
        <div className="ai-settings__presets">
          {ENDPOINT_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setConfig({ ...config, endpoint: p.value })}
            >
              {p.label}
            </button>
          ))}
        </div>
      </label>

      <label className="ai-settings__field">
        API Key
        <input
          type="password"
          value={config.apiKey}
          onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          placeholder="sk-..."
          autoComplete="off"
        />
      </label>

      <label className="ai-settings__field">
        Model
        <input
          value={config.model}
          onChange={(e) => setConfig({ ...config, model: e.target.value })}
          list="ai-model-presets"
        />
        <datalist id="ai-model-presets">
          {MODEL_PRESETS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>

      {status && <p className="ai-settings__status">{status}</p>}

      <div className="ai-settings__actions">
        <button type="button" onClick={() => void test()} disabled={testing}>
          {testing ? "测试中…" : "测试连接"}
        </button>
        <button type="button" className="ai-settings__save" onClick={() => void save()} disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </aside>
  );
}
