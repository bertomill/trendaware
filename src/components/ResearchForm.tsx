'use client';

import { useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { db } from '@/src/lib/firebase';
import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { Button } from '@/src/components/ui/button';
import { Textarea } from '@/src/components/ui/textarea';
import { Input } from '@/src/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card';

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
      
      // Generate AI summary with web research
      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await currentUser.getIdToken()}`,
          'User-Id': currentUser.uid
        },
        body: JSON.stringify({
          title,
          content
        }),
      });
      
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
        content: summary,
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Submit Research</CardTitle>
          <CardDescription>
            Enter your research topic and content to generate an AI-enhanced summary with web research
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          {status && <p className="text-blue-500 mb-4">{status}</p>}
          <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Input
                  id="title"
                  placeholder="Research Title/Topic"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Textarea
                  id="content"
                  placeholder="Enter your research content or notes here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  required
                />
              </div>
            </div>
            <Button className="w-full mt-4" type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Submit Research & Generate Web-Enhanced Summary'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>AI-Enhanced Summary with Web Research</CardTitle>
            <CardDescription>
              Generated summary with additional research insights from the web
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: summary }} />
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => setSummary('')}>
              Clear Summary
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
