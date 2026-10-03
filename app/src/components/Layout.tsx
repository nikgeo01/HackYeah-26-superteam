import { NavLink, Outlet } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useActor } from "../providers/ActorProvider";
import { DemoNote, DevnetChip } from "./DemoNote";
import { RoleSwitcher } from "./RoleSwitcher";
import { DEMO_MODE } from "../lib/env";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2 py-1 text-sm font-medium ${isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"}`;

export function Layout() {
  const { actor } = useActor();
  // In demo mode the wallet button stays available so the real wallet can be the client.
  const showWalletButton = !DEMO_MODE || actor?.kind !== "demo";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <NavLink to="/" className="text-xl font-bold tracking-tight">
            Kept
          </NavLink>
          <DevnetChip />
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/deals" className={navClass}>
              My deals
            </NavLink>
            <NavLink to="/new" className={navClass}>
              New deal
            </NavLink>
            <NavLink to="/how" className={navClass}>
              How it works
            </NavLink>
            {DEMO_MODE && (
              <NavLink to="/demo" className={navClass}>
                Demo
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <RoleSwitcher />
            {showWalletButton && <WalletMultiButton />}
          </div>
        </div>
        {DEMO_MODE && (
          <div className="mx-auto max-w-5xl px-4 pb-3">
            <DemoNote />
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Kept runs on Solana devnet. All money here is test money.
      </footer>
    </div>
  );
}
