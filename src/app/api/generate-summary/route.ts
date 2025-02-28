import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Add more detailed logging
const logError = (message: string, error: any) => {
  console.error(`${message}:`, error);
  console.error('Error details:', JSON.stringify(error, null, 2));
};

export async function POST(request: Request) {
  try {
    // Check if API keys are available
    if (!process.env.OPENAI_API_KEY) {
      console.error('Missing OPENAI_API_KEY environment variable');
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

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

    // Parse request body
    let title, content;
    try {
      const body = await request.json();
      title = body.title;
      content = body.content;
    } catch (error) {
      logError('Error parsing request body', error);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
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
      console.log('Calling OpenAI API...');
      const finalPrompt = `
        You are an AI research assistant for financial technology professionals.
        
        Research Topic: ${title}
        
        Original Research Content:
        ${content}
        
        Additional Web Research:
        ${webResearchResults}
        
        Please:
        1. Summarize the key points from the original research
        2. Incorporate relevant information from the web research
        3. Identify potential implications for the banking/financial services industry
        4. Suggest areas for further research
        5. Include citations or sources from the web research where applicable
        
        Format your response in HTML with appropriate headings and sections.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a helpful assistant that specializes in financial technology research." },
          { role: "user", content: finalPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const summary = response.choices[0].message.content || "Unable to generate summary.";
      console.log('OpenAI API response received');

      return NextResponse.json({ summary });
    } catch (error) {
      logError('Error with OpenAI API', error);
      return NextResponse.json(
        { error: 'Failed to generate summary with OpenAI' },
        { status: 500 }
      );
    }
  } catch (error) {
    logError('Unexpected error in generate-summary API', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 