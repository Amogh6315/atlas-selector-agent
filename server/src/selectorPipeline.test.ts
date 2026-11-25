
import {
  cleanSelectors,
  validateSelector,
} from "./selectorValidator.js";

const cases = [
  {
    name: "Stable data attribute",
    selector: '[data-tooltip="Drafts"]',
    expected: true,
  },
  {
    name: "Meaningful class substring",
    selector: '[class*="mail-box"]',
    expected: true,
  },
  {
    name: "Positional selector",
    selector: ".mail-item:nth-child(2)",
    expected: false,
  },
];

let failures = 0;

for (const testCase of cases) {
  const actual = validateSelector(testCase.selector);
  const passed = actual === testCase.expected;

  console.log(
    `${passed ? "PASS" : "FAIL"}: ${testCase.name}`
  );

  if (!passed) {
    failures++;
    console.log(
      `  Expected: ${testCase.expected}, received: ${actual}`
    );
  }
}

const cleaned = cleanSelectors(
  '[data-tooltip="Drafts"]\n' +
  '.mail-item:nth-child(2)\n' +
  '[class*="mail-box"]'
);

console.log("\nCleaned selectors:", cleaned);

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log("\nAll validator checks passed.");
}
