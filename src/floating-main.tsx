import React from "react";
import ReactDOM from "react-dom/client";

import { FloatingWidget } from "./components/floating/FloatingWidget";
import "./styles/theme.css";
import "./floating-window.css";
import "./components/floating/FloatingWidget.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <FloatingWidget />
  </React.StrictMode>,
);
