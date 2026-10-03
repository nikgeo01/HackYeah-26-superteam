// Browser polyfills for Solana libraries that expect Node globals.
// Imported first in main.tsx, so it runs before any Solana module is evaluated.
import { Buffer } from "buffer";

const g = globalThis as unknown as { Buffer?: typeof Buffer };
if (!g.Buffer) g.Buffer = Buffer;
