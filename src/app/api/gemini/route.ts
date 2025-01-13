import { NextResponse } from 'next/server';
import { getGeminiResponse } from '@/lib/gemini';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const response = await getGeminiResponse(prompt);
    return NextResponse.json({ response });
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json(
      { error: 'Failed to get response from Gemini' },
      { status: 500 }
    );
  }
} 