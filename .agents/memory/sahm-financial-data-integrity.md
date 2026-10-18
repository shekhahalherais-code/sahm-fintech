---
name: SAHM financial data integrity
description: User's standing constraint for financial values and analysis displayed in SAHM.
---

Only show financial analysis derived from actual source-backed report extraction. Preserve the reported value and expose its reporting period, currency, unit scale, verification status, and source reference when available. Never use visual mockup values, demo figures, or unsupported growth claims; render unavailable states instead.

**Why:** The user repeatedly asked that SAHM not invent figures or present demonstration data as financial results.

**How to apply:** Before changing report, dashboard, or explanation screens, distinguish visual design examples from actual API data and reuse saved-report fields and citations; do not fabricate missing comparisons.
