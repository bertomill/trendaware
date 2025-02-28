'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserProfile } from '@/components/UserProfile';
import { FirebaseError } from 'firebase/app';

export default function ResearchForm() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const { currentUser } = useAuth();
  const [processingStage, setProcessingStage] = useState<
    'idle' | 'submitting' | 'researching' | 'generating' | 'saving' | 'complete'
  >('idle');
  const [apiResponseTime, setApiResponseTime] = useState<number | null>(null);

  // Fetch user profile when component mounts
  useEffect(() => {
    async function fetchUserProfile() {
      if (!currentUser) return;
      
      try {
        const docRef = doc(db, 'userProfiles', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    }
    
    fetchUserProfile();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError('You must be logged in to submit research');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setProcessingStage('submitting');
      setStatus('Preparing your research request...');
      
      // Short delay to show initial status
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProcessingStage('researching');
      setStatus('Conducting web research on your topic...');
      
      console.log('Submitting research with user profile:', { 
        title, 
        content: content.substring(0, 50) + '...',
        userProfile: userProfile ? 'available' : 'not available'
      });
      
      // Call the API with a longer timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes
      
      let summaryContent = ""; // Define a variable to store the summary content
      
      try {
        // After 5 seconds, update status to show progress even if API is still working
        const progressTimer = setTimeout(() => {
          setProcessingStage('generating');
          setStatus('Analyzing information and generating your personalized summary...');
        }, 5000);
        
        const startTime = Date.now();
        const response = await fetch('/api/generate-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            title, 
            content,
            userProfile
          }),
          signal: controller.signal
        });
        const endTime = Date.now();
        setApiResponseTime(endTime - startTime);
        
        clearTimeout(progressTimer);
        clearTimeout(timeoutId);
        
        console.log('API response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('API error response:', errorData);
          
          // Handle specific status codes
          if (response.status === 504) {
            throw new Error('The request timed out. Please try with shorter content or try again later.');
          } else if (response.status === 429) {
            throw new Error('Too many requests. Please try again later.');
          } else {
            throw new Error(`Failed to generate summary: ${errorData.error || response.statusText}`);
          }
        }
        
        const data = await response.json();
        console.log('Summary generated successfully');
        setSummary(data.summary);
        summaryContent = data.summary; // Store the summary content for later use
        
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error('Request timed out. Please try again with shorter content.');
        }
        throw error;
      }
      
      setProcessingStage('saving');
      setStatus('Saving research to database...');
      
      // Save to Firestore with better error handling
      try {
        const researchData = {
          userId: currentUser.uid,
          title,
          content,
          summary: summaryContent,
          createdAt: serverTimestamp(),
        };
        
        console.log('Attempting to save research with data:', {
          userId: currentUser.uid,
          collectionPath: 'research'
        });
        
        const docRef = await addDoc(collection(db, 'research'), researchData);
        console.log('Research saved to database with ID:', docRef.id);
        
        // Add the summary as a subcollection
        const summaryCollectionRef = collection(doc(db, 'research', docRef.id), 'summaries');
        await addDoc(summaryCollectionRef, {
          content: summaryContent, // Use the stored summary content
          createdAt: serverTimestamp(),
        });
        console.log('Summary saved to database');
        
        // Reset form and status
        setTitle('');
        setContent('');
        setStatus('');
        
      } catch (firestoreError) {
        console.error('Detailed Firestore error:', firestoreError);
        
        if (firestoreError instanceof FirebaseError) {
          console.error('Error code:', firestoreError.code);
          console.error('Error message:', firestoreError.message);
        }
        
        throw new Error(`Database error: ${firestoreError instanceof Error ? firestoreError.message : 'Unknown error'}`);
      }
      
      setProcessingStage('complete');
      
    } catch (error) {
      console.error('Error submitting research:', error);
      setError(`${error instanceof Error ? error.message : 'Failed to submit research. Please try again.'}`);
      setStatus('');
      setProcessingStage('idle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {status && (
        <Alert>
          <AlertDescription className="flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {status}
          </AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            placeholder="Research Title/Topic"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        
        <div>
          <Textarea
            placeholder="Enter your research content or notes here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            required
          />
        </div>
        
        <Button 
          type="submit" 
          disabled={loading} 
          className="w-full"
          variant={processingStage === 'complete' ? "outline" : "default"}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {processingStage === 'researching' && "Researching..."}
              {processingStage === 'generating' && "Generating..."}
              {processingStage === 'saving' && "Saving..."}
              {!['researching', 'generating', 'saving'].includes(processingStage) && "Processing..."}
            </>
          ) : (
            'Submit Research & Generate Summary'
          )}
        </Button>
      </form>
      
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI-Enhanced Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: summary }} />
            </div>
          </CardContent>
        </Card>
      )}
      
      {apiResponseTime && (
        <p className="text-xs text-muted-foreground mt-2">
          API response time: {(apiResponseTime / 1000).toFixed(1)}s
        </p>
      )}
    </div>
  );
}
