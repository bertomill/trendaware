'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { UserProfileForm } from '@/components/UserProfile';

export default function ProfilePage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!currentUser) {
      router.push('/login');
    }
  }, [currentUser, router]);
  
  if (!currentUser) return null;
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">User Profile</h1>
          <p className="text-muted-foreground">
            Update your profile to personalize your research experience
          </p>
        </div>
        <UserProfileForm />
      </div>
    </DashboardLayout>
  );
} 