// import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const config = {
  maxDuration: 30,
  runtime: 'edge',
};

export async function POST(request: Request) {
  // Create a TransformStream to stream the response
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

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
      
      // Send update
      writer.write(encoder.encode(JSON.stringify({ 
        status: 'researching',
        message: 'Researching your topic...'
      }) + '\n'));
      
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
        message: 'Generating summary...'
      }) + '\n'));
      
      // Generate summary with OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: `Summarize this research concisely: TITLE: ${title} CONTENT: ${truncatedContent}` }
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
            partialSummary: content
          }) + '\n'));
        }
      }
      
      // Send completion
      writer.write(encoder.encode(JSON.stringify({ 
        status: 'complete',
        message: 'Summary generation complete'
      }) + '\n'));
      
    } catch (error) {
      // Send error
      writer.write(encoder.encode(JSON.stringify({ 
        status: 'error',
        message: error instanceof Error ? error.message : 'An error occurred'
      }) + '\n'));
    } finally {
      writer.close();
    }
  };
  
  // Start processing in the background
  processRequest();
  
  // Return the stream
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked'
    }
  });
} 