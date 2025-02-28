'use client';

import { UserProfileForm } from '@/components/UserProfile';

export default function ProfilePage() {
  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">User Profile</h1>
      <UserProfileForm />
    </div>
  );
} 