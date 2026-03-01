"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { ExtractedWord } from "@/types/vocab";

interface Props {
  onExtracted: (words: ExtractedWord[], imageBase64: string) => void;
}

export default function TextInputer({ onExtracted }: Props) {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!inputText.trim()) {
      setError("텍스트를 입력해주세요.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/extract-vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });

      if (!res.ok) throw new Error("분석 실패");

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      onExtracted(data.words || [], "");
    } catch (err) {
      setError("어휘 추출에 실패했어요. 다시 시도해주세요.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="영어 텍스트를 붙여넣거나 입력하세요&#10;&#10;예) The ephemeral nature of life makes every moment precious..."
        rows={8}
        disabled={loading}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 transition-all disabled:opacity-50"
      />

      <button
        onClick={handleSubmit}
        disabled={loading || !inputText.trim()}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-violet-500 text-white font-semibold text-sm hover:bg-violet-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            어휘 추출 중...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            어휘 추출하기
          </>
        )}
      </button>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 text-center">
          {error}
        </div>
      )}
    </div>
  );
}
