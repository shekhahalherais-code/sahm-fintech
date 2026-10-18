---
name: Arabic financial PDF extraction
description: Reliable extraction and source checking for Arabic financial statement tables.
---

Arabic PDF financial tables may expose numbers as several positioned PDF.js text items, including punctuation-only fragments. Reconstruct numeric cells from item coordinates and widths, and select the reporting-year column from the table header instead of tokenizing the flattened row.

**Why:** Flattened text can merge current/prior-year amounts and lose commas, while broad label matching can cite narrative mentions instead of audited statements.

**How to apply:** Locate the audited statement page first, identify its year and unit headers, reassemble only the matching numeric column, and require a source-page citation before marking a value verified.
