"use client";
import React, {useState} from 'react';
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const Providers = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 1000 * 60 * 5,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/*<ProvidersWithWebSocket>{children}</ProvidersWithWebSocket>*/}
      {/*<Toaster />*/}
      {/* La fenêtre « session expirée » (A89) est montée dans layout.tsx, SOUS UiPreferencesProvider et
          ToastProvider : son formulaire de connexion (A63) en dépend — montée ici, elle plantait dès qu'un 401 l'ouvrait. */}
      {children}
    </QueryClientProvider>
  );
};

export default Providers;
