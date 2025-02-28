'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/src/components/ui/button';
import ResearchForm from '@/src/components/ResearchForm';

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!currentUser) {
      router.push('/login');
    }
  }, [currentUser, router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">TrendAware Dashboard</h1>
        <Button variant="outline" onClick={handleLogout}>Logout</Button>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <ResearchForm />
      </div>
    </div>
  );
}
