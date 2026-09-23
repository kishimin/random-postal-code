import type { PostalCode } from "@zipnami/shared";

/**
 * The generator's request lifecycle as one exclusive state (design.md
 * section 4), rather than independent loading, data, and error booleans that
 * could otherwise disagree with each other.
 */
export type GeneratorState =
  | { status: "idle" }
  | { status: "loading"; previousResult?: PostalCode }
  | { status: "success"; result: PostalCode }
  | { status: "error"; error: UiError; previousResult?: PostalCode };

/**
 * What a failed generation looked like (design.md section 4), without
 * deciding how each kind reads on screen -- ui-design.md section 12 leaves
 * that wording to this Issue.
 */
export type UiError =
  | { kind: "offline" }
  | { kind: "service-unavailable"; requestId?: string }
  | { kind: "invalid-response"; requestId?: string }
  | { kind: "unexpected"; requestId?: string };

export type GeneratorAction =
  | { type: "generate/started" }
  | { type: "generate/succeeded"; result: PostalCode }
  | { type: "generate/failed"; error: UiError };

/** ui-design.md section 6.1: idle shows the generate action with no result yet. */
export const initialGeneratorState: GeneratorState = { status: "idle" };

/**
 * The result currently on screen, whichever state produced it: a fresh
 * success, or the one a loading or failed regeneration left in place
 * (design.md section 4: a prior result "remains visible" through both).
 */
export const currentResultOf = (
  state: GeneratorState,
): PostalCode | undefined => {
  switch (state.status) {
    case "success":
      return state.result;
    case "loading":
    case "error":
      return state.previousResult;
    case "idle":
      return undefined;
  }
};

/**
 * Advances the generator's state for one request-lifecycle action
 * (design.md section 4).
 */
export const generatorReducer = (
  state: GeneratorState,
  action: GeneratorAction,
): GeneratorState => {
  switch (action.type) {
    case "generate/started":
      return { status: "loading", previousResult: currentResultOf(state) };
    case "generate/succeeded":
      return { status: "success", result: action.result };
    case "generate/failed":
      return {
        status: "error",
        error: action.error,
        previousResult: currentResultOf(state),
      };
  }
};
