import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIApi } from '@/src/lib/ai';
import { db } from '@/src/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    // Get the current user
    const authToken = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify token and get user ID (you may need to implement this)
    // For simplicity, let's assume we have the userId
    const userId = request.headers.get('User-Id');
    if (!userId) {
      return NextResponse.json({ error: 'User ID not provided' }, { status: 400 });
    }

    // Get user profile from Firestore
    const userProfileRef = doc(db, 'userProfiles', userId);
    const userProfileSnap = await getDoc(userProfileRef);
    const userProfile = userProfileSnap.exists() ? userProfileSnap.data() : null;

    const { title, content } = await request.json();

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const openai = getOpenAIApi();

    // Create a personalized system prompt using user profile data
    let systemPrompt = "You are an AI research assistant for finance professionals.";
    
    if (userProfile) {
      systemPrompt += ` You're assisting ${userProfile.displayName || 'a user'}, who works as a ${userProfile.jobTitle || 'finance professional'} in the ${userProfile.industry || 'finance'} industry. `;
      
      if (userProfile.interests?.length > 0) {
        systemPrompt += `They're interested in: ${userProfile.interests.join(', ')}. `;
      }
      
      if (userProfile.expertise?.length > 0) {
        systemPrompt += `They have expertise in: ${userProfile.expertise.join(', ')}. `;
      }
      
      if (userProfile.researchPreferences?.focus?.length > 0) {
        systemPrompt += `Focus your research on: ${userProfile.researchPreferences.focus.join(', ')}. `;
      }
      
      const depth = userProfile.researchPreferences?.depth || 'intermediate';
      systemPrompt += `Provide ${depth}-level analysis appropriate for their expertise. `;
    }
    
    systemPrompt += "Generate a concise summary that includes key insights, relevant financial implications, and actionable recommendations.";

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Research Title: ${title}\n\nContent: ${content}` }
      ],
      temperature: 0.7,
    });

    const summary = response.choices[0]?.message?.content || "Unable to generate summary";

    return NextResponse.json({ summary });
  } catch (error: unknown) {
    console.error('Error generating summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate summary';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 