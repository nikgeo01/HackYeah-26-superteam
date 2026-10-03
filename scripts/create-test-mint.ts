// Creates the demo token "tUSDC" (ADR-13, WP-11 step 5): a classic SPL mint with
// 6 decimals, NO freeze authority, and a freshly generated throwaway faucet key
// as mint authority. The faucet key is saved to .demo/faucet.json (gitignored)
// and printed as the environment lines to paste.
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import { Keypair, SystemProgram } from "@solana/web3.js";
import {
  FAUCET_PATH,
  dotenvLine,
  readFaucetFile,
  type FaucetFile,
} from "./lib/actors.ts";
import { cli, run } from "./lib/cli.ts";
import { env } from "./lib/env.ts";
import {
  keypairFromJson,
  keypairToJson,
  loadKeypair,
  writePrivateFile,
} from "./lib/keys.ts";
import { explorerAddress, formatSol, sent, TUSDC_DECIMALS } from "./lib/log.ts";
import { connect } from "./lib/program.ts";
import { sendTx } from "./lib/tx.ts";

const USAGE = `
Usage: node scripts/create-test-mint.ts [--dry-run] [--force]

Creates the tUSDC mint (6 decimals, no freeze authority). The deployer wallet
(ANCHOR_WALLET, default ~/.config/solana/id.json) pays; a new throwaway faucet
key becomes the mint authority and is saved to .demo/faucet.json.

  --dry-run   print the plan, send nothing
  --force     create a new mint even if .demo/faucet.json already has one
  -h, --help  this text

Env: RPC_URL (default https://api.devnet.solana.com), ANCHOR_WALLET
`;

function printEnv(faucet: FaucetFile): void {
  const secret = JSON.stringify(faucet.faucetSecretKey);
  console.log("\nPaste into app/.env.local (and the hosting provider):");
  console.log(dotenvLine("VITE_TUSDC_MINT", faucet.mint));
  console.log(dotenvLine("VITE_FAUCET_SECRET", secret));
  console.log("\nPaste into the root .env (scripts):");
  console.log(dotenvLine("TUSDC_MINT", faucet.mint));
  console.log(
    "\nThe faucet key is a throwaway: it can only mint test tokens, and it is public once the app is built.",
  );
}

run(async () => {
  const args = cli(USAGE, {
    "dry-run": { type: "boolean" },
    force: { type: "boolean" },
  });
  const existing = readFaucetFile();
  if (existing && !args.force) {
    console.log(`tUSDC already exists (${FAUCET_PATH}): ${existing.mint}`);
    console.log("Use --force to create another one.");
    printEnv(existing);
    return;
  }

  const connection = connect();
  const mint = Keypair.generate();
  const faucet = Keypair.generate();
  console.log(`RPC:        ${env.rpcUrl()}`);
  console.log(`Payer:      ${env.walletPath()}`);
  console.log(
    `Mint:       ${mint.publicKey.toBase58()} (${TUSDC_DECIMALS} decimals, no freeze authority)`,
  );
  console.log(`Faucet key: ${faucet.publicKey.toBase58()} (mint authority)`);

  if (args["dry-run"]) {
    console.log("\n--dry-run: nothing sent, nothing saved.");
    return;
  }

  const payer = loadKeypair(env.walletPath());
  const rent = await getMinimumBalanceForRentExemptMint(connection);
  const balance = await connection.getBalance(payer.publicKey);
  console.log(
    `Payer ${payer.publicKey.toBase58()} holds ${formatSol(balance)} SOL; mint rent ${formatSol(rent)} SOL`,
  );

  const signature = await sendTx(
    connection,
    [
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports: rent,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        mint.publicKey,
        TUSDC_DECIMALS,
        faucet.publicKey,
        null,
      ),
    ],
    [payer, mint],
  );
  sent("created tUSDC mint", signature);

  const file: FaucetFile = {
    mint: mint.publicKey.toBase58(),
    faucetPublicKey: faucet.publicKey.toBase58(),
    faucetSecretKey: keypairToJson(faucet),
    createdAt: new Date().toISOString(),
  };
  keypairFromJson(file.faucetSecretKey); // sanity check before saving
  writePrivateFile(FAUCET_PATH, JSON.stringify(file, null, 2) + "\n");
  console.log(`Saved ${FAUCET_PATH}`);
  console.log(`Mint on explorer: ${explorerAddress(file.mint)}`);
  printEnv(file);
});
