import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SolanaProvider } from "./providers/SolanaProvider";
import { ActorProvider } from "./providers/ActorProvider";
import { ChainTimeProvider } from "./providers/ChainTimeProvider";
import { TxToastProvider } from "./providers/TxToastProvider";
import { Layout } from "./components/Layout";
import { DEMO_MODE } from "./lib/env";
import Landing from "./pages/Landing";
import Deals from "./pages/Deals";
import NewDeal from "./pages/NewDeal";
import DealDetail from "./pages/DealDetail";
import How from "./pages/How";
import Demo from "./pages/Demo";
import StatesPreview from "./pages/StatesPreview";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 2_000, retry: 1, refetchOnWindowFocus: true },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SolanaProvider>
        <ActorProvider>
          <ChainTimeProvider>
            <TxToastProvider>
              <HashRouter>
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<Landing />} />
                    <Route path="deals" element={<Deals />} />
                    <Route path="new" element={<NewDeal />} />
                    <Route path="deal/:address" element={<DealDetail />} />
                    <Route path="how" element={<How />} />
                    {DEMO_MODE && <Route path="demo" element={<Demo />} />}
                    {import.meta.env.DEV && <Route path="_states" element={<StatesPreview/>} />}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </HashRouter>
            </TxToastProvider>
          </ChainTimeProvider>
        </ActorProvider>
      </SolanaProvider>
    </QueryClientProvider>
  );
}
