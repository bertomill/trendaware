'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/src/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/src/components/ui/card';
import ResearchForm from '@/src/components/ResearchForm';
import DashboardLayout from '@/components/DashboardLayout';
import { MetricsCard } from '@/src/components/MetricsCard';
import { FileText, Plus } from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

interface ResearchItem {
  id: string;
  title: string;
  content: string;
  createdAt: {
    toDate: () => Date;
  } | Date;
}

export default function Dashboard() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [research, setResearch] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      router.push('/login');
      return;
    }

    async function fetchResearch() {
      try {
        const q = query(
          collection(db, "research"),
          where("userId", "==", currentUser?.uid)
        );
        
        const querySnapshot = await getDocs(q);
        const researchData: ResearchItem[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          researchData.push({
            id: doc.id,
            title: data.title,
            content: data.content,
            createdAt: data.createdAt,
          });
        });
        
        setResearch(researchData);
      } catch (error) {
        console.error("Error fetching research:", error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchResearch();
  }, [currentUser, router]);

  if (!currentUser) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Research Overview</h1>
          <div className="text-sm text-gray-400">Your financial technology research insights</div>
        </div>
        <Button variant="outline" className="gap-2 border-gray-700" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Hide Form" : "New Research"}
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricsCard
          title="Total Research"
          value={research.length.toString()}
        />
        <MetricsCard
          title="Recent Activity"
          value="Last 7 days"
          change={{ value: "+3", percentage: "+15%", isPositive: true }}
        />
        <MetricsCard
          title="AI Summaries"
          value={research.length.toString()}
          change={{ value: "", percentage: "100%", isPositive: true }}
        />
      </div>

      {showForm && (
        <Card className="mt-6 p-6 bg-background/50 border-gray-800">
          <h2 className="mb-4 text-lg font-semibold">Create New Research</h2>
          <ResearchForm />
        </Card>
      )}

      <Card className="mt-6 p-6 bg-background/50 border-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your Research</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost">
              Recent
            </Button>
            <Button size="sm" variant="ghost">
              Popular
            </Button>
            <Button size="sm" variant="ghost">
              Saved
            </Button>
          </div>
        </div>
        
        {loading ? (
          <p className="text-gray-400">Loading your research...</p>
        ) : research.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {research.map((item) => (
              <Card 
                key={item.id} 
                className="overflow-hidden transition-all hover:shadow-md"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <CardTitle className="text-base font-medium">{item.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.content}</p>
                </CardContent>
                <CardFooter className="pt-0 flex justify-between items-center text-xs text-muted-foreground">
                  <div>
                    {new Date(
                      item.createdAt instanceof Date 
                        ? item.createdAt 
                        : item.createdAt?.toDate()
                    ).toLocaleDateString()}
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    <span>View</span>
                  </Button>
                </CardFooter>
                <div className="h-1 w-full bg-gradient-to-r from-primary/80 to-primary/30"></div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-3">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mb-1 text-lg font-medium">No research found</h3>
            <p className="text-sm text-muted-foreground">Create your first research to get started</p>
            <Button onClick={() => setShowForm(true)} className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              New Research
            </Button>
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}
