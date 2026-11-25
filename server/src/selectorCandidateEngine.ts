import {
  validateSelector,
  scoreSelector,
} from "./selectorValidator.js";

export interface SelectorCandidate {
  selector: string;
  score: number;
}

/**
 * Generate selector candidates using the
 * actual parent hierarchy.
 *
 * parentSelectors must be provided from
 * closest parent → farthest parent.
 *
 * Example:
 *
 * target:
 * [data-tooltip="Drafts"]
 *
 * parents:
 * [
 *   ".mail-item",
 *   ".mail-navigation"
 * ]
 *
 * produces:
 *
 * [data-tooltip="Drafts"]
 *
 * .mail-item [data-tooltip="Drafts"]
 *
 * .mail-navigation .mail-item [data-tooltip="Drafts"]
 */
export function generateCandidates(
  targetSelector: string,
  parentSelectors: string[] = []
): SelectorCandidate[] {
  const candidates = new Set<string>();

  const target = targetSelector.trim();

  if (!target) {
    return [];
  }

  /*
   * Always consider the target by itself.
   */
  if (validateSelector(target)) {
    candidates.add(target);
  }

  /*
   * Remove empty parents.
   */
  const parents = parentSelectors
    .map((parent) => parent.trim())
    .filter(Boolean);

  /*
   * Build selectors using the actual
   * ancestor hierarchy.
   *
   * parents are expected:
   *
   * closest → farthest
   *
   * Example:
   *
   * [
   *   ".mail-item",
   *   ".mail-navigation"
   * ]
   *
   * becomes:
   *
   * .mail-item target
   *
   * .mail-navigation .mail-item target
   */

  for (
    let start = 0;
    start < parents.length;
    start++
  ) {
    const hierarchy =
      parents
        .slice(start)
        .reverse();

    const selector = [
      ...hierarchy,
      target,
    ].join(" ");

    if (validateSelector(selector)) {
      candidates.add(selector);
    }
  }

  /*
   * Score and rank.
   */
  return [...candidates]
    .map((selector) => ({
      selector,
      score: scoreSelector(selector),
    }))
    .sort(
      (a, b) => b.score - a.score
    )
    .slice(0, 3);
}