'use client';

import OpenAI from 'openai';

let openaiInstance: OpenAI | null = null;

export function getOpenAIApi(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

export async function generateResearchSummary(title: string, content: string): Promise<string> {
  try {
    const openai = getOpenAIApi();
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an AI research assistant for finance professionals. Generate a concise summary that includes key insights, relevant financial implications, and actionable recommendations."
        },
        {
          role: "user",
          content: `Research Title: ${title}\n\nContent: ${content}`
        }
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || "Unable to generate summary";
  } catch (error) {
    console.error('Error generating research summary:', error);
    return "Error generating summary. Please try again later.";
  }
}
