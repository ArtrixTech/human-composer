import { useEffect, useRef, useState } from "react";
import { Mic, Search } from "lucide-react";

import { useAppStore } from "../../store/appStore";
import "./CommandPalette.css";

export function CommandPalette() {
  const open = useAppStore((s) => s.commandOpen);
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  const addInboxTask = useAppStore((s) => s.addInboxTask);
  const completeTask = useAppStore((s) => s.completeTask);
  const activateTask = useAppStore((s) => s.activateTask);
  const snapshot = useAppStore((s) => s.snapshot);
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(!useAppStore.getState().commandOpen);
      }
      if (e.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  const runVoice = () => {
    type SpeechRecognitionCtor = new () => {
      lang: string;
      interimResults: boolean;
      onresult: (event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
    };
    const Win = window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor; SpeechRecognition?: SpeechRecognitionCtor };
    const SpeechRecognition = Win.webkitSpeechRecognition ?? Win.SpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.lang = "zh-CN";
    rec.interimResults = false;
    setListening(true);
    rec.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      setQuery(text);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  const submit = async () => {
    const text = query.trim();
    if (!text) return;

    const lower = text.toLowerCase();
    if (lower.startsWith("完成") || lower === "done") {
      const id = snapshot?.activeTask?.task.id;
      if (id) await completeTask(id);
    } else if (lower.startsWith("开始 ") || lower.startsWith("start ")) {
      const name = text.replace(/^(开始|start)\s+/i, "");
      const match = snapshot?.readyTasks.find((t) =>
        t.task.title.toLowerCase().includes(name.toLowerCase()),
      );
      if (match) await activateTask(match.task.id);
    } else {
      await addInboxTask(text);
    }
    setCommandOpen(false);
  };

  if (!open) return null;

  return (
    <div className="command-palette-backdrop" onClick={() => setCommandOpen(false)}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette__input-row">
          <Search size={16} />
          <input
            ref={inputRef}
            placeholder="输入命令或任务… (Enter 添加到 Inbox)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
          <button type="button" onClick={runVoice} title="语音输入" className={listening ? "command-palette__mic--active" : ""}>
            <Mic size={16} />
          </button>
        </div>
        <div className="command-palette__hints">
          <span>Enter → 添加任务</span>
          <span>「完成」→ 完成当前</span>
          <span>「开始 xxx」→ 激活任务</span>
          <span>⌘K 关闭</span>
        </div>
        {snapshot?.recommendations[0] && (
          <div className="command-palette__rec">
            推荐: {snapshot.recommendations[0].task.title}
          </div>
        )}
      </div>
    </div>
  );
}
