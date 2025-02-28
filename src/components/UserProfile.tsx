'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

export interface UserProfile {
  displayName: string;
  jobTitle: string;
  industry: string;
  interests: string[];
  expertise: string[];
  researchPreferences: {
    depth: 'basic' | 'intermediate' | 'advanced';
    focus: string[];
  };
}

export function UserProfileForm() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    displayName: '',
    jobTitle: '',
    industry: '',
    interests: [],
    expertise: [],
    researchPreferences: {
      depth: 'intermediate',
      focus: []
    }
  });

  useEffect(() => {
    async function loadProfile() {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      
      try {
        const docRef = doc(db, 'userProfiles', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    }
    
    loadProfile();
  }, [currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setProfile({
        ...profile,
        [parent]: {
          ...(profile[parent as keyof UserProfile] as Record<string, unknown> || {}),
          [child]: value
        }
      });
    } else {
      setProfile({
        ...profile,
        [name]: value
      });
    }
  };
  
  const handleArrayChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof UserProfile) => {
    const values = e.target.value.split(',').map(item => item.trim());
    setProfile({
      ...profile,
      [field]: values
    });
  };
  
  const handleSave = async () => {
    if (!currentUser) return;
    
    setSaving(true);
    try {
      const docRef = doc(db, 'userProfiles', currentUser.uid);
      await setDoc(docRef, profile, { merge: true });
      toast.success('Profile saved successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Profile</CardTitle>
        <CardDescription>
          Update your profile to personalize your research experience
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={currentUser?.photoURL || undefined} />
            <AvatarFallback>{profile.displayName?.[0] || currentUser?.email?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{currentUser?.email}</p>
          </div>
        </div>
        
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="displayName">Name</Label>
            <Input
              id="displayName"
              name="displayName"
              value={profile.displayName}
              onChange={handleChange}
              placeholder="Your name"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="jobTitle">Job Title</Label>
            <Input
              id="jobTitle"
              name="jobTitle" 
              value={profile.jobTitle}
              onChange={handleChange}
              placeholder="e.g. Financial Analyst"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              name="industry"
              value={profile.industry}
              onChange={handleChange}
              placeholder="e.g. Finance, Healthcare, Technology"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="interests">Interests (comma-separated)</Label>
            <Input
              id="interests"
              value={profile.interests.join(', ')}
              onChange={(e) => handleArrayChange(e, 'interests')}
              placeholder="e.g. Blockchain, AI, Quantum Computing"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="expertise">Areas of Expertise (comma-separated)</Label>
            <Input
              id="expertise"
              value={profile.expertise.join(', ')}
              onChange={(e) => handleArrayChange(e, 'expertise')}
              placeholder="e.g. Market Analysis, Risk Management"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="researchFocus">Research Focus Areas (comma-separated)</Label>
            <Input
              id="researchFocus"
              value={profile.researchPreferences.focus.join(', ')}
              onChange={(e) => {
                const values = e.target.value.split(',').map(item => item.trim());
                setProfile({
                  ...profile,
                  researchPreferences: {
                    ...profile.researchPreferences,
                    focus: values
                  }
                });
              }}
              placeholder="e.g. Emerging Technologies, Market Trends"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Profile
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 