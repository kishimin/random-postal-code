import { createApp } from "./app.ts";
import type { CorsBindings } from "./controllers/cors-middleware.ts";
import { generatedDatasetRepository } from "./infrastructures/generated-dataset-repository.ts";

// api-design.md section 2 names this file as the Worker entry point. The app
// is built once per isolate; the dataset GeneratedDatasetRepository loads is
// immutable, so rebuilding either per request would only add cost.
const app = createApp({ postalCodeRepository: generatedDatasetRepository });

export default {
  // `env` is typed as CorsBindings -- not left `unknown` -- because Issue #11
  // gives this Worker its first binding the app actually reads per request
  // (ALLOWED_ORIGINS); corsMiddleware.ts owns that shape.
  fetch: (request: Request, env: CorsBindings, context: ExecutionContext) =>
    app.fetch(request, env, context),
} satisfies ExportedHandler<CorsBindings>;
