
import { JSDOM } from "jsdom";
import { createDomAdapter } from "./domAdapter.js";
import { buildUniqueSelectorPipeline } from "./selectorPipeline.js";

const dom = new JSDOM(`
  <nav class="mail-navigation">
    <button class="flex display mail-box" data-tooltip="Drafts">
      Drafts
    </button>
    <button class="flex display mail-box" data-tooltip="Sent">
      Sent
    </button>
  </nav>
`);

const adapter = createDomAdapter(dom.window.document);

const candidates = [
  '[class*="mail-box"]',
  '[data-tooltip="Drafts"]',
  '[data-tooltip="Drafts"]',
  '.mail-item:nth-child(2)',
  '.mail-navigation [data-tooltip="Drafts"]',
];

const results = buildUniqueSelectorPipeline(candidates, adapter);

console.log("Final unique selectors:");
console.log(results);

const allUnique = results.every((result) => result.matches === 1);
const noDuplicates =
  new Set(results.map((result) => result.selector)).size === results.length;
const positionalExcluded =
  !results.some((result) => result.selector.includes(":nth-child"));

if (allUnique && noDuplicates && positionalExcluded) {
  console.log("\nPASS: Unified selector pipeline works.");
} else {
  console.error("\nFAIL: Pipeline checks failed.");
  process.exitCode = 1;
}
