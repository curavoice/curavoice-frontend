'use client'

import { createContext, useContext, useState, ReactNode, useCallback } from 'react'

export interface UploadState {
    file: File | null
    fileName: string | null  // Store name separately since File can't be serialized
    fileSize: number | null
    fileType: string | null
    status: 'idle' | 'uploading' | 'processing' | 'success' | 'error'
    progress: number
    lectureId: string | null
    error: string | null
}

interface UploadContextType {
    uploadState: UploadState
    setUploadState: (state: UploadState | ((prev: UploadState) => UploadState)) => void
    setFile: (file: File) => void
    resetUpload: () => void
}

const initialState: UploadState = {
    file: null,
    fileName: null,
    fileSize: null,
    fileType: null,
    status: 'idle',
    progress: 0,
    lectureId: null,
    error: null,
}

const UploadContext = createContext<UploadContextType | undefined>(undefined)

export function UploadProvider({ children }: { children: ReactNode }) {
    const [uploadState, setUploadState] = useState<UploadState>(initialState)

    const setFile = useCallback((file: File) => {
        setUploadState(prev => ({
            ...prev,
            file,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            status: 'idle',
            progress: 0,
            error: null,
        }))
    }, [])

    const resetUpload = useCallback(() => {
        setUploadState(initialState)
    }, [])

    return (
        <UploadContext.Provider value={{ uploadState, setUploadState, setFile, resetUpload }}>
            {children}
        </UploadContext.Provider>
    )
}

export function useUploadContext() {
    const context = useContext(UploadContext)
    if (context === undefined) {
        throw new Error('useUploadContext must be used within an UploadProvider')
    }
    return context
}
