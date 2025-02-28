"use client"

import { useEffect, useState } from 'react'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Function to check if viewport width is mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // 768px is typical mobile breakpoint
    }
    
    // Check on initial load
    checkMobile()
    
    // Add event listener for window resize
    window.addEventListener('resize', checkMobile)
    
    // Clean up
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}
