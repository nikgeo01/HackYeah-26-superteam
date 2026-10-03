// Copies the IDL and its TypeScript type from `anchor build` output into the
// committed locations the frontend and scripts use. Run after `anchor build`:
//   node scripts/idl-sync.ts
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const root = join(dirname(new URL(import.meta.url).pathname), "..");
const files = [
  ["target/idl/milestone_escrow.json", ["idl", "app/src/idl"]],
  ["target/types/milestone_escrow.ts", ["idl", "app/src/idl"]],
] as const;

for (const [source, targets] of files) {
  const from = join(root, source);
  if (!existsSync(from)) throw new Error(`${source} missing; run anchor build`);
  for (const dir of targets) {
    const to = join(root, dir, source.split("/").pop()!);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    console.log(`${source} -> ${dir}/`);
  }
}
