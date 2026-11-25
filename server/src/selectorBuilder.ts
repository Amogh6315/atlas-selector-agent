import {
  validateSelector,
  scoreSelector,
} from "./selectorValidator.js";

import {
  createDomAdapter,
} from "./domAdapter.js";

export interface BuiltSelector {
  selector: string;
  matches: number;
  score: number;
}

/**
 * Escape a value for use inside a CSS
 * attribute selector.
 */
function escapeAttributeValue(
  value: string
): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

/**
 * Classes that are generally styling/layout
 * classes and should not be preferred.
 */
function isGenericClass(
  className: string
): boolean {
  const genericClasses = new Set([
    "flex",
    "inline-flex",
    "grid",
    "block",
    "inline",
    "inline-block",
    "hidden",
    "relative",
    "absolute",
    "fixed",
    "sticky",
    "static",

    "container",
    "wrapper",
    "row",
    "column",

    "active",
    "selected",
    "disabled",
    "enabled",
    "visible",
    "hidden",

    "button",
    "btn",
    "icon",
    "text",
    "label",
    "content",

    "w-full",
    "h-full",
    "w-auto",
    "h-auto",

    "items-center",
    "justify-center",
    "justify-between",

    "mx-auto",
    "m-auto",

    "p-1",
    "p-2",
    "p-3",
    "p-4",
    "px-1",
    "px-2",
    "px-3",
    "px-4",
    "py-1",
    "py-2",
    "py-3",
    "py-4",
  ]);

  return genericClasses.has(
    className.toLowerCase()
  );
}

/**
 * Determine whether a class looks meaningful.
 */
