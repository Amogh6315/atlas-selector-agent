import {
  validateSelector,
  scoreSelector,
  cleanSelectors,
} from "./selectorValidator.js";

const testSelectors = [
  '[data-testid="submit-button"]',
  '[data-tooltip="Drafts"]',
  'button[name="submit"]',
  '#checkout-form',
  '.checkout-form',
  '.container',
  '.item',
  '.css-1a2b3c',
  '.sc-bdfBwQ',
  'button:nth-child(3)',
  'abc123def456',
  '550e8400-e29b-41d4-a716-446655440000',
];

console.log("\nAtlas Selector Validator Test\n");

for (const selector of testSelectors) {
  const valid = validateSelector(selector);

  console.log(
    `${valid ? "✅" : "❌"} ${selector}`
  );

  if (valid) {
    console.log(
      `   Score: ${scoreSelector(selector)}`
    );
  }
}

console.log("\nRanking test\n");

const geminiOutput = `
[data-tooltip="Drafts"]
.container
[data-testid="submit-button"]
button[name="submit"]
.css-1a2b3c
button:nth-child(3)
`;

const results = cleanSelectors(geminiOutput);

console.log("Cleaned selectors:");

for (const selector of results) {
  console.log(
    `→ ${selector} (${scoreSelector(selector)})`
  );
}