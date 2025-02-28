'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ResearchForm() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const { currentUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError('You must be logged in to submit research');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setStatus('Conducting web research and generating summary...');
      
      // Call the API to generate a summary
      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, content }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }
      
      const data = await response.json();
      setSummary(data.summary);
      
      setStatus('Saving research to database...');
      
      // Save to Firestore
      const researchData = {
        userId: currentUser.uid,
        title,
        content,
        createdAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, 'research'), researchData);
      
      // Add the summary as a subcollection
      const summaryCollectionRef = collection(doc(db, 'research', docRef.id), 'summaries');
      await addDoc(summaryCollectionRef, {
        content: data.summary,
        createdAt: serverTimestamp(),
      });
      
      // Reset form and status
      setTitle('');
      setContent('');
      setStatus('');
    } catch (error) {
      console.error('Error submitting research:', error);
      setError('Failed to submit research. Please try again.');
      setStatus('');
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
        
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
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
    </div>
  );
}
