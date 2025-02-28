'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserProfile } from '@/components/UserProfile';
import { FirebaseError } from 'firebase/app';
import { Progress } from "@/components/ui/progress";

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
  const [responseData, setResponseData] = useState<{ 
    summary: string;
    webResearchUsed?: boolean;
    fallback?: boolean;
  }>({ summary: '' });
  const [progress, setProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(15); // Default 15 seconds
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [webResearchUsed, setWebResearchUsed] = useState(false);

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

  // Add this useEffect to clean up the interval
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

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
      
      // Reset progress
      setProgress(0);
      startTimeRef.current = Date.now();
      
      // Calculate estimated time based on content length
      const baseTime = 10; // Base time in seconds
      const contentFactor = Math.min(content.length / 500, 3); // Max factor of 3
      const newEstimatedTime = baseTime + (contentFactor * 5);
      setEstimatedTime(newEstimatedTime);
      
      // Start progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      
      progressIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const newProgress = Math.min((elapsed / newEstimatedTime) * 100, 95);
          setProgress(newProgress);
        }
      }, 100);
      
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
        const streamResponse = await fetch('/api/generate-summary-stream', {
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
        
        console.log('API response status:', streamResponse.status);
        
        if (!streamResponse.ok) {
          const errorData = await streamResponse.json().catch(() => ({}));
          console.error('API error response:', errorData);
          
          // Handle specific status codes
          if (streamResponse.status === 504) {
            throw new Error('The request timed out. Please try with shorter content or try again later.');
          } else if (streamResponse.status === 429) {
            throw new Error('Too many requests. Please try again later.');
          } else {
            throw new Error(`Failed to generate summary: ${errorData.error || streamResponse.statusText}`);
          }
        }
        
        const reader = streamResponse.body?.getReader();
        let summaryText = '';
        
        if (!reader) {
          throw new Error('Failed to get response reader');
        }
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Process the chunk
          const text = new TextDecoder().decode(value);
          
          // Split by newlines in case multiple JSON objects were sent
          const jsonLines = text.split('\n').filter(line => line.trim());
          
          for (const line of jsonLines) {
            try {
              const data = JSON.parse(line);
              
              // Handle heartbeat to keep connection alive
              if (data.heartbeat) {
                console.log('Received heartbeat:', new Date(data.timestamp).toISOString());
                continue; // Skip further processing for heartbeats
              }
              
              // Handle progress updates
              if (data.progress) {
                setProgress(data.progress);
              }
              
              // Handle different message types
              if (data.status) {
                setStatus(data.message || '');
                
                if (data.status === 'researching') {
                  setProcessingStage('researching');
                } else if (data.status === 'generating') {
                  setProcessingStage('generating');
                } else if (data.status === 'researched' && data.webResearchUsed) {
                  setWebResearchUsed(true);
                }
              }
              
              // Update summary with partial content
              if (data.partialSummary) {
                summaryText += data.partialSummary;
                setSummary(summaryText);
                
                // Check if this chunk includes web research info
                if (data.webResearchUsed) {
                  setWebResearchUsed(true);
                }
              }
            } catch (e) {
              console.error('Error parsing JSON from stream:', e);
            }
          }
        }
        
        // Set final data
        setResponseData({ 
          summary: summaryText,
          webResearchUsed: webResearchUsed
        });
        summaryContent = summaryText;
        
      } catch (streamError) {
        console.error('Streaming API failed, falling back to standard API:', streamError);
        setStatus('Streaming failed, using standard API instead...');
        
        try {
          // Fall back to the standard API
          const fallbackResponse = await fetch('/api/generate-summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              title, 
              content,
              userProfile
            })
          });
          
          if (!fallbackResponse.ok) {
            const fallbackErrorData = await fallbackResponse.json().catch(() => ({}));
            console.error('Fallback API error response:', fallbackErrorData);
            
            throw new Error(`Failed to generate summary: ${fallbackErrorData.error || fallbackResponse.statusText}`);
          }
          
          const fallbackReader = fallbackResponse.body?.getReader();
          let fallbackSummaryText = '';
          
          if (!fallbackReader) {
            throw new Error('Failed to get response reader');
          }
          
          while (true) {
            const { done, value } = await fallbackReader.read();
            if (done) break;
            
            // Process the chunk
            const text = new TextDecoder().decode(value);
            
            // Split by newlines in case multiple JSON objects were sent
            const jsonLines = text.split('\n').filter(line => line.trim());
            
            for (const line of jsonLines) {
              try {
                const data = JSON.parse(line);
                
                // Handle heartbeat to keep connection alive
                if (data.heartbeat) {
                  console.log('Received heartbeat:', new Date(data.timestamp).toISOString());
                  continue; // Skip further processing for heartbeats
                }
                
                // Handle progress updates
                if (data.progress) {
                  setProgress(data.progress);
                }
                
                // Handle different message types
                if (data.status) {
                  setStatus(data.message || '');
                  
                  if (data.status === 'researching') {
                    setProcessingStage('researching');
                  } else if (data.status === 'generating') {
                    setProcessingStage('generating');
                  } else if (data.status === 'researched' && data.webResearchUsed) {
                    setWebResearchUsed(true);
                  }
                }
                
                // Update summary with partial content
                if (data.partialSummary) {
                  fallbackSummaryText += data.partialSummary;
                  setSummary(fallbackSummaryText);
                  
                  // Check if this chunk includes web research info
                  if (data.webResearchUsed) {
                    setWebResearchUsed(true);
                  }
                }
              } catch (e) {
                console.error('Error parsing JSON from stream:', e);
              }
            }
          }
          
          // Set final data
          setResponseData({ 
            summary: fallbackSummaryText,
            webResearchUsed: webResearchUsed
          });
          summaryContent = fallbackSummaryText;
          
        } catch (fallbackError) {
          throw fallbackError;
        }
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
      
      // When complete, set progress to 100%
      setProgress(100);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      
    } catch (error) {
      console.error('Error submitting research:', error);
      setError(`${error instanceof Error ? error.message : 'Failed to submit research. Please try again.'}`);
      setStatus('');
      setProcessingStage('idle');
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      setProgress(0);
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
      
      {loading && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {processingStage === 'researching' ? 'Researching...' : 
               processingStage === 'generating' ? 'Generating...' : 
               processingStage === 'saving' ? 'Saving...' : 'Processing...'}
            </span>
            <span>
              {progress < 100 ? 
                `${Math.round(progress)}% (Est. ${Math.ceil(estimatedTime - ((progress / 100) * estimatedTime))}s remaining)` : 
                'Complete!'}
            </span>
          </div>
        </div>
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
          <p className="text-xs text-muted-foreground mt-1">
            {content.length} characters {content.length > 1000 && 
              <span className="text-amber-500">(shorter content will process faster)</span>
            }
          </p>
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
            {responseData.webResearchUsed && (
              <CardDescription>Includes recent web research</CardDescription>
            )}
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
