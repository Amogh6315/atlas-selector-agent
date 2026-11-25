
import { findUniqueSelectors } from "./selectorUniquenessEngine.js";
import type { UniqueSelector } from "./selectorUniquenessEngine.js";
import type { DomAdapter } from "./domAdapter.js";

/**
 * Filter and rank candidate selectors against
 * the actual DOM. Only unique selectors survive.
 */
export function buildUniqueSelectorPipeline(
  candidates: string[],
  dom: DomAdapter
): UniqueSelector[] {
  const uniqueCandidates = [...new Set(
    candidates.map((selector) => selector.trim())
      .filter(Boolean)
  )];

  return findUniqueSelectors(uniqueCandidates, dom);
}
