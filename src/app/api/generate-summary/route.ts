import { NextResponse } from 'next/server';
import OpenAI from 'openai';

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
      console.error('Status:', (error as any).status);
    }
    if ('response' in error) {
      console.error('Response:', (error as any).response?.data || (error as any).response);
    }
  }
  
  // Log as JSON for better visibility in logs
  try {
    console.error('Error details:', JSON.stringify(error, null, 2));
  } catch (e) {
    console.error('Error could not be stringified:', e);
  }
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
    
    const { title, content } = requestBody;
    
    // Validate request data
    if (!title || !content) {
      console.error('Missing required fields:', { hasTitle: !!title, hasContent: !!content });
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    console.log('Request validation passed, initializing OpenAI');

    // Initialize OpenAI with API key from environment variable
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize Perplexity client if API key is available
    let perplexity = null;
    if (process.env.PERPLEXITY_API_KEY) {
      perplexity = new OpenAI({
        apiKey: process.env.PERPLEXITY_API_KEY,
        baseURL: 'https://api.perplexity.ai',
      });
    } else {
      console.warn('Missing PERPLEXITY_API_KEY environment variable - web search will be skipped');
    }

    // Use Perplexity Sonar if available
    let webResearchResults = "";
    if (perplexity) {
      try {
        console.log('Calling Perplexity API...');
        const webResearchPrompt = `
          I need comprehensive, up-to-date information about the following financial technology topic:
          
          Topic: ${title}
          
          Please search the web and provide:
          1. Recent developments and news
          2. Key industry players
          3. Market trends
          4. Regulatory considerations
          5. Expert opinions
          
          This information will be used to enhance a research summary.
        `;

        const perplexityResponse = await perplexity.chat.completions.create({
          model: "sonar-pro",
          messages: [
            { role: "system", content: "You are a financial technology research assistant. Provide comprehensive, factual information with sources when available." },
            { role: "user", content: webResearchPrompt }
          ],
          temperature: 0.5,
          max_tokens: 2000,
        });
        
        webResearchResults = perplexityResponse.choices[0].message.content || "";
        console.log('Perplexity API response received');
      } catch (error) {
        logError('Error with Perplexity API', error);
        webResearchResults = "Unable to retrieve additional web research at this time.";
      }
    } else {
      webResearchResults = "Web research capability is not configured.";
    }

    // Use OpenAI to generate the final summary
    try {
      console.log('Sending request to OpenAI API');
      console.time('openai-request');
      
      // Create a more detailed prompt
      const finalPrompt = `
        Please analyze the following research content and provide a comprehensive summary:
        
        TITLE: ${title}
        
        CONTENT:
        ${content}
        
        Additional Web Research:
        ${webResearchResults}
        
        Please provide a well-structured summary that includes:
        1. Key points and findings
        2. Important trends or patterns
        3. Potential implications
        4. Any notable data or statistics
        
        Format the summary with appropriate headings and bullet points where relevant.
      `;
      
      // Call OpenAI API with timeout handling
      const response = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a financial research assistant, skilled at summarizing complex information." },
            { role: "user", content: finalPrompt }
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI API request timed out after 50 seconds')), 50000)
        )
      ]) as OpenAI.Chat.Completions.ChatCompletion;
      
      console.timeEnd('openai-request');
      console.log('OpenAI API response received');

      const summary = response.choices[0].message.content || "Unable to generate summary.";
      return NextResponse.json({ summary });
      
    } catch (error) {
      logError('Error with OpenAI API', error);
      
      // Provide more specific error messages based on error type
      if (error instanceof Error) {
        if (error.message.includes('timed out')) {
          return NextResponse.json(
            { error: 'The request to OpenAI timed out. Please try again with a shorter content.' },
            { status: 504 }
          );
        }
        
        if ('status' in error && (error as any).status === 429) {
          return NextResponse.json(
            { error: 'Rate limit exceeded with OpenAI. Please try again later.' },
            { status: 429 }
          );
        }
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