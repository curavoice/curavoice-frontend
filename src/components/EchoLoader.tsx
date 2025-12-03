"use client"

import { useEffect, useState } from 'react'
import EchoIcon from '@/components/icons/Echo'
import Image from 'next/image'
import { getLoadingMessage, type LoadingContext } from '@/lib/loadingMessages'

interface EchoLoaderProps {
  message?: string
  context?: LoadingContext
  imageSrc?: string
}

export default function EchoLoader({ message, context = 'general', imageSrc }: EchoLoaderProps) {
  // Use first message from array as default to avoid hydration mismatch
  // This ensures server and client render the same initial message
  const getDefaultMessage = (ctx: LoadingContext) => {
    const messages = {
      dashboard: "Hang tight with Echo here...",
      profile: "Echo's fetching your profile...",
      reports: "Echo's compiling your reports...",
      training: "Echo's getting ready to train...",
      admin: "Echo's loading admin data...",
      general: "Hang on with Echo here...",
      reload: "Echo's reloading...",
    }
    return messages[ctx] || messages.general
  }
  
  const [displayMessage, setDisplayMessage] = useState(message || getDefaultMessage(context))
  
  // Determine if this is an evaluation context
  const isEvaluating = message?.toLowerCase().includes('evaluating') || false
  
  // Determine if this is a reload context
  const isReloading = message?.toLowerCase().includes('reload') || 
                      message?.toLowerCase().includes('refresh') ||
                      context === 'reload' || false
  
  // State for cycling reload images
  const [reloadImageIndex, setReloadImageIndex] = useState(0)
  const [imageKey, setImageKey] = useState(0) // Force re-render key
  const [imageFailed, setImageFailed] = useState(false)
  
  // Reload images array - defined outside to avoid recreation
  const reloadImages = ['/assets/echo-reload-1.png', '/assets/echo-reload-2.png']
  
  // Cycle reload images every 2 seconds when reloading
  useEffect(() => {
    if (isReloading && !imageSrc) {
      console.log('[EchoLoader] Starting reload animation, isReloading:', isReloading)
      // Reset to first image when reloading starts
      setReloadImageIndex(0)
      setImageKey(0)
      
      // Start cycling immediately
      const interval = setInterval(() => {
        setReloadImageIndex((prev) => {
          const next = (prev + 1) % 2
          console.log('[EchoLoader] Cycling to image index:', next, 'image:', reloadImages[next])
          setImageKey(prev => prev + 1) // Update key to force re-render
          return next
        })
      }, 2000)
      return () => {
        console.log('[EchoLoader] Clearing reload interval')
        clearInterval(interval)
      }
    } else if (!isReloading) {
      // Reset when not reloading
      setReloadImageIndex(0)
      setImageKey(0)
    }
  }, [isReloading, imageSrc, reloadImages])
  
  // Determine which image to use - recalculated on every render to pick up reloadImageIndex changes
  const baseImageSrc = isReloading
    ? reloadImages[reloadImageIndex]
    : (isEvaluating ? '/assets/echo-evaluator.png' : '/assets/echo-loader.png')

  const iconImageSrc = imageFailed ? undefined : (imageSrc || baseImageSrc)

  useEffect(() => {
    // Set random message on client side only (prevents hydration mismatch)
    if (!message) {
      setDisplayMessage(getLoadingMessage(context))
    }
    
    // If no message provided, rotate messages every 3 seconds for variety
    if (!message && context !== 'general') {
      const interval = setInterval(() => {
        setDisplayMessage(getLoadingMessage(context))
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [message, context])

  useEffect(() => {
    setImageFailed(false)
  }, [imageSrc, baseImageSrc])

  return (
    <div className="echo-loader-container">
      <div className="echo-loader-content">
        <div className="echo-loader-icon-wrapper">
          {iconImageSrc ? (
            <Image
              key={`${iconImageSrc}-${imageKey}`} // Force re-render when image changes
              src={iconImageSrc}
              alt={isReloading ? "Echo Reloading" : isEvaluating ? "Echo Evaluator" : "Echo"}
              width={200}
              height={230}
              className="echo-loader-icon"
              priority
              unoptimized // Disable Next.js image optimization to ensure immediate updates
              onError={() => setImageFailed(true)}
            />
          ) : (
            <EchoIcon 
              width={200} 
              height={230} 
              className="echo-loader-icon"
            />
          )}
          <div className="echo-loader-rings">
            <div className="echo-loader-ring echo-loader-ring-1"></div>
            <div className="echo-loader-ring echo-loader-ring-2"></div>
            <div className="echo-loader-ring echo-loader-ring-3"></div>
          </div>
        </div>
        <div className="echo-loader-text">
          <p className="echo-loader-message">{displayMessage}</p>
          <div className="echo-loader-dots">
            <span className="echo-loader-dot"></span>
            <span className="echo-loader-dot"></span>
            <span className="echo-loader-dot"></span>
          </div>
        </div>
      </div>
    </div>
  )
}
