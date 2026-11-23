# Security Specification — Attendance Shop RBAC & Zero-Trust Privacy

## 1. Data Invariants
1. **Strict Staff Isolation (`staffPrivate`)**: Only the Shop Owner, authorized Managers, or the linked Staff user (`linkedUid == request.auth.uid`) may read a `staffPrivate` document. Other staff in the same shop receive `PERMISSION_DENIED`.
2. **Official vs Self Attendance**: Staff users may only mutate `selfDays` and `updatedAt` on their own `staffPrivate` document. They can never modify `days` (official attendance), `sal` (salary), `money` (advance/payment), `ownerUid`, or delete accounts.
3. **Owner/Manager Monopoly**: Only the Shop Owner (or Owner-designated Manager) can add/delete staff accounts, set salaries, log advances/payments, and mark/approve official attendance (`days`).
4. **No Self-Privilege Escalation (`members`)**: A user joining via `joinCode` can only create a `ShopMember` document with `role == 'staff'` and valid matching `joinCode`. Only the Shop Owner can assign `manager` roles.
5. **PII Isolation (`directory` vs `staffPrivate`)**: Public teammate cards in `directory` contain zero email/phone/salary/attendance ledger data; only `name`, `photo`, `emo`, `roleLabel`, `followersCount`, and 24h status `stories`.
6. **Direct Share Privacy (`shares`)**: WhatsApp-style in-app shared snapshots are readable only by `senderUid`, `recipientUid`, or `ownerUid`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Staff-to-Staff Snooping**: Staff B sends `getDoc(/shops/s1/staffPrivate/staffA)` -> `PERMISSION_DENIED`.
2. **Unscoped List Scraping**: Staff B runs `getDocs(collection(db, 'shops/s1/staffPrivate'))` without `linkedUid == uid` -> `PERMISSION_DENIED`.
3. **Salary Self-Inflation**: Staff A updates `staffPrivate/staffA` with `{ sal: { "2026-11": 999999 }, updatedAt: serverTimestamp() }` -> `PERMISSION_DENIED`.
4. **Advance Deletion**: Staff A updates `staffPrivate/staffA` with `{ money: [], updatedAt: serverTimestamp() }` -> `PERMISSION_DENIED`.
5. **Official Attendance Forgery**: Staff A updates `staffPrivate/staffA` with `{ days: { "2026-11-18": { s: "P" } }, updatedAt: serverTimestamp() }` -> `PERMISSION_DENIED`.
6. **Role Self-Promotion**: Staff A creates `members/uidA` with `{ role: "owner", ... }` -> `PERMISSION_DENIED`.
7. **Unauthorized Shop Join**: Outsider creates `members/uidX` with wrong `joinCode` -> `PERMISSION_DENIED`.
8. **Shadow Ghost Field Injection**: User creates/updates doc with extra `isAdmin: true` field -> `PERMISSION_DENIED` (`hasOnly` check).
9. **ID Path Poisoning**: User targets doc ID `../../../../etc` or 500-char ID -> `PERMISSION_DENIED` (`isValidId` check).
10. **Share Eavesdropping**: Staff C reads `/shops/s1/shares/share1` sent from Staff A to Staff B -> `PERMISSION_DENIED`.
11. **Timestamp Forgery**: User submits backdated `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
12. **Unverified Email Spoofing**: Request with `email_verified: false` attempts write -> `PERMISSION_DENIED`.
