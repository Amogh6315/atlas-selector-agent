import { JSDOM } from "jsdom";

import {
    createDomAdapter,
} from "./domAdapter.js";

import {
    findUniqueSelectors,
} from "./selectorUniquenessEngine.js";

const html = `
<!DOCTYPE html>

<html>
  <body>

    <aside id="sidebar">

      <div class="mail-navigation">

      <div class="mail-navigation">

  <div class="mail-item">
    <div data-tooltip="Inbox">
      Inbox
    </div>
  </div>

  <div class="mail-item">
    <div data-tooltip="Drafts">
      Drafts
    </div>
  </div>

  <div class="mail-item secondary-navigation">
    <div data-tooltip="Drafts">
      Drafts
    </div>
  </div>

  <div class="mail-item">
    <div data-tooltip="Sent">
      Sent
    </div>
  </div>

</div>

      </div>

    </aside>

  </body>
</html>
`;

const dom = new JSDOM(html);

const adapter =
    createDomAdapter(dom.window.document);

const selectors = [
  '[data-tooltip="Drafts"]',

  '.mail-item [data-tooltip="Drafts"]',

  '.mail-navigation [data-tooltip="Drafts"]',

  '.mail-item.secondary-navigation [data-tooltip="Drafts"]',

  '.mail-navigation .mail-item.secondary-navigation [data-tooltip="Drafts"]',

  '#sidebar .mail-navigation .mail-item.secondary-navigation [data-tooltip="Drafts"]',
];

console.log(
    "\nAtlas Selector Uniqueness Test\n"
);

for (const selector of selectors) {
    const matches =
        adapter.countMatches(selector);

    console.log(
        `${matches === 1 ? "✅" : "❌"} ${selector}`
    );

    console.log(
        `   Matches: ${matches}`
    );
}

console.log(
    "\nUnique selectors:\n"
);

const uniqueSelectors =
    findUniqueSelectors(
        selectors,
        adapter
    );

for (const result of uniqueSelectors) {
    console.log(
        `→ ${result.selector}`
    );

    console.log(
        `  Matches: ${result.matches}`
    );
}