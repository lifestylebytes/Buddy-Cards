import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ExtractedWord } from "@/types/vocab";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType || "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `이 책 페이지 이미지를 분석해주세요. 밑줄이 그어진 단어나 구문들을 찾아서 어휘 정보를 추출해주세요.

밑줄 친 단어가 없다면, 페이지에서 학습할 만한 고급 어휘를 최대 10개 골라주세요.

각 단어에 대해 다음 JSON 배열 형식으로 정확히 반환해주세요:

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
    "contextSentence": "책에서 실제로 사용된 문장 (있으면)"
  }
]
\`\`\`

JSON만 반환하고 다른 텍스트는 포함하지 마세요.`,
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON from response
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) ||
      text.match(/\[[\s\S]*\]/) || [null, text];
    const jsonStr = jsonMatch[1] || jsonMatch[0] || text;

    let words: ExtractedWord[] = [];
    try {
      const parsed = JSON.parse(jsonStr.trim());
      words = Array.isArray(parsed) ? parsed : [];
    } catch {
      // Try to find array in text
      const arrMatch = text.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        words = JSON.parse(arrMatch[0]);
      }
    }

    return NextResponse.json({ words });
  } catch (error) {
    console.error("Extract vocab error:", error);
    return NextResponse.json(
      { error: "Failed to analyze image" },
      { status: 500 }
    );
  }
}
