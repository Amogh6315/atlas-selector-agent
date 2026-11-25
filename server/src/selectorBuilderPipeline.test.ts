
import { JSDOM } from "jsdom";
import {
  buildBestSelector,
  buildTopSelectors,
} from "./selectorBuilder.js";

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

const document = dom.window.document;
const target = document.querySelector(
  '[data-tooltip="Drafts"]'
);

if (!target) {
  throw new Error("Drafts button not found.");
}

const result = buildBestSelector(target);

console.log("Builder result:", result);

if (result && result.matches === 1) {
  console.log("PASS: Builder returned a unique selector.");
} else {
  console.error("FAIL: Builder did not return a unique selector.");
  process.exitCode = 1;
}
const topSelectors = buildTopSelectors(target);

console.log("\nTop selector alternatives:");
console.log(topSelectors);

const allUnique = topSelectors.every(
  (item) => item.matches === 1
);

const noDuplicates =
  new Set(topSelectors.map((item) => item.selector)).size ===
  topSelectors.length;

if (
  topSelectors.length >= 1 &&
  topSelectors.length <= 3 &&
  allUnique &&
  noDuplicates
) {
  console.log("PASS: Top selectors are unique and deduplicated.");
} else {
  console.error("FAIL: Top selector checks failed.");
  process.exitCode = 1;
}