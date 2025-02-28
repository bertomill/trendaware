// import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const config = {
  maxDuration: 60, // Maximum duration in seconds
  runtime: 'edge',
};

// Helper function to log errors
const logError = (message: string, error: unknown) => {
  console.error(`${message}:`, error);
  if (error instanceof Error) {
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
};

export async function POST(request: Request) {
  // Create a TransformStream to stream the response
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Set up a heartbeat to keep the connection alive
  const heartbeatInterval = setInterval(() => {
    writer.write(encoder.encode(JSON.stringify({ 
      heartbeat: true,
      timestamp: Date.now()
    }) + '\n'));
  }, 5000); // Send heartbeat every 5 seconds

  // Process the request in the background
  const processRequest = async () => {
    try {
      // Parse request body
      const { title, content, userProfile } = await request.json();
      
      // Send initial response
      writer.write(encoder.encode(JSON.stringify({ 
        status: 'processing',
        message: 'Starting research...'
      }) + '\n'));
      
      // Truncate content
      const maxContentLength = 4000;
      const truncatedContent = content.length > maxContentLength 
        ? content.substring(0, maxContentLength) + "..." 
        : content;
      
      // Send update about web research
      writer.write(encoder.encode(JSON.stringify({ 
        status: 'researching',
        message: 'Searching the web for recent information...'
      }) + '\n'));
      
      // Try to get web research from Perplexity if API key is available
      let webResearchResults = "";
      let webResearchUsed = false;
      
      if (process.env.PERPLEXITY_API_KEY) {
        try {
          // Send immediate feedback
          writer.write(encoder.encode(JSON.stringify({ 
            status: 'researching',
            message: 'Initiating web search...',
            progress: 10
          }) + '\n'));
          
          // Use a shorter timeout for Perplexity
          const perplexityPromise = fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
            },
            body: JSON.stringify({
              model: "sonar-pro", // Change back to the more comprehensive model
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
              max_tokens: 800, // Increase token count for more comprehensive results
            }),
          });
          
          // Increase timeout for more comprehensive results
          const timeoutPromise = new Promise<Response>((_, reject) => 
            setTimeout(() => reject(new Error('Perplexity API request timed out')), 15000) // Increase to 15 seconds
          );
          
          // Send progress updates while waiting
          let progressCounter = 20;
          const progressInterval = setInterval(() => {
            if (progressCounter < 90) {
              progressCounter += 10;
              writer.write(encoder.encode(JSON.stringify({ 
                status: 'researching',
                message: 'Still searching the web...',
                progress: progressCounter
              }) + '\n'));
            }
          }, 2000);
          
          try {
            const perplexityResponse = await Promise.race([perplexityPromise, timeoutPromise]) as Response;
            clearInterval(progressInterval);
            
            if (perplexityResponse.ok) {
              const perplexityData = await perplexityResponse.json();
              webResearchResults = perplexityData.choices[0].message.content;
              webResearchUsed = true;
              
              // Log the web research results for debugging
              console.log('Perplexity web research results:', webResearchResults.substring(0, 100) + '...');
              
              // Update the client that web research was successful
              writer.write(encoder.encode(JSON.stringify({ 
                status: 'researched',
                message: 'Web research complete, generating summary...',
                webResearchUsed: true,
                webResearchLength: webResearchResults.length
              }) + '\n'));
            } else {
              writer.write(encoder.encode(JSON.stringify({ 
                status: 'researching',
                message: 'Web search unavailable, using your content only...'
              }) + '\n'));
            }
          } catch (timeoutError) {
            clearInterval(progressInterval);
            throw timeoutError;
          }
        } catch (error) {
          logError('Error with Perplexity API', error);
          writer.write(encoder.encode(JSON.stringify({ 
            status: 'researching',
            message: 'Web search timed out, proceeding with your content only...'
          }) + '\n'));
        }
      }
      
      // Initialize OpenAI
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      // Create system message
      let systemMessage = "You are a financial research assistant, skilled at summarizing complex information.";
      if (userProfile) {
        systemMessage = `You are a financial research assistant helping ${userProfile.displayName || 'a user'}, who works as a ${userProfile.jobTitle || 'a professional'} in the ${userProfile.industry || 'financial'} industry.`;
      }
      
      // Send update
      writer.write(encoder.encode(JSON.stringify({ 
        status: 'generating',
        message: 'Generating your personalized summary...'
      }) + '\n'));
      
      // Create a prompt that includes web research if available
      const finalPrompt = `
        Summarize this research concisely:
        
        TITLE: ${title}
        
        USER CONTENT:
        ${truncatedContent}
        
        ${webResearchResults ? `RECENT WEB RESEARCH FROM PERPLEXITY:
        ${webResearchResults}
        
        IMPORTANT: Incorporate the above web research prominently in your summary. It contains up-to-date information that should be highlighted.` : ''}
        
        ${userProfile ? `Make it personal for ${userProfile.displayName}, a ${userProfile.jobTitle} in ${userProfile.industry}.` : ''}
      `;
      
      // Generate summary with OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: finalPrompt }
        ],
        temperature: 0.5,
        max_tokens: 1000,
        stream: true,
      });
      
      // Stream the response
      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          writer.write(encoder.encode(JSON.stringify({ 
            partialSummary: content,
            webResearchUsed
          }) + '\n'));
        }
      }
      
      // Send completion
      writer.write(encoder.encode(JSON.stringify({ 
        status: 'complete',
        message: 'Summary generation complete',
        webResearchUsed
      }) + '\n'));
      
    } catch (error) {
      // Send error
      writer.write(encoder.encode(JSON.stringify({ 
        status: 'error',
        message: error instanceof Error ? error.message : 'An error occurred'
      }) + '\n'));
    } finally {
      clearInterval(heartbeatInterval); // Clear the heartbeat interval
      writer.close();
    }
  };
  
  // Start processing in the background
  processRequest();
  
  // Return the stream
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
} 