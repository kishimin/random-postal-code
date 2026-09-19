import { createApp } from "./app";

// api-design.md section 2 names this file as the Worker entry point. The app is
// built once per isolate; the dataset it will eventually load is immutable, so
// rebuilding it per request would only add cost.
const app = createApp();

export default {
  fetch: (request: Request, env: unknown, context: ExecutionContext) =>
    app.fetch(request, env, context),
} satisfies ExportedHandler;
