'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  UserCredential,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '@/src/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserCredential>;
  signup: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<UserCredential>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  function signup(email: string, password: string) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  function login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  useEffect(() => {
    // Create user profile when a new user signs in
    async function createUserProfileIfNeeded(user: User) {
      if (!user) return;
      
      try {
        // Check if profile already exists
        const userProfileRef = doc(db, 'userProfiles', user.uid);
        const docSnap = await getDoc(userProfileRef);
        
        if (!docSnap.exists()) {
          // Create new profile for the user
          await setDoc(userProfileRef, {
            displayName: user.displayName || 'User',
            email: user.email,
            photoURL: user.photoURL,
            createdAt: serverTimestamp(),
            // Default values for new users
            jobTitle: '',
            industry: 'Finance',
            expertise: [],
            interests: [],
          });
          console.log('Created new user profile for:', user.uid);
        }
      } catch (error) {
        console.error('Error creating user profile:', error);
      }
    }
    
    if (currentUser) {
      createUserProfileIfNeeded(currentUser);
    }
  }, [currentUser]);

  const value = {
    currentUser,
    loading,
    login,
    signup,
    logout,
    signInWithGoogle
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
