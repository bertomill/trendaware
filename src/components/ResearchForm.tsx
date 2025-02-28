'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserProfile } from '@/components/UserProfile';
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
  const [estimatedTime] = useState(15); // Default 15 seconds, remove setter if not used
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

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
    // Fix the exhaustive-deps warning by capturing the ref value
    const currentProgressInterval = progressIntervalRef.current;
    
    return () => {
      if (currentProgressInterval) {
        clearInterval(currentProgressInterval);
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
      
      // Try streaming approach first for shorter content
      if (content.length < 2000) {
        try {
          setStatus('Using streaming approach for faster results...');
          
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
            // Set a shorter timeout for the streaming approach
            signal: AbortSignal.timeout(20000)
          });
          
          if (!streamResponse.ok) {
            throw new Error(`API responded with status: ${streamResponse.status}`);
          }
          
          // Process the streaming response
          const reader = streamResponse.body?.getReader();
          let summaryText = '';
          let isWebResearchUsed = false;
          
          if (!reader) {
            throw new Error('Failed to get response reader');
          }
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              break;
            }
            
            // Convert the chunk to text
            const chunk = new TextDecoder().decode(value);
            const jsonLines = chunk.split('\n').filter(line => line.trim());
            
            // Process each line as a separate JSON message
            for (const line of jsonLines) {
              try {
                const data = JSON.parse(line);
                
                // Handle heartbeat messages
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
                    isWebResearchUsed = true;
                  }
                }
                
                // Update summary with partial content
                if (data.partialSummary) {
                  summaryText += data.partialSummary;
                  setSummary(summaryText);
                  
                  // Check if this chunk includes web research info
                  if (data.webResearchUsed) {
                    isWebResearchUsed = true;
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
            webResearchUsed: isWebResearchUsed
          });
          
          // Record API response time
          if (startTimeRef.current) {
            const endTime = Date.now();
            const responseTime = endTime - startTimeRef.current;
            setApiResponseTime(responseTime);
          }
          
          setProgress(100);
          setProcessingStage('complete');
          return; // Exit if streaming was successful
          
        } catch (streamError) {
          console.log('Streaming approach failed, falling back to split approach:', streamError);
          setStatus('Switching to more reliable approach...');
        }
      }
      
      // Generate a unique request ID
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Step 1: Initiate web research in the background
      setProcessingStage('researching');
      setStatus('Initiating web research...');
      
      const researchResponse = await fetch('/api/web-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          title,
          requestId
        })
      });
      
      if (!researchResponse.ok) {
        throw new Error('Failed to initiate web research');
      }
      
      // Step 2: Poll for research status
      setStatus('Researching your topic...');
      let webResearch = null;
      let attempts = 0;
      const maxAttempts = 15; // 15 attempts with 2-second intervals = 30 seconds max wait
      
      const pollInterval = setInterval(async () => {
        attempts++;
        setProgress(Math.min((attempts / maxAttempts) * 80, 80)); // Max 80% for research phase
        
        try {
          const statusResponse = await fetch(`/api/web-research?requestId=${requestId}`);
          
          if (statusResponse.ok) {
            const data = await statusResponse.json();
            
            if (data.status === 'completed') {
              clearInterval(pollInterval);
              webResearch = data.research;
              setStatus('Web research complete, generating summary...');
              setProcessingStage('generating');
              setProgress(85);
              
              // Proceed to summary generation
              generateSummary(webResearch);
            } else if (data.status === 'failed') {
              clearInterval(pollInterval);
              console.warn('Web research failed:', data.error);
              setStatus('Web research unavailable, generating summary with your content only...');
              setProcessingStage('generating');
              setProgress(85);
              
              // Proceed without web research
              generateSummary(null);
            }
          }
        } catch (error) {
          console.error('Error checking research status:', error);
        }
        
        // If we've reached max attempts, proceed without web research
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setStatus('Web research taking too long, proceeding with your content only...');
          setProcessingStage('generating');
          setProgress(85);
          
          // Proceed without web research
          generateSummary(null);
        }
      }, 2000);
      
      // Function to generate summary once research is done or timed out
      const generateSummary = async (webResearch: string | null) => {
        try {
          const summaryResponse = await fetch('/api/generate-summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              title, 
              content,
              userProfile,
              webResearch
            })
          });
          
          if (!summaryResponse.ok) {
            throw new Error('Failed to generate summary');
          }
          
          const data = await summaryResponse.json();
          setSummary(data.summary);
          setResponseData({
            summary: data.summary,
            webResearchUsed: !!webResearch
          });
          
          // Record API response time
          if (startTimeRef.current) {
            const endTime = Date.now();
            const responseTime = endTime - startTimeRef.current;
            setApiResponseTime(responseTime);
          }
          
          setProgress(100);
          setProcessingStage('complete');
        } catch (error) {
          throw error;
        }
      };
      
    } catch (error) {
      console.error('Error submitting research:', error);
      setError(`${error instanceof Error ? error.message : 'Failed to submit research. Please try again.'}`);
      setStatus('');
      setProcessingStage('idle');
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
