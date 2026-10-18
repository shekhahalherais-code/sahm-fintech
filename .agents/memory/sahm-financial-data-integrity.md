---
name: SAHM financial data integrity
description: User's standing constraint for financial values and analysis displayed in SAHM.
---

Only show financial analysis derived from actual source-backed report extraction. Preserve the reported value and expose its reporting period, currency, unit scale, verification status, and source reference when available. Compare periods only for the same verified metric and label with matching currency and unit scale plus source evidence; if that evidence is absent, state that the trend cannot be determined. Any percentage change must be calculated deterministically from parseable reported amounts, never guessed. Keep source references separate from plain-language meanings and investor interpretation; do not repeat the filename, page, reporting year, or extracted amount in the interpretation.

**Why:** The user repeatedly asked that SAHM not invent figures or present demonstration data as financial results; like-for-like evidence is required to prevent unsupported trend claims.

**How to apply:** Before changing report, dashboard, or explanation screens, distinguish visual design examples from actual API data and reuse saved-report fields and citations. If comparable verified periods are missing, explain the limitation rather than filling it in.
