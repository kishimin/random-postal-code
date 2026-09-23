import { createApp } from "./app.ts";
import { generatedDatasetRepository } from "./infrastructures/generated-dataset-repository.ts";

// api-design.md section 2 names this file as the Worker entry point. The app
// is built once per isolate; the dataset GeneratedDatasetRepository loads is
// immutable, so rebuilding either per request would only add cost.
const app = createApp({ postalCodeRepository: generatedDatasetRepository });

export default {
  fetch: (request: Request, env: unknown, context: ExecutionContext) =>
    app.fetch(request, env, context),
} satisfies ExportedHandler;
