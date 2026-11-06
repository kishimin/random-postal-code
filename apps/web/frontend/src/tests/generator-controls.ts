/*
 * How the component and integration tests find the generate action.
 *
 * Figma gives the one action a different label in each state (Issue #97):
 * before a result, after a result, and while the API error shows. A test that
 * clicks it more than once spans those states, so it asks for any of the
 * three, as whole labels rather than a fragment of one.
 */
export const generateActionName =
  /^(?:ランダム生成する|もう一度、波に乗る|再試行する)$/;

// The start screen's h1 is Figma's headline, which reads differently on a
// phone and elsewhere, so the tests recognise the words both share.
export const startHeadlineName = /波に乗って/;
