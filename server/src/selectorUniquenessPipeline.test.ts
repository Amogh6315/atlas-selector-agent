
import { JSDOM } from "jsdom";
import { createDomAdapter } from "./domAdapter.js";
import {
  findUniqueSelectors,
} from "./selectorUniquenessEngine.js";

const dom = new JSDOM(`
  <nav class="mail-navigation">
    <button class="flex display mail-box"
            data-tooltip="Drafts">
      Drafts
    </button>

    <button class="flex display mail-box"
            data-tooltip="Sent">
      Sent
    </button>
  </nav>
`);

const document = dom.window.document;
const adapter = createDomAdapter(document);

const selectors = [
  '[data-tooltip="Drafts"]',
  '[class*="mail-box"]',
  ".mail-navigation [data-tooltip='Drafts']",
];

const results = findUniqueSelectors(selectors, adapter);

console.log("Unique selector results:");
console.log(results);

const draftCount = adapter.countMatches(
  '[data-tooltip="Drafts"]'
);

const classCount = adapter.countMatches(
  '[class*="mail-box"]'
);

console.log("\nDraft selector matches:", draftCount);
console.log("Mail-box selector matches:", classCount);

if (draftCount !== 1 || classCount !== 2) {
  console.error("FAIL: DOM matching counts are incorrect.");
  process.exitCode = 1;
} else {
  console.log("PASS: DOM matching counts are correct.");
}
