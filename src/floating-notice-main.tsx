import React from "react";
import ReactDOM from "react-dom/client";

import { FloatingNoticeWindow } from "./components/floating/FloatingNoticeWindow";
import "./styles/theme.css";
import "./components/floating/FloatingNoticeWindow.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <FloatingNoticeWindow />
  </React.StrictMode>,
);
