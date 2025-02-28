import { NextResponse } from 'next/server';

export const config = {
  maxDuration: 60,
  runtime: 'edge',
};

// Simple in-memory cache (will be reset on server restart)
const researchCache = new Map();

export async function POST(request: Request) {
  try {
    const { title, requestId } = await request.json();
    
    // Start the research process in the background without waiting for it
    performWebResearch(title, requestId);
    
    // Return immediately with a success message
    return NextResponse.json({ 
      status: 'initiated',
      message: 'Web research initiated',
      requestId
    });
  } catch (error) {
    console.error('Error initiating web research:', error);
    return NextResponse.json({ error: 'Failed to initiate research' }, { status: 500 });
  }
}

// Function to perform web research in the background
async function performWebResearch(title: string, requestId: string) {
  try {
    if (!process.env.PERPLEXITY_API_KEY) {
      researchCache.set(requestId, { status: 'failed', error: 'No API key' });
      return;
    }
    
    // Set initial status
    researchCache.set(requestId, { status: 'processing' });
    
    // Make the API call to Perplexity
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { 
            role: "system", 
            content: "You are a financial research assistant. Search the web for the most recent and relevant information. Focus on facts, data, and recent developments. Provide comprehensive but concise results." 
          },
          { 
            role: "user", 
            content: `Research the following topic thoroughly: ${title}. Focus on financial implications, market trends, and recent news. Include specific data points and insights when available.` 
          }
        ],
        max_tokens: 800,
      }),
    });
    
    if (perplexityResponse.ok) {
      const data = await perplexityResponse.json();
      const research = data.choices[0].message.content;
      
      // Store the research results in the cache
      researchCache.set(requestId, { 
        status: 'completed',
        research,
        timestamp: Date.now()
      });
      
      console.log(`Web research completed for request ${requestId}`);
    } else {
      researchCache.set(requestId, { 
        status: 'failed',
        error: 'Perplexity API error'
      });
    }
  } catch (error) {
    console.error('Error performing web research:', error);
    researchCache.set(requestId, { 
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Endpoint to check research status
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestId = url.searchParams.get('requestId');
  
  if (!requestId) {
    return NextResponse.json({ error: 'Missing requestId parameter' }, { status: 400 });
  }
  
  const researchData = researchCache.get(requestId);
  
  if (!researchData) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 });
  }
  
  return NextResponse.json(researchData);
} 