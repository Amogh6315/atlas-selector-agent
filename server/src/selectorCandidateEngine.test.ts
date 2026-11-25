import {
  generateCandidates,
} from "./selectorCandidateEngine.js";

const target =
  '[data-tooltip="Drafts"]';

const parents = [
  ".mail-item",
  ".mail-navigation",
];

const candidates =
  generateCandidates(
    target,
    parents
  );

console.log(
  "\nAtlas Candidate Generation Test\n"
);

for (const candidate of candidates) {
  console.log(
    `→ ${candidate.selector}`
  );

  console.log(
    `  Score: ${candidate.score}`
  );
}