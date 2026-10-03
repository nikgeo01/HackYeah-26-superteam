// Tiny argument parsing on top of node:util, with --help and readable errors.
import { parseArgs, type ParseArgsConfig } from "node:util";

type Options = NonNullable<ParseArgsConfig["options"]>;

export function cli<const O extends Options>(usage: string, options: O) {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage.trim());
    process.exit(0);
  }
  try {
    return parseArgs({
      args: argv,
      options,
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    console.error(
      `${error instanceof Error ? error.message : String(error)}\n\n${usage.trim()}`,
    );
    process.exit(2);
  }
}

export function intArg(
  value: string | undefined,
  name: string,
  fallback?: number,
): number {
  if (value === undefined) {
    if (fallback === undefined) throw new Error(`--${name} is required`);
    return fallback;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0)
    throw new Error(`--${name} must be a non-negative integer`);
  return n;
}

export function numArg(
  value: string | undefined,
  name: string,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0)
    throw new Error(`--${name} must be a non-negative number`);
  return n;
}

/** Runs `main`, printing a one-line error (no stack) and exiting 1 on failure. */
export function run(main: () => Promise<void>): void {
  main()
    // zkFetch keeps a connection to the attestor open, which would keep the
    // process alive after the work is done; exit explicitly instead.
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`error: ${message}`);
      if (process.env.DEBUG && error instanceof Error)
        console.error(error.stack);
      process.exit(1);
    });
}
