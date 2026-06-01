import React from "react";
import ReactDOM from "react-dom/client";

import { FloatingWidget } from "./components/floating/FloatingWidget";
import "./styles/theme.css";
import "./components/floating/FloatingWidget.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div className="floating-shell">
      <FloatingWidget />
    </div>
  </React.StrictMode>,
);
