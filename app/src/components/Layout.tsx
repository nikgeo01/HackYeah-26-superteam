import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useActor } from "../providers/ActorProvider";
import { DemoNote, DevnetChip } from "./DemoNote";
import { RoleSwitcher } from "./RoleSwitcher";
import { DEMO_MODE } from "../lib/env";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `relative py-1 text-sm font-medium transition-colors ${
    isActive
      ? "text-ink after:absolute after:inset-x-0 after:-bottom-[13px] after:h-[3px] after:bg-stamp"
      : "text-ink-soft hover:text-ink"
  }`;

/** The wordmark: the name with a small stamp-ink seal standing in for the dot of a signature. */
function Wordmark() {
  return (
    <NavLink to="/" className="flex items-baseline gap-1.5" aria-label="Kept, home">
      <span className="text-[1.45rem] font-[750] leading-none tracking-[-0.04em] text-ink">kept</span>
      <span aria-hidden className="h-2 w-2 translate-y-[-1px] rotate-45 bg-stamp" />
    </NavLink>
  );
}

/** A new page starts at its top, like a normal website. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function Layout() {
  const { actor } = useActor();
  // In demo mode the wallet button stays available so the real wallet can be the client.
  const showWalletButton = !DEMO_MODE || actor?.kind !== "demo";

  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <header className="border-b border-rule bg-sheet">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3">
          <div className="flex items-baseline gap-3">
            <Wordmark />
            <DevnetChip />
          </div>
          <nav className="flex flex-wrap items-center gap-6" aria-label="Main">
            {DEMO_MODE && (
              <NavLink to="/demo" className={navClass}>
                Guided demo
              </NavLink>
            )}
            <NavLink to="/deals" className={navClass}>
              My deals
            </NavLink>
            <NavLink to="/new" className={navClass}>
              New deal
            </NavLink>
            <NavLink to="/how" className={navClass}>
              How it works
            </NavLink>
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <RoleSwitcher />
            {showWalletButton && <WalletMultiButton />}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-6xl px-5 pb-8 pt-4">
        <div className="flex flex-col gap-2 border-t border-rule pt-4 text-micro text-ink-soft sm:flex-row sm:justify-between">
          <span>Kept runs on Solana devnet. Every amount here is test money.</span>
          <DemoNote />
        </div>
      </footer>
    </div>
  );
}
