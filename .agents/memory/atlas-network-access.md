---
name: Atlas network access from Replit
description: Connecting SAHM's external MongoDB Atlas cluster from the Replit development runtime.
---

MongoDB Atlas connections from Replit development require the runtime's current outbound IP to be allowed in Atlas. The address may change; do not assume it is stable, and treat published deployment networking separately.

**Why:** Atlas rejected the app's connection until the Replit runtime address was allowlisted.

**How to apply:** When Atlas server selection fails despite a configured URI, check the current development egress IP and add only that host address to Atlas's IP access list. Avoid opening the cluster to all IPv4 addresses as a default fix.
