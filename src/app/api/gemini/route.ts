import { NextResponse } from 'next/server';
import { getGeminiResponse } from '@/lib/gemini';

export async function POST(req: Request) {
  if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'API key not configured. Please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables.' },
      { status: 500 }
    );
  }

  try {
    const { prompt } = await req.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'No prompt provided' },
        { status: 400 }
      );
    }

    const response = await getGeminiResponse(prompt);
    return NextResponse.json({ response });
  } catch (err) {
    console.error('API Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to get response from Gemini';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 