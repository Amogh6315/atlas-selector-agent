const DYNAMIC_PATTERNS = [
  /^css-[a-z0-9_-]+$/i,
  /^sc-[a-z0-9_-]+$/i,
  /^emotion-[a-z0-9_-]+$/i,
  /^mui[a-z0-9_-]*-\d+$/i,
  /^chakra-[a-z0-9_-]+$/i,
  /^chakraui-[a-z0-9_-]+$/i,
  /^ng-[a-z0-9_-]+$/i,
  /^jsx-[a-z0-9_-]+$/i,
  /^vue-[a-z0-9_-]+$/i,
  /^svelte-[a-z0-9_-]+$/i,
  /^:[a-z0-9]+:$/i,
];

const HASH_PATTERN =
  /^[a-f0-9]{8,}$/i;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RANDOM_ALPHANUMERIC_PATTERN =
  /^(?=.*[a-z])(?=.*\d)[a-z0-9]{8,}$/i;

const POSITIONAL_PATTERN =
  /:nth-(child|of-type|last-child|first-child)/i;

const INVALID_PSEUDO_PATTERN =
  /:(has|is|where|not)\(/i;

const GENERIC_CLASSES = new Set([
  "active",
  "selected",
  "disabled",
  "hidden",
  "visible",
  "show",
  "hide",
  "open",
  "close",
  "container",
  "wrapper",
  "row",
  "column",
  "item",
  "button",
  "btn",
  "text",
  "label",
  "icon",
  "content",
  "root",
  "main",
  "header",
  "footer",
  "left",
  "right",
  "top",
  "bottom",
]);

/**
 * Detect values that look generated,
 * hashed, framework-generated, UUID-like,
 * or randomly generated.
 */
export function looksDynamic(value: string): boolean {
  const normalized = value.trim();

  if (!normalized) {
    return true;
  }

  if (UUID_PATTERN.test(normalized)) {
    return true;
  }

  if (HASH_PATTERN.test(normalized)) {
    return true;
  }

  if (
    DYNAMIC_PATTERNS.some((pattern) =>
      pattern.test(normalized)
    )
  ) {
    return true;
  }

  if (
    RANDOM_ALPHANUMERIC_PATTERN.test(normalized) &&
    normalized.length >= 8
  ) {
    return true;
  }

  return false;
}

/**
 * Check whether a class name is meaningful.
 */
function isMeaningfulClass(
  className: string
): boolean {
  const value = className.trim();

  if (!value) {
    return false;
  }

  if (looksDynamic(value)) {
    return false;
  }

  if (
    GENERIC_CLASSES.has(
      value.toLowerCase()
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Extract classes.
 */
function extractClasses(
  selector: string
): string[] {
  const matches =
    selector.match(/\.([a-zA-Z0-9_-]+)/g) || [];

  return matches.map(
    (item) => item.substring(1)
  );
}

/**
 * Extract IDs.
 */
function extractIds(
  selector: string
): string[] {
  const matches =
    selector.match(/#([a-zA-Z0-9_-]+)/g) || [];

  return matches.map(
    (item) => item.substring(1)
  );
}

/**
 * Extract attribute selectors.
 */
function extractAttributes(
  selector: string
): string[] {
  return (
    selector.match(/\[[^\]]+\]/g) || []
  );
}

/**
 * Extract values from attribute selectors.
 *
 * Example:
 *
 * [data-testid="submit-button"]
 *
 * returns:
 *
 * submit-button
 */
function extractAttributeValues(
  selector: string
): string[] {
  const attributes =
    extractAttributes(selector);

  const values: string[] = [];

  for (const attribute of attributes) {
    const match = attribute.match(
      /=\s*["']([^"']+)["']/
    );

    if (match?.[1]) {
      values.push(match[1]);
    }
  }

  return values;
}

/**
 * Check whether a selector contains a
 * dynamic value anywhere inside it.
 */
function containsDynamicValue(
  selector: string
): boolean {
  const ids = extractIds(selector);

  for (const id of ids) {
    if (looksDynamic(id)) {
      return true;
    }
  }

  const classes = extractClasses(selector);

  for (const className of classes) {
    if (looksDynamic(className)) {
      return true;
    }
  }

  const attributeValues =
    extractAttributeValues(selector);

  for (const value of attributeValues) {
    if (looksDynamic(value)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate one CSS selector.
 */
export function validateSelector(
  selector: string
): boolean {
  const value = selector.trim();

  if (!value) {
    return false;
  }

  if (value === "NONE") {
    return false;
  }

  /*
   * Reject a completely random-looking
   * selector value.
   *
   * Example:
   *
   * abc123def456
   * 550e8400-e29b-41d4-a716-446655440000
   */
  if (looksDynamic(value)) {
    return false;
  }

  /*
   * Reject positional selectors.
   */
  if (POSITIONAL_PATTERN.test(value)) {
    return false;
  }

  /*
   * Reject complex pseudo selectors in V1.
   */
  if (INVALID_PSEUDO_PATTERN.test(value)) {
    return false;
  }

  /*
   * Reject inline style selectors.
   */
  if (/style\s*=/i.test(value)) {
    return false;
  }

  /*
   * Reject XPath.
   */
  if (
    value.startsWith("/") ||
    value.startsWith("(") ||
    value.includes("ancestor::") ||
    value.includes("descendant::")
  ) {
    return false;
  }

  /*
   * Reject selectors containing dynamic values.
   */
  if (containsDynamicValue(value)) {
    return false;
  }

  /*
   * Validate classes.
   */
  const classes = extractClasses(value);

  for (const className of classes) {
    if (!isMeaningfulClass(className)) {
      return false;
    }
  }

  return true;
}

/**
 * Score selector quality.
 *
 * Higher score = better selector.
 */
export function scoreSelector(
  selector: string
): number {
  let score = 0;

  const value = selector.trim();

  /*
   * Strong testing attributes.
   */
  if (
    /\[data-testid\s*=/i.test(value)
  ) {
    score += 100;
  }

  if (
    /\[data-test\s*=/i.test(value)
  ) {
    score += 95;
  }

  if (
    /\[data-cy\s*=/i.test(value)
  ) {
    score += 95;
  }

  /*
   * Other data attributes.
   */
  if (
    /\[data-[a-z-]+\s*=/i.test(value)
  ) {
    score += 80;
  }
if (
  /\[class\*=\s*["'][^"']+["']\]/i.test(
    value
  )
) {
  score += 35;
}
  /*
   * Semantic attributes.
   */
  if (
    /\[name\s*=/i.test(value)
  ) {
    score += 70;
  }

  if (
    /\[aria-label\s*=/i.test(value)
  ) {
    score += 65;
  }

  if (
    /\[role\s*=/i.test(value)
  ) {
    score += 50;
  }

  if (
    /\[type\s*=/i.test(value)
  ) {
    score += 45;
  }

  /*
   * Meaningful ID.
   */
  const ids = extractIds(value);

  for (const id of ids) {
    if (!looksDynamic(id)) {
      score += 60;
    }
  }

  /*
   * Meaningful classes.
   */
  const classes = extractClasses(value);

  for (const className of classes) {
    if (isMeaningfulClass(className)) {
      score += 30;
    }
  }

  /*
   * Prefer shorter selectors.
   */
  score -= value.length * 0.15;

  /*
   * Penalize unnecessarily deep selectors.
   */
  const depth =
    value.split(/\s+/).length;

  if (depth > 1) {
    score -= (depth - 1) * 5;
  }

  return score;
}

/**
 * Clean Gemini output,
 * remove invalid selectors,
 * remove duplicates,
 * rank selectors,
 * return top 3.
 */
export function cleanSelectors(
  output: string
): string[] {
  const candidates = output
    .split("\n")
    .map((line) => line.trim())
    .map((line) =>
      line.replace(/^[-*]\s*/, "")
    )
    .map((line) =>
      line.replace(/^["']|["']$/g, "")
    )
    .map((line) =>
      line.replace(/^```css\s*/i, "")
    )
    .map((line) =>
      line.replace(/```$/g, "")
    )
    .filter(Boolean);

  const validSelectors =
    candidates.filter(
      validateSelector
    );

  const uniqueSelectors = [
    ...new Set(validSelectors),
  ];

  uniqueSelectors.sort(
    (a, b) =>
      scoreSelector(b) -
      scoreSelector(a)
  );

  return uniqueSelectors.slice(0, 3);
}