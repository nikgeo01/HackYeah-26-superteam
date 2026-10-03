# Deploying to devnet

Program ID (permanent for the event): `A8JXDe5Fy9fvBGMZoQhzEbTF8KVpiwtvnQYJHkzM4Qer`
Current binary: `target/deploy/milestone_escrow.so`, 370872 bytes.

The program keypair `target/deploy/milestone_escrow-keypair.json` and the deployer
wallet `~/.config/solana/id.json` are **not** in git. Back both up privately to the
other developer right after the first deploy. The deployer wallet is the upgrade
authority until `--final`.

## SOL budget

Rent is 5,080 lamports per byte. Allocating 400,000 bytes costs about 2.0 SOL of
rent, and a deploy or upgrade temporarily needs a buffer of the binary's size
(about 1.9 SOL for the current binary, refunded afterwards). Keep at least 4.5 SOL
in the deployer wallet before deploying.

Faucets: https://faucet.solana.com (sign in with GitHub for a higher limit), or
ask the Superteam booth. The CLI airdrop (`solana airdrop 2`) is often rate-limited.

## First deploy (once)

```
solana config set -u devnet
anchor build
solana program deploy target/deploy/milestone_escrow.so \
  --program-id target/deploy/milestone_escrow-keypair.json \
  --max-len 400000 -u devnet
solana program show A8JXDe5Fy9fvBGMZoQhzEbTF8KVpiwtvnQYJHkzM4Qer -u devnet
```

Never run `solana program close` on this ID: a closed program ID can never be
deployed again.

## Upgrades

```
anchor build && node scripts/idl-sync.ts
anchor deploy --provider.cluster devnet
```

If the deploy reports insufficient space: `solana program extend A8JXDe5Fy9fvBGMZoQhzEbTF8KVpiwtvnQYJHkzM4Qer <bytes> -u devnet`,
then retry. If a deploy fails midway, recover the buffer SOL with
`solana program show --buffers -u devnet` and `solana program close --buffers -u devnet`.

## Making it immutable (P6, after the gates in docs/PLAN.md)

```
solana program set-upgrade-authority A8JXDe5Fy9fvBGMZoQhzEbTF8KVpiwtvnQYJHkzM4Qer --final -u devnet
solana program show A8JXDe5Fy9fvBGMZoQhzEbTF8KVpiwtvnQYJHkzM4Qer -u devnet
```

This is irreversible and the program's rent can never be reclaimed afterwards.

## Deployment log

| When | What | Result |
|---|---|---|
| 2026-10-03 14:45 | First deploy, `--max-len 400000` | [tx](https://explorer.solana.com/tx/4d6kyW1uJov9j96CoCNS8mppB9Mm696SZBd7BngfAc5FdqkTTy3UTtkzcTucm3RovLYDz3nEhzikGCWzh498nPfW?cluster=devnet); program data 400,000 bytes, rent 2.03 SOL; upgrade authority `NL9cyJQM8dbGjy5xwe7B1uv9GwfFBUbjHNTD7mGC7ss` |
| 2026-10-03 14:47 | `node scripts/devnet-smoke.ts` (create → accept → deliver → approve + settle) | Worker paid 10 test tokens; [settle tx](https://explorer.solana.com/tx/64UTuShujonULJAnSRWeDzYB1FwT6Q62tgs6YuWcXcnZkzffzoAQVNa1yFPd8hZTdbFihewu3usAzQZm6F42iFSK?cluster=devnet) |
| 2026-10-03 15:00 | `anchor idl init` (IDL published on-chain, so explorers decode instructions) | 0.028 SOL |
| 2026-10-03 14:55 | `node scripts/e2e-devnet.ts` | 7/7 scenarios passed, 0.0043 SOL |
| 2026-10-03 16:20 | Upgrade: proof constants from a real Reclaim proof; `anchor idl upgrade` | [tx](https://explorer.solana.com/tx/4phmCxvjoKe2pDhcwbdEtJaQjidFKcFAq2LN4WNsejhS8FQnpB7SC7rtXThu7s3engymsimdw8hWSjqS21b6LBRj?cluster=devnet); 0.002 SOL net |
| 2026-10-03 16:45 | Real Reclaim proof on devnet (`scripts/prove.ts`, throwaway deal) | [proof verified](https://explorer.solana.com/tx/5siQ1rRCZ1RthjhejUN3Y5McNPQMgTjWa1tGavpsKwXLW92MHi55zk6P6K1ZaEtsGiabhy4XXftqtqSG617Z6AWo?cluster=devnet), [worker paid 100 tUSDC](https://explorer.solana.com/tx/Q2fejtvB5hbh4P5vPmqkfPfnfPDr6VQLq5d2UYcLPR21mVMoKpLsNtxc534RXgRRA7VZruvF7m8SLTqczoGLr8n?cluster=devnet) |
| 2026-10-03 16:50 | `node scripts/e2e-devnet.ts` on the upgraded program | 7/7 passed, 0.0043 SOL |

## Release gates before `--final` (PLAN P6)

`--final` is irreversible and is run only when Nikola says so.

| Gate | Status |
|---|---|
| Local tests green on the deployed commit (19 Rust, 70 integration) | done |
| `e2e-devnet.ts` green against the deployed binary | done (7/7) |
| Real attestor proof verified on devnet | done |
| Demo deals D1–D8 seeded against the deployed binary | done |
| No open interface change | done |
| Rollback reserve of at least 2× program rent (about 4.1 SOL) | done (7.067183348 SOL) |
| Two manual dry runs through the app in a browser | open |
| Full backup recording of the demo | open |
| Both developers say "go" | open |

Command, when all gates pass and Nikola says go:

```
solana program set-upgrade-authority A8JXDe5Fy9fvBGMZoQhzEbTF8KVpiwtvnQYJHkzM4Qer --final -u devnet
solana program show A8JXDe5Fy9fvBGMZoQhzEbTF8KVpiwtvnQYJHkzM4Qer -u devnet
```
