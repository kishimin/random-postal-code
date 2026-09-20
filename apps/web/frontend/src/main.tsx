import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { parseAppEnv } from "./app/schemas/env.schema";
import { App } from "./app/views/App";
import "./theme/globals.css";

// Validated before the first render. A build missing VITE_API_BASE_URL fails
// here, naming the variable, instead of reaching a user and failing later as a
// request to `undefined/api/random`.
parseAppEnv(import.meta.env);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root is missing from index.html.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
