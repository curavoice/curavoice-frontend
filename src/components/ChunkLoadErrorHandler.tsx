'use client'

import { useEffect } from 'react'

function isChunkLoadError(error: unknown): boolean {
  if (!error) return false

  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as any).name)
      : ''

  const message =
    typeof error === 'string'
      ? error
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as any).message)
        : ''

  return (
    name === 'ChunkLoadError' ||
    /ChunkLoadError/i.test(message) ||
    /Loading chunk .* failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message)
  )
}

export default function ChunkLoadErrorHandler() {
  useEffect(() => {
    const reloadOnce = () => {
      try {
        const key = 'curavoice_chunk_reload_attempted'
        if (sessionStorage.getItem(key) === '1') return
        sessionStorage.setItem(key, '1')
      } catch {
        // Ignore sessionStorage errors (privacy mode, etc.)
      }
      window.location.reload()
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        event.preventDefault?.()
        reloadOnce()
      }
    }

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        reloadOnce()
      }
    }

    window.addEventListener('unhandledrejection', onUnhandledRejection)
    window.addEventListener('error', onError)
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
      window.removeEventListener('error', onError)
    }
  }, [])

  return null
}

