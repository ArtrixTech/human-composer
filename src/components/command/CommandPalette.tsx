import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Search } from "lucide-react";

import { useAppStore } from "../../store/appStore";
import "./CommandPalette.css";

interface ResultItem {
  id: string;
  label: string;
  group: string;
  action: () => void | Promise<void>;
}

export function CommandPalette() {
  const open = useAppStore((s) => s.commandOpen);
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  const addInboxTask = useAppStore((s) => s.addInboxTask);
  const completeTask = useAppStore((s) => s.completeTask);
  const activateTask = useAppStore((s) => s.activateTask);
  const selectProjectView = useAppStore((s) => s.selectProjectView);
  const selectTodayView = useAppStore((s) => s.selectTodayView);
  const createBranch = useAppStore((s) => s.createBranch);
  const createLane = useAppStore((s) => s.createLane);
  const setAddLaneOpen = useAppStore((s) => s.setAddLaneOpen);
  const runwaySnapshot = useAppStore((s) => s.runwaySnapshot);
  const claimTask = useAppStore((s) => s.claimTask);
  const projects = useAppStore((s) => s.projects);
  const graph = useAppStore((s) => s.graph);
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
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
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        void useAppStore.getState().undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items: ResultItem[] = [];

    if (q.startsWith("/switch ") || q.startsWith("切换 ")) {
      const name = q.replace(/^(\/switch|切换)\s+/i, "");
      projects
        .filter((p) => !name || p.name.toLowerCase().includes(name))
        .forEach((p) =>
          items.push({
            id: `project-${p.id}`,
            label: p.name,
            group: "项目",
            action: () => selectProjectView(p.id),
          }),
        );
    } else if (q.startsWith("/branch ") || q.startsWith("支线 ")) {
      const name = q.replace(/^(\/branch|支线)\s+/i, "");
      if (name)
        items.push({
          id: "branch-new",
          label: `创建支线「${name}」`,
          group: "命令",
          action: () => createBranch(name),
        });
    } else if (q.startsWith("/lane ") || q.startsWith("泳道 ")) {
      const name = q.replace(/^(\/lane|泳道)\s+/i, "");
      if (name)
        items.push({
          id: "lane-new",
          label: `创建专注泳道「${name}」`,
          group: "命令",
          action: () => createLane(name, "focus"),
        });
    } else if (q === "完成" || q === "done" || q.startsWith("/complete")) {
      const active = runwaySnapshot?.lanes
        .flatMap((l) => l.tasks)
        .find((t) => t.task.status === "active");
      if (active)
        items.push({
          id: "complete",
          label: `完成「${active.task.title}」`,
          group: "命令",
          action: () => completeTask(active.task.id, active.projectId),
        });
    } else if (q.startsWith("开始 ") || q.startsWith("start ")) {
      const name = q.replace(/^(开始|start)\s+/i, "");
      runwaySnapshot?.lanes.forEach((lane) => {
        lane.tasks
          .filter((t) => t.task.title.toLowerCase().includes(name))
          .forEach((t) =>
            items.push({
              id: `start-${t.task.id}`,
              label: t.task.title,
              group: lane.lane.name,
              action: () => claimTask(t.task.id, lane.lane.id, t.projectId),
            }),
          );
      });
    } else {
      runwaySnapshot?.lanes.forEach((lane) => {
        lane.tasks.forEach((t) => {
          if (!q || t.task.title.toLowerCase().includes(q))
            items.push({
              id: `lane-task-${t.task.id}`,
              label: `${t.task.title} (${lane.lane.name})`,
              group: "泳道",
              action: () => claimTask(t.task.id, lane.lane.id, t.projectId),
            });
        });
      });
      graph?.tasks.forEach((t) => {
        if (!q || t.title.toLowerCase().includes(q))
          items.push({
            id: `graph-task-${t.id}`,
            label: t.title,
            group: "当前项目",
            action: () => {
              useAppStore.getState().selectTask(t.id);
            },
          });
      });
      projects.forEach((p) => {
        if (!q || p.name.toLowerCase().includes(q))
          items.push({
            id: `proj-${p.id}`,
            label: p.name,
            group: "项目",
            action: () => selectProjectView(p.id),
          });
      });
      items.push({
        id: "today",
        label: "今日安排",
        group: "导航",
        action: () => selectTodayView(),
      });
      items.push({
        id: "add-lane",
        label: "新建泳道",
        group: "命令",
        action: () => setAddLaneOpen(true),
      });
      if (q)
        items.push({
          id: "add",
          label: `添加「${query.trim()}」到 Inbox`,
          group: "命令",
          action: () => addInboxTask(query.trim()),
        });
    }
    return items.slice(0, 12);
  }, [
    query,
    projects,
    runwaySnapshot,
    createLane,
    setAddLaneOpen,
    claimTask,
    graph,
    selectProjectView,
    selectTodayView,
    createBranch,
    completeTask,
    activateTask,
    addInboxTask,
  ]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [results.length, query]);

  const runVoice = () => {
    type SpeechRecognitionCtor = new () => {
      lang: string;
      interimResults: boolean;
      onresult: (event: {
        results: { [index: number]: { [index: number]: { transcript: string } } };
      }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
    };
    const Win = window as Window & {
      webkitSpeechRecognition?: SpeechRecognitionCtor;
      SpeechRecognition?: SpeechRecognitionCtor;
    };
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

  const runSelected = async () => {
    const item = results[selectedIdx];
    if (item) {
      await item.action();
      setCommandOpen(false);
      return;
    }
    if (query.trim()) {
      await addInboxTask(query.trim());
      setCommandOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div className="command-palette-backdrop" onClick={() => setCommandOpen(false)}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette__input-row">
          <Search size={16} />
          <input
            ref={inputRef}
            placeholder="搜索任务、项目，或 /branch /switch…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIdx((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter") void runSelected();
            }}
          />
          <button
            type="button"
            onClick={runVoice}
            title="语音输入"
            className={listening ? "command-palette__mic--active" : ""}
          >
            <Mic size={16} />
          </button>
        </div>
        <div className="command-palette__results">
          {results.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`command-palette__result ${i === selectedIdx ? "command-palette__result--selected" : ""}`}
              onClick={() => {
                void Promise.resolve(item.action()).then(() => setCommandOpen(false));
              }}
            >
              <span className="command-palette__result-group">{item.group}</span>
              {item.label}
            </button>
          ))}
        </div>
        <div className="command-palette__hints">
          <span>↑↓ 选择</span>
          <span>Enter 执行</span>
          <span>⌘Z Undo</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  );
}
