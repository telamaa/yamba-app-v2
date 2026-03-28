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

      {children}
    </QueryClientProvider>
  );
};

export default Providers;
