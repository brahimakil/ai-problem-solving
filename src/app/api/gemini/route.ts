import { NextResponse } from 'next/server';
import { getGeminiResponse } from '@/lib/gemini';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
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