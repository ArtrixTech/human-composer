import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

import "./TitleBar.css";

export function TitleBar() {
  const win = getCurrentWindow();

  const onDragMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    void win.startDragging();
  };

  return (
    <div className="titlebar">
      <div className="titlebar__controls">
        <button
          type="button"
          className="titlebar__btn titlebar__btn--close"
          onClick={() => void win.close()}
          aria-label="关闭"
        >
          <X size={10} />
        </button>
        <button
          type="button"
          className="titlebar__btn titlebar__btn--minimize"
          onClick={() => void win.minimize()}
          aria-label="最小化"
        >
          <Minus size={10} />
        </button>
        <button
          type="button"
          className="titlebar__btn titlebar__btn--maximize"
          onClick={() => void win.toggleMaximize()}
          aria-label="最大化"
        >
          <Square size={8} />
        </button>
      </div>
      <div
        className="titlebar__drag"
        data-tauri-drag-region
        onMouseDown={onDragMouseDown}
      >
        Human Composer
      </div>
    </div>
  );
}
