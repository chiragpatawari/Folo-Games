# Security Specification: Folio Games

## 1. Data Invariants
1. **Identity Isolation**: A `users/{userId}` document, its `dailyCompletions` subcollection, and its `purchasedPuzzles` subcollection can only be read or written by the authenticated, email-verified user whose `request.auth.uid == userId`.
2. **One Play Per Puzzle Per Day**: A `dailyCompletions/{completionId}` document must have `completionId == dateKey + '_' + puzzleType`, `completed == true`, and is strictly immutable once created (`update` and `delete` forbidden).
3. **Virtual Pox Account Integrity**: `users/{userId}.poxBalance` is bounded (`0..1000000` integer), cannot be arbitrarily inflated beyond valid transitions, and purchasing puzzles requires an atomic parent `users/{userId}` update (`existsAfter`).
4. **Purchased Puzzle Integrity**: `users/{userId}/purchasedPuzzles/{puzzleId}` enforces `costPox == 50`, bounded `customWords` array (`<= 12` elements), immutable `id`, `userId`, `puzzleType`, `seedKey`, `costPox`, and `createdAt`, and restricts updates strictly to `['solved', 'bestTimeSeconds', 'updatedAt']`.
5. **Leaderboard Integrity**: A `leaderboardEntries/{entryId}` document must have `entryId == dateKey + '_' + puzzleType + '_' + request.auth.uid`, must be created atomically alongside the corresponding `dailyCompletions` record (`existsAfter`), and is strictly immutable once created.
6. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps must equal `request.time`.

## 2. Adversarial Payloads ("Dirty Dozen")
1. **Unauthenticated profile read/write**: `auth = null` attempting `get` or `create` on `/users/uid1`. -> `PERMISSION_DENIED`
2. **Unverified email write**: `auth = { uid: 'uid1', token: { email_verified: false } }` attempting `create` on `/users/uid1`. -> `PERMISSION_DENIED`
3. **Cross-user profile or puzzle purchase spoofing**: `uid2` attempting `create` on `/users/uid1/purchasedPuzzles/p1`. -> `PERMISSION_DENIED`
4. **Shadow field injection on profile or purchasedPuzzle**: `uid1` sending `{ ..., isAdmin: true }` to `/users/uid1` or `/users/uid1/purchasedPuzzles/p1`. -> `PERMISSION_DENIED`
5. **Negative or excessive poxBalance**: `uid1` setting `poxBalance: -50` or `poxBalance: 99999999` on `/users/uid1`. -> `PERMISSION_DENIED`
6. **Client timestamp forgery**: `uid1` sending `createdAt: Timestamp.fromDate(new Date(0))` instead of `serverTimestamp()`. -> `PERMISSION_DENIED`
7. **Immutable field tampering on purchased puzzle update**: `uid1` modifying `costPox` or `seedKey` on `/users/uid1/purchasedPuzzles/p1`. -> `PERMISSION_DENIED`
8. **Zero-cost puzzle purchase forgery**: Creating `/users/uid1/purchasedPuzzles/p1` with `costPox: 0` instead of `50`. -> `PERMISSION_DENIED`
9. **Oversized customWords array poisoning**: Creating `/users/uid1/purchasedPuzzles/p1` with 500 elements in `customWords`. -> `PERMISSION_DENIED`
10. **Leaderboard without completion**: Creating `/leaderboardEntries/2026-11-18_sudoku_uid1` without an existing or batched `dailyCompletions` document. -> `PERMISSION_DENIED`
11. **Duplicate / replay overwrite on daily completion**: Attempting `update` or `delete` on `/users/uid1/dailyCompletions/2026-11-18_sudoku`. -> `PERMISSION_DENIED`
12. **Oversized ID / string poisoning**: Sending a 200-char `title` or invalid `puzzleId` with slashes/dots. -> `PERMISSION_DENIED`
