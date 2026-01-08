'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/toaster'
import { useState } from 'react'
import { UploadProvider } from '@/contexts/UploadContext'
import ChunkLoadErrorHandler from '@/components/ChunkLoadErrorHandler'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <ChunkLoadErrorHandler />
        <UploadProvider>
          {children}
        </UploadProvider>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

