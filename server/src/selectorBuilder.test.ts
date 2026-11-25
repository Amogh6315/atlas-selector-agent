import { JSDOM } from "jsdom";

import {
  buildBestSelector,
} from "./selectorBuilder.js";

const html = `
<!DOCTYPE html>

<html>
  <body>

    <aside id="sidebar">

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

    </aside>

  </body>
</html>
`;

const dom = new JSDOM(html);

const document =
  dom.window.document;

/*
 * Select the SECOND Drafts element.
 */
const target =
  document.querySelector(
    ".secondary-navigation [data-tooltip='Drafts']"
  );

if (!target) {
  throw new Error(
    "Target element not found"
  );
}

const result =
  buildBestSelector(target);

console.log(
  "\nAtlas Selector Builder Test\n"
);

if (!result) {
  console.log(
    "❌ No selector could be generated."
  );
} else {
  console.log(
    `✅ Selector: ${result.selector}`
  );

  console.log(
    `Matches: ${result.matches}`
  );

  console.log(
    `Score: ${result.score}`
  );
}