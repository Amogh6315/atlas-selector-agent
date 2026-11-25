import {
  scoreSelector,
  validateSelector,
} from "./selectorValidator.js";

import type {
  DomAdapter,
} from "./domAdapter.js";

export interface UniqueSelector {
  selector: string;
  matches: number;
  score: number;
}

/**
 * Test a selector against the DOM
 * and determine whether it uniquely
 * identifies one element.
 */
export function testSelector(
  selector: string,
  dom: DomAdapter
): UniqueSelector | null {
  if (!validateSelector(selector)) {
    return null;
  }

  const matches =
    dom.countMatches(selector);

  return {
    selector,
    matches,
    score: scoreSelector(selector),
  };
}

/**
 * Find selectors that uniquely identify
 * exactly one element.
 */
export function findUniqueSelectors(
  selectors: string[],
  dom: DomAdapter
): UniqueSelector[] {
  const results: UniqueSelector[] = [];

  for (const selector of selectors) {
    const result =
      testSelector(selector, dom);

    if (!result) {
      continue;
    }

    if (result.matches === 1) {
      results.push(result);
    }
  }

  /*
   * Prefer shorter selectors when multiple
   * selectors uniquely identify the element.
   *
   * Stable selectors should be preferred,
   * but unnecessary DOM depth should be avoided.
   */
  results.sort((a, b) => {
    const depthA =
      a.selector.split(/\s+/).length;

    const depthB =
      b.selector.split(/\s+/).length;

    if (depthA !== depthB) {
      return depthA - depthB;
    }

    return a.selector.length -
      b.selector.length;
  });

  return results.slice(0, 3);
}