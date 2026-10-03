# Deploying to devnet

Program ID (permanent for the event): `A8JXDe5Fy9fvBGMZoQhzEbTF8KVpiwtvnQYJHkzM4Qer`
Current binary: `target/deploy/milestone_escrow.so`, 370872 bytes.

The program keypair `target/deploy/milestone_escrow-keypair.json` and the deployer
wallet `~/.config/solana/id.json` are **not** in git. Back both up privately to the
other developer right after the first deploy. The deployer wallet is the upgrade
authority until `--final`.

## SOL budget

Rent is 5,080 lamports per byte. Allocating 450,000 bytes costs about 3.1 SOL of
rent, and a deploy or upgrade temporarily needs a buffer of the binary's size
(about 2.6 SOL for the current binary, refunded afterwards). Keep at least 6 SOL
in the deployer wallet before deploying.

Faucets: https://faucet.solana.com (sign in with GitHub for a higher limit), or
ask the Superteam booth. The CLI airdrop (`solana airdrop 2`) is often rate-limited.

## First deploy (once)

```
solana config set -u devnet
anchor build
solana program deploy target/deploy/milestone_escrow.so \
  --program-id target/deploy/milestone_escrow-keypair.json \
  --max-len 450000 -u devnet
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
