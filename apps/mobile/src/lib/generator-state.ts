import type { PostalCode } from "@zipnami/shared";
import type { GenerationFailure } from "./random-postal-code";

/**
 * Where the generator screen is in its request lifecycle. A result that
 * was on screen stays in `previous` while the next request loads or after
 * it fails, so a failure never takes away what the person already had.
 */
export type GeneratorState =
  | { readonly status: "idle" }
  | { readonly status: "loading"; readonly previous: PostalCode | undefined }
  | { readonly status: "success"; readonly result: PostalCode }
  | {
      readonly status: "error";
      readonly failure: GenerationFailure;
      readonly previous: PostalCode | undefined;
    };

export type GeneratorEvent =
  | { readonly type: "started" }
  | { readonly type: "succeeded"; readonly result: PostalCode }
  | { readonly type: "failed"; readonly failure: GenerationFailure };

export const initialGeneratorState: GeneratorState = { status: "idle" };

/**
 * The result the screen shows, if any.
 * @param {GeneratorState} state - The current state.
 */
export const shownResultOf = (
  state: GeneratorState,
): PostalCode | undefined => {
  switch (state.status) {
    case "idle":
      return undefined;
    case "success":
      return state.result;
    case "loading":
    case "error":
      return state.previous;
  }
};

/**
 * The next state after an event.
 * @param {GeneratorState} state - The current state.
 * @param {GeneratorEvent} event - What happened.
 */
export const generatorReducer = (
  state: GeneratorState,
  event: GeneratorEvent,
): GeneratorState => {
  switch (event.type) {
    case "started":
      return { status: "loading", previous: shownResultOf(state) };
    case "succeeded":
      return { status: "success", result: event.result };
    case "failed":
      return {
        status: "error",
        failure: event.failure,
        previous: shownResultOf(state),
      };
  }
};
