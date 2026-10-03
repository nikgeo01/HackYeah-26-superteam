# Working rules

These rules apply to everyone who changes this repository. The full plan is in
[`docs/PLAN.md`](docs/PLAN.md); from the interface freeze on, the on-chain contract is
[`docs/INTERFACE.md`](docs/INTERFACE.md), and it wins over the plan if the two disagree.

## First thing after cloning

```
git config core.hooksPath .githooks
```

## Git

- Commit messages, pull request text and docs carry no tool or AI attribution lines
  (no `Co-Authored-By`, no "Generated with"). The `commit-msg` hook rejects them.
- Conventional commits: `feat(program): …`, `fix(app): …`, `test(program): …`, `docs: …`,
  `chore(ci): …`. Scopes: `program`, `app`, `prover`, `scripts`, `client`, `docs`, `ci`.
- One short-lived branch per developer per phase (`a/p1-interface`, `b/p1-actors-faucet`, …),
  merged to `main` at each checkpoint. Dev A merges first (the IDL lands), then Dev B rebases
  and merges. Never force-push `main`.
- Never run `git push`, `anchor deploy` or any `solana program …` command from an automated
  session unless the person driving it asked for that in the same session.

## Who owns what

| Owner | Paths |
|---|---|
| Dev A | `programs/`, `tests/`, `idl/`, `app/src/idl/` (generated), `client/pdas.ts`, `client/rules.ts`, `client/program.ts`, `client/ix.ts`, `scripts/idl-sync.ts`, `scripts/gen-proof-constants.ts`, `scripts/e2e-devnet.ts`, `scripts/devnet-smoke.ts`, `Anchor.toml`, `Cargo.toml`, `Dockerfile`, `.devcontainer/`, `.githooks/`, `.github/`, `docs/INVARIANTS.md`, `docs/PERMISSIONS.md`, `docs/INTERFACE.md`, `docs/DEPLOY.md` |
| Dev B | `app/` (except `app/src/idl/`), `prover/`, all other files in `scripts/`, `client/proof.ts`, `fixtures/`, `docs/PROOF_SPIKE.md`, `docs/DEMO_SCRIPT.md`, `docs/DESIGN_RATIONALE.md`, `docs/submission/` |
| Shared (tell the other person before editing) | `README.md`, root `package.json`, `.env.example`, `docs/LIMITATIONS.md`, `docs/JUDGE_QA.md`, `CONTRIBUTING.md` |

Touch nothing outside your own paths. The only thing Dev B consumes from Dev A is the IDL in
`idl/` and `app/src/idl/`, which changes only at the announced checkpoints.

## The frozen interface

After the `interface-v1` tag, instruction names, arguments, account lists and the `Deal`
layout change only in a scheduled contract-change window, with a message to the other
developer, a version bump in `docs/INTERFACE.md` and an IDL re-sync. Handler bodies may change
at any time.

## Rust (on-chain program)

- One instruction per file: the `#[derive(Accounts)]` struct plus `pub fn handle_<name>`.
  `lib.rs` only delegates.
- Checked math only (`checked_add().ok_or(EscrowError::MathOverflow)?`); `overflow-checks = true`.
- `require!`, `require_keys_eq!`, `require_eq!` with a specific `EscrowError`. No `unwrap()` or
  `expect()` in program code.
- Checks, then effects, then interactions: mutate state before any CPI.
- Tokens leave the vault only in `settle_milestone` and `close_deal`, and only to token
  accounts owned by the deal's client or worker.
- Authorization is expressed as account constraints (`has_one = client @ EscrowError::NotClient`).
- Every `UncheckedAccount` has a `/// CHECK:` comment naming the constraint that protects it.
- Every handler has a doc comment saying who may call it and what it guarantees.
- Classic SPL Token only (`anchor_spl::token`). No `init_if_needed`, no admin instruction,
  no fee account, no global mutable account.
- `cargo fmt --all` and `cargo clippy --all-targets -- -D warnings` are clean.

## TypeScript

- `strict` mode; no `any` except at decode boundaries.
- Tests run under Node's native type stripping: erasable TypeScript only, `.ts` import
  extensions, `BN` from `bn.js`.
- Amounts are `bigint` or `BN` in logic and are formatted in one place only.
- Functions that build transactions never send them.
- No secrets in code; configuration comes from the environment.

## Secrets and keys

Never commit: `.env`, `.env.local`, `.demo/`, any `*-keypair.json`, wallet files, API keys or
tokens. The deployer wallet and the program keypair are backed up privately between the two
developers, never through git.

## Reporting

Run the verification commands listed for your work package and report their real output,
including failures. If something in the plan cannot be done as written, stop and say so
rather than working around it silently.
