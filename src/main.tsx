import './utils/serviceLineOverrides'; // Apply stored verification overrides before render
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// No-op: references the per-build unique id so every build emits a distinct
// bundle. Ensures the publish dialog always detects a deployable change.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
(globalThis as unknown as { __BUILD_ID__?: string }).__BUILD_ID__ = __APP_BUILD_ID__;

createRoot(document.getElementById("root")!).render(<App />);
