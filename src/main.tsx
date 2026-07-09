// NOTE: Placeholder entry point so the repo builds standalone.
// When the full app source is imported, replace this with the real main.tsx.
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
