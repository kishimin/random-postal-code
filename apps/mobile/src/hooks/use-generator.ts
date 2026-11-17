import { useCallback, useReducer, useRef } from "react";
import { mobileConfig } from "../config/env";
import {
  generatorReducer,
  initialGeneratorState,
  type GeneratorState,
} from "../lib/generator-state";
import { failureOf, fetchRandomPostalCode } from "../lib/random-postal-code";

/**
 * Runs the generator's request lifecycle against the configured API.
 *
 * A ref mirrors "a request is in flight" so a second press is refused at
 * the moment it happens. State alone would only say "loading" after the
 * next render, and a fast double tap lands before that render.
 */
export const useGenerator = (
  apiBaseUrl: string | undefined = mobileConfig.apiBaseUrl,
): { state: GeneratorState; generate: () => void } => {
  const [state, dispatch] = useReducer(generatorReducer, initialGeneratorState);
  const inFlight = useRef(false);

  const generate = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    dispatch({ type: "started" });

    // The guard is released before the state that re-enables the action is
    // dispatched, so the action is never shown enabled while still refused.
    void fetchRandomPostalCode(apiBaseUrl).then(
      (result) => {
        inFlight.current = false;
        dispatch({ type: "succeeded", result });
      },
      (error: unknown) => {
        inFlight.current = false;
        dispatch({ type: "failed", failure: failureOf(error) });
      },
    );
  }, [apiBaseUrl]);

  return { state, generate };
};