function isMeaningfulClass(
  className: string
): boolean {
  const value = className.trim();

  if (!value) {
    return false;
  }

  if (isGenericClass(value)) {
    return false;
  }

  /*
   * Reject obvious generated-looking
   * classes.
   */
  if (/^css-[a-z0-9_-]+$/i.test(value)) {
    return false;
  }

  if (/^sc-[a-z0-9_-]+$/i.test(value)) {
    return false;
  }

  if (/^emotion-[a-z0-9_-]+$/i.test(value)) {
    return false;
  }

  if (/^[a-f0-9]{8,}$/i.test(value)) {
    return false;
  }

  /*
   * UUID-like value.
   */
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Get stable attribute candidates.
 */
function getAttributeCandidates(
  element: Element
): string[] {
  const candidates: string[] = [];

  /*
   * Highest priority attributes.
   */
  const preferredAttributes = [
    "data-testid",
    "data-test",
    "data-cy",
    "data-qa",
    "data-tooltip",
    "data-name",
  ];

  for (
    const attribute of preferredAttributes
  ) {
    const value =
      element.getAttribute(attribute);

    if (!value) {
      continue;
    }

    candidates.push(
      `[${attribute}="${escapeAttributeValue(value)}"]`
    );
  }

  /*
   * Semantic attributes.
   */
  const name =
    element.getAttribute("name");

  if (name) {
    candidates.push(
      `[name="${escapeAttributeValue(name)}"]`
    );
  }

  const ariaLabel =
    element.getAttribute("aria-label");

  if (ariaLabel) {
    candidates.push(
      `[aria-label="${escapeAttributeValue(ariaLabel)}"]`
    );
  }

  const role =
    element.getAttribute("role");

  if (role) {
    candidates.push(
      `[role="${escapeAttributeValue(role)}"]`
    );
  }

  const type =
    element.getAttribute("type");

  if (type) {
    candidates.push(
      `[type="${escapeAttributeValue(type)}"]`
    );
  }

  /*
   * Developer-defined ID.
   */
  const id =
    element.getAttribute("id");

  if (id) {
    candidates.push(
      `[id="${escapeAttributeValue(id)}"]`
    );
  }

  return candidates;
}

/**
 * Get meaningful class candidates.
 *
 * Example:
 *
 * class="flex display mail-box"
 *
 * produces:
 *
 * [class*="display"]
 * [class*="mail-box"]
 *
 * while avoiding:
 *
 * [class*="flex"]
 */
function getClassCandidates(
  element: Element
): string[] {
  const classNames =
    Array.from(element.classList);

  return classNames
    .filter(isMeaningfulClass)
    .map(
      (className) =>
        `[class*="${escapeAttributeValue(className)}"]`
    );
}

/**
 * Get tag selector.
 */
function getTagCandidate(
  element: Element
): string {
  return element.tagName.toLowerCase();
}

/**
 * Get every possible selector for
 * a DOM element.
 */
function getElementCandidates(
  element: Element
): string[] {
  return [
    ...getAttributeCandidates(element),
    ...getClassCandidates(element),
    getTagCandidate(element),
  ];
}

/**
 * Remove duplicate candidates.
 */
function uniqueCandidates(
  candidates: string[]
): string[] {
  return [...new Set(candidates)];
}

/**
 * Build the best unique selector.
 */
export function buildBestSelector(
  element: Element
): BuiltSelector | null {
  const document =
    element.ownerDocument;

  if (!document) {
    return null;
  }

  const dom =
    createDomAdapter(document);

  /*
   * ====================================
   * STEP 1
   * Try direct selectors.
   * ====================================
   */

  const targetCandidates =
    uniqueCandidates(
      getElementCandidates(element)
    );

  for (
    const candidate of targetCandidates
  ) {
    if (!validateSelector(candidate)) {
      continue;
    }

    const matches =
      dom.countMatches(candidate);

    if (matches === 1) {
      return {
        selector: candidate,
        matches,
        score: scoreSelector(candidate),
      };
    }
  }

  /*
   * ====================================
   * STEP 2
   * Collect ancestors.
   * ====================================
   */

  const parents: Element[] = [];

  let current =
    element.parentElement;

  const MAX_DEPTH = 6;

  let depth = 0;

  while (
    current &&
    depth < MAX_DEPTH
  ) {
    parents.push(current);

    current =
      current.parentElement;

    depth++;
  }

  /*
   * ====================================
   * STEP 3
   *
   * Try EVERY candidate from EVERY
   * parent.
   * ====================================
   */

  const successfulSelectors:
    BuiltSelector[] = [];

  for (
    const target of targetCandidates
  ) {
    if (!validateSelector(target)) {
      continue;
    }

    /*
     * Start with the closest parent.
     */
    for (
      let depth = 0;
      depth < parents.length;
      depth++
    ) {
      const hierarchy =
        parents
          .slice(0, depth + 1)
          .reverse();

      /*
       * Generate ALL candidate selectors
       * for every parent.
       */
      const parentCandidateGroups =
        hierarchy.map(
          (parent) =>
            uniqueCandidates(
              getElementCandidates(parent)
            ).filter(validateSelector)
        );

      /*
       * Generate combinations of the
       * parent candidates.
       *
       * Example:
       *
       * [
       *   [class*="mail-navigation"],
       *   [class*="mail-item"],
       *   [class*="secondary-navigation"]
       * ]
       *
       * We try combinations rather than
       * blindly choosing the first class.
       */
      function buildCombinations(
        groups: string[][],
        index = 0,
        currentPath: string[] = []
      ): string[][] {
        if (index >= groups.length) {
          return [currentPath];
        }

        const results: string[][] = [];

        for (
          const candidate of groups[index]
        ) {
          results.push(
            ...buildCombinations(
              groups,
              index + 1,
              [
                ...currentPath,
                candidate,
              ]
            )
          );
        }

        return results;
      }

      const combinations =
        buildCombinations(
          parentCandidateGroups
        );

      for (
        const combination of combinations
      ) {
        const selector = [
          ...combination,
          target,
        ].join(" ");

        if (
          !validateSelector(selector)
        ) {
          continue;
        }

        const matches =
          dom.countMatches(selector);

        if (matches === 1) {
          successfulSelectors.push({
            selector,
            matches,
            score:
              scoreSelector(selector),
          });
        }
      }

      /*
       * Once we have a unique selector
       * at this DOM depth, don't need to
       * go deeper unless a better selector
       * is discovered.
       */
      if (
        successfulSelectors.length > 0
      ) {
        break;
      }
    }
  }

  /*
   * ====================================
   * STEP 4
   * Rank successful selectors.
   * ====================================
   */

  if (
    successfulSelectors.length > 0
  ) {
    successfulSelectors.sort(
      (a, b) => {
        /*
         * Higher semantic score first.
         */
        if (a.score !== b.score) {
          return b.score - a.score;
        }

        /*
         * If scores are equal,
         * prefer shorter selector.
         */
        return (
          a.selector.length -
          b.selector.length
        );
      }
    );

    return successfulSelectors[0];
  }

  /*
   * ====================================
   * STEP 5
   * Last resort: unique tag.
   * ====================================
   */

  const tag =
    getTagCandidate(element);

  if (
    dom.countMatches(tag) === 1
  ) {
    return {
      selector: tag,
      matches: 1,
      score: scoreSelector(tag),
    };
  }

  return null;
}

/**
 * Build up to three unique selectors for an element.
 *
 * Keeps buildBestSelector() unchanged for existing callers.
 */

/**
 * Build up to three unique selectors for an element.
 * Prefer semantic attributes, then meaningful classes,
 * then parent-qualified selectors.
 */
export function buildTopSelectors(
  element: Element
): BuiltSelector[] {
  const document = element.ownerDocument;

  if (!document) {
    return [];
  }

  const dom = createDomAdapter(document);
  const candidates: BuiltSelector[] = [];

  const addCandidate = (selector: string) => {
    if (!validateSelector(selector)) {
      return;
    }

    if (
      candidates.some(
        (candidate) => candidate.selector === selector
      )
    ) {
      return;
    }

    const matches = dom.countMatches(selector);

    if (matches !== 1) {
      return;
    }

    candidates.push({
      selector,
      matches,
      score: scoreSelector(selector),
    });
  };

  // Try the existing builder's best result first.
  const best = buildBestSelector(element);

  if (best) {
    addCandidate(best.selector);
  }

  // Collect direct candidates from stable attributes and classes.
  const directCandidates = [
    ...getAttributeCandidates(element),
    ...getClassCandidates(element),
  ];

  for (const candidate of directCandidates) {
    addCandidate(candidate);
  }

  // Add parent-qualified alternatives.
  let parent = element.parentElement;
  let depth = 0;
  const maxDepth = 6;

  while (parent && depth < maxDepth) {
    const parentCandidates = [
      ...getAttributeCandidates(parent),
      ...getClassCandidates(parent),
    ];

    for (const parentCandidate of parentCandidates) {
      for (const targetCandidate of directCandidates) {
        addCandidate(
          `${parentCandidate} ${targetCandidate}`
        );
      }
    }

    parent = parent.parentElement;
    depth++;
  }

  // Rank by selector quality first, then shorter selectors.
  candidates.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    return a.selector.length - b.selector.length;
  });

  return candidates.slice(0, 3);
}
