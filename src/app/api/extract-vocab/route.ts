import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ExtractedWord } from "@/types/vocab";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const VOCAB_JSON_FORMAT = `
\`\`\`json
[
  {
    "word": "단어",
    "pronunciation": "발음기호 (있으면)",
    "partOfSpeech": "품사 (명사/동사/형용사 등)",
    "definition": "English definition",
    "koreanDefinition": "한국어 정의",
    "exampleSentence": "Example sentence in English",
    "exampleSentenceKorean": "예문 한국어 번역",
    "contextSentence": "텍스트에서 실제로 사용된 문장 (있으면)"
  }
]
\`\`\`

JSON만 반환하고 다른 텍스트는 포함하지 마세요.`;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const { imageBase64, mimeType, text } = await req.json();

    if (!imageBase64 && !text) {
      return NextResponse.json({ error: "No input provided" }, { status: 400 });
    }

    let userContent: OpenAI.Chat.ChatCompletionContentPart[];

    if (text) {
      userContent = [
        {
          type: "text",
          text: `다음 텍스트를 분석해서 학습할 만한 어휘를 최대 10개 골라주세요.

텍스트가 어떤 언어나 형식이어도 괜찮아요:
- 영어 소설/에세이 → 고급 어휘 추출
- 한국어 텍스트 → 영어로 대응되는 학습 어휘 추출
- 단어 목록, 문장, 단락 등 모든 형식 지원
- 단어 하나만 입력해도 그 단어를 카드로 만들어주세요

텍스트:
"""
${text}
"""

각 단어에 대해 다음 JSON 배열 형식으로 정확히 반환해주세요:
${VOCAB_JSON_FORMAT}`,
        },
      ];
    } else {
      userContent = [
        {
          type: "image_url",
          image_url: {
            url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
            detail: "high",
          },
        },
        {
          type: "text",
          text: `이 책 페이지 이미지를 분석해주세요. 밑줄이 그어진 단어나 구문들을 찾아서 어휘 정보를 추출해주세요.

밑줄 친 단어가 없다면, 페이지에서 학습할 만한 고급 어휘를 최대 10개 골라주세요.

각 단어에 대해 다음 JSON 배열 형식으로 정확히 반환해주세요:
${VOCAB_JSON_FORMAT}`,
        },
      ];
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      messages: [{ role: "user", content: userContent }],
    });

    const responseText = response.choices[0]?.message?.content ?? "";

    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) ||
      responseText.match(/\[[\s\S]*\]/) || [null, responseText];
    const jsonStr = jsonMatch[1] || jsonMatch[0] || responseText;

    let words: ExtractedWord[] = [];
    try {
      const parsed = JSON.parse(jsonStr.trim());
      words = Array.isArray(parsed) ? parsed : [];
    } catch {
      const arrMatch = responseText.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        words = JSON.parse(arrMatch[0]);
      }
    }

    return NextResponse.json({ words });
  } catch (error) {
    console.error("Extract vocab error:", error);
    return NextResponse.json(
      { error: "Failed to analyze input" },
      { status: 500 }
    );
  }
}
