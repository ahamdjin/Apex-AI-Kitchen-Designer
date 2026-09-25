---
name: Public catalog contributions
description: Policy boundary between open submissions and private catalog administration.
---

Public visitors may contribute products, but contribution does not grant edit, delete, import, internal inventory access, or verified status. Keep that boundary when expanding catalog workflows.

**Why:** The owner requested that anyone can add products, not that anyone can administer inventory. Product records also contain internal cost, stock, and notes. Publicly contributed metadata may influence generated concepts while unreviewed, so consider review before relying on it as authoritative inventory.

**How to apply:** For new catalog fields and endpoints, decide explicitly whether each is public submission data or private administration data; never reuse an admin response or mutation contract as the public one.