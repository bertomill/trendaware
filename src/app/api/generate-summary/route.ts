import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Define a type for API errors
interface ApiError extends Error {
  status?: number;
  response?: {
    data?: unknown;
    [key: string]: unknown;
  };
}

// Enhanced error logging function
const logError = (message: string, error: unknown) => {
  console.error(`${message}:`, error);
  
  // Log additional details about the error
  if (error instanceof Error) {
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Log additional properties for API errors
    if ('status' in error) {
      console.error('Status:', (error as ApiError).status);
    }
    if ('response' in error) {
      console.error('Response:', (error as ApiError).response?.data || (error as ApiError).response);
    }
  }
  
  // Log as JSON for better visibility in logs
  try {
    console.error('Error details:', JSON.stringify(error, null, 2));
  } catch (e) {
    console.error('Error could not be stringified:', e);
  }
};

export const config = {
  maxDuration: 60,
  runtime: 'edge',
};

export async function POST(request: Request) {
  console.log('API route called: /api/generate-summary');
  
  try {
    // Check if API keys are available
    if (!process.env.OPENAI_API_KEY) {
      console.error('Missing OPENAI_API_KEY environment variable');
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    console.log('OpenAI API key is configured');
    
    // Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
      console.log('Request body parsed successfully');
    } catch (error) {
      logError('Failed to parse request body', error);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    
    const { title, content, userProfile } = requestBody;
    
    // Validate request data
    if (!title || !content) {
      console.error('Missing required fields:', { hasTitle: !!title, hasContent: !!content });
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    console.log('Request validation passed, user profile available:', !!userProfile);

    // Initialize OpenAI with API key from environment variable
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Use OpenAI to generate the final summary
    try {
      console.log('Sending request to OpenAI API');
      console.time('openai-request');
      
      // Create a personalized system message
      let systemMessage = "You are a financial research assistant, skilled at summarizing complex information.";
      
      if (userProfile) {
        systemMessage = `You are a financial research assistant helping ${userProfile.displayName || 'a user'}, who works as a ${userProfile.jobTitle || 'a professional'} in the ${userProfile.industry || 'financial'} industry. 
        
Their areas of expertise include ${userProfile.expertise?.join(', ') || 'finance'}, and they're interested in ${userProfile.interests?.join(', ') || 'financial technology'}. 
        
Tailor your summary to their background and interests, addressing them by name occasionally to make it conversational and personalized.`;
      }
      
      // Reduce token count for faster response
      const maxContentLength = 4000; // Limit content length
      const truncatedContent = content.length > maxContentLength 
        ? content.substring(0, maxContentLength) + "..." 
        : content;
      
      // Create a more efficient prompt
      const finalPrompt = `
        Summarize this research concisely:
        
        TITLE: ${title}
        
        CONTENT:
        ${truncatedContent}
        
        ${userProfile ? `Make it personal for ${userProfile.displayName}, a ${userProfile.jobTitle} in ${userProfile.industry}.` : ''}
      `;
      
      // Use a faster model with stricter timeout
      const response = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-3.5-turbo", // Consider using a faster model
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: finalPrompt }
          ],
          temperature: 0.5, // Lower temperature for faster, more deterministic responses
          max_tokens: 1000, // Reduce token count
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI API request timed out after 30 seconds')), 30000)
        )
      ]) as OpenAI.Chat.Completions.ChatCompletion;
      
      console.timeEnd('openai-request');
      console.log('OpenAI API response received');

      const summary = response.choices[0].message.content || "Unable to generate summary.";
      return NextResponse.json({ summary });
      
    } catch (error) {
      logError('Error with OpenAI API', error);
      
      // Provide a fallback summary if OpenAI times out
      if (error instanceof Error && error.message.includes('timed out')) {
        console.log('OpenAI timed out, generating fallback summary');
        
        // Generate a simple fallback summary
        const fallbackSummary = `
          # Summary of "${title}"
          
          Due to high demand, we couldn't generate a complete AI summary at this time. 
          
          ## Key Points:
          * This research focuses on ${title}
          * The content contains approximately ${content.length} characters
          ${userProfile ? `* Prepared for ${userProfile.displayName}` : ''}
          
          Please try again later with a shorter research content for better results.
        `;
        
        return NextResponse.json({ 
          summary: fallbackSummary,
          fallback: true
        });
      }
      
      // Provide more specific error messages based on error type
      const apiError = error as ApiError;
      if ('status' in apiError && apiError.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded with OpenAI. Please try again later.' },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to generate summary with OpenAI', details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  } catch (error) {
    logError('Unexpected error in generate-summary API', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 