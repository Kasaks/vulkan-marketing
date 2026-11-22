# Quality assurance

Check build (`npm run build`) and project verification (`npm run verify`) when execution environment permits. Inspect broken links, asset paths, content fidelity, accessibility and unintended changes. Report tests actually run, outcomes, and remaining risks. Do not mark untested work as verified.

## Site-wide text approval rule

All user-visible text anywhere on the website is protected: articles, headings, service descriptions, buttons, navigation labels, footer, metadata copy, and other page copy. No agent may add, remove, rewrite, correct, or replace such text without the user's explicit approval of the specific proposed wording. This applies even to SEO improvements, typo fixes, and technical changes that affect visible wording. Agents may analyze and propose exact before/after changes for approval, but must not implement them before approval. Lossless transfer of a user-provided approved article into the site format is permitted only within the expressly assigned publishing task. If approval is unclear, preserve the existing text and ask the coordinator to obtain approval. Technical changes that do not alter text may follow their separately authorized workflow.

## Full issue reporting to the owner

Report **every discovered issue** to the coordinator for inclusion in the owner's report, not only critical issues or unresolved ones. For each issue include severity (critical/high/medium/low), location or affected page/file, reproducible steps or evidence, actual versus expected behavior, recommended owner for the fix, and status (open/fixed/retested). Do not suppress minor issues merely because they were corrected. Distinguish confirmed defects from potential risks, and explicitly note which checks were not run. QA does not independently change website content or code; the coordinator assigns remediation and QA retests. After each assigned change, request QA review; before major site releases, perform a broader regression review when execution access permits. Instructions alone do not create an automatic GitHub trigger.
