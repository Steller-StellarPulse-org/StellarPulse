# Contributing to StellarPulse

Thanks for helping build StellarPulse — a prediction market on Stellar + Soroban.
This repo is a monorepo: **Soroban/Rust contracts** under `contracts/` and a
**Next.js + TypeScript frontend** under `frontend/`.

## The Wave workflow

StellarPulse uses **Wave issues** for community bounties. Wave issues are labeled
[`wave`](https://github.com/Steller-StellarPulse-org/StellarPulse/labels/wave)
and are paid out (in crypto) once the corresponding PR is reviewed and merged.

### 1. Pick an issue
- Browse the open [`wave` issues](https://github.com/Steller-StellarPulse-org/StellarPulse/issues?q=is%3Aissue+is%3Aopen+label%3Awave).
- Prefer issues with **no assignee and no linked PR** — check the comments first.
- **Claim it before you start**: comment on the issue (e.g. `/try` or a short note
  saying you're taking it) so others don't duplicate your work.
- Work on **one issue at a time** per contributor.

### 2. Fork and branch
- Fork the repo and clone your fork.
- Create a dedicated branch per issue, named after the change type and a short slug:
  - `fix/<short-description>` — bug fixes
  - `feat/<short-description>` — features
  - `chore/<short-description>` — chores / cleanup
  - `docs/<short-description>` — documentation
  - `test/<short-description>` — test-only changes

### 3. Make the change
- Keep PRs **small and focused** — one issue per PR.
- Match the existing code style; don't reformat unrelated code.
- Add or update **tests** when the issue's acceptance criteria call for them
  (most bug/chore issues do).
- Use **conventional commits**:
  `fix(leaderboard): stable sort with tiebreakers`, `chore(frontend): remove unused imports`,
  `test(market): cover two-actor resolve race`, `docs: add CONTRIBUTING.md`.
- Reference the issue in the commit body and the PR body with `Fixes #<number>` so
  the issue auto-closes on merge.

### 4. Tests
- **Frontend** (TypeScript): unit tests live in `frontend/src/__tests__/` and run with
  **vitest**. Keep helpers pure where possible so they're easy to test.
- **Contracts** (Rust/Soroban): tests live next to each contract
  (`contracts/<name>/src/tests.rs`) and run with **cargo test**.
- If you can't run the suite locally, say so in the PR and describe how you
  verified the change instead.

### 5. Open the PR
- Push your branch to your fork and open a PR against `main`.
- Fill in a clear description: **root cause**, **what changed**, and how it meets
  the issue's **acceptance criteria**.
- Link the issue with `Fixes #<number>`.
- Post a comment on the issue linking your PR.

## PR checklist
- [ ] One issue per PR, claimed on the issue first
- [ ] Branch named `fix|feat|chore|docs|test/<slug>`
- [ ] Conventional commit message
- [ ] Tests added/updated where the acceptance criteria require them
- [ ] PR body explains root cause + how the criteria are met
- [ ] `Fixes #<number>` included

## Etiquette
- Be respectful and concise in issues and reviews.
- Don't spam low-effort or duplicate PRs — quality over quantity.
- Respond to review feedback promptly; push follow-up commits to the same branch.
- If you can no longer finish an issue, comment so someone else can pick it up.

## Getting help
Open an issue (or comment on an existing one) if you're stuck or the acceptance
criteria are unclear — ask before building on assumptions.
