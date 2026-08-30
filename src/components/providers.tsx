'use client';

import { useState, type ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Réseau instable (§1) : on retente et on garde le cache affichable.
        defaultOptions: {
          queries: { retry: 3, retryDelay: (i) => Math.min(1000 * 2 ** i, 15000), staleTime: 30_000 },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
