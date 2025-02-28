'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  
  // Safely access auth context
  const auth = useAuth();
  
  useEffect(() => {
    // Only proceed if auth is available
    if (auth) {
      const { currentUser, loading } = auth;
      
      if (!loading) {
        setIsLoading(false);
        if (currentUser) {
          router.push('/dashboard');
        } else {
          router.push('/login');
        }
      }
    }
  }, [auth, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      {isLoading ? (
        <div className="animate-pulse">Loading TrendAware...</div>
      ) : (
        <div>Redirecting...</div>
      )}
    </div>
  );
}
