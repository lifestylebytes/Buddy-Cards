"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { RotateCw, ThumbsUp, ThumbsDown, Volume2 } from "lucide-react";
import { VocabCard } from "@/types/vocab";
import { speakEnglish } from "@/lib/tts";

interface Props {
  card: VocabCard;
  onResult: (correct: boolean) => void;
  current: number;
  total: number;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightWord(sentence: string, word: string): ReactNode {
  if (!sentence || !word) return sentence;

  const matcher = new RegExp(`(${escapeRegExp(word)})`, "gi");
  const parts = sentence.split(matcher);

  return parts.map((part, index) =>
    part.toLowerCase() === word.toLowerCase() ? (
      <span key={`${part}-${index}`} className="font-semibold text-violet-100 underline underline-offset-2">
        {part}
      </span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

export default function Flashcard({ card, onResult, current, total }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [exiting, setExiting] = useState<"correct" | "wrong" | null>(null);
  const meaning = card.koreanDefinition || card.definition;
  const displaySentence = card.contextSentence || card.exampleSentence;

  const handleResult = (correct: boolean) => {
    setExiting(correct ? "correct" : "wrong");

    setTimeout(() => {
      setExiting(null);
      setFlipped(false);
      onResult(correct);
    }, 350);
  };

  return (
    <div
      className={`w-full max-w-lg mx-auto transition-all duration-300 ${
        exiting === "correct"
          ? "translate-x-24 opacity-0"
          : exiting === "wrong"
            ? "-translate-x-24 opacity-0"
            : ""
      }`}
    >
      <div className="mb-4">
        <div className="flex justify-between text-sm text-slate-400 mb-1.5">
          <span>
            {current} / {total}
          </span>
          <span>{Math.round((current / total) * 100)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
      </div>

      <div
        className="relative cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => setFlipped((value) => !value)}
      >
        <div
          className="relative min-h-[320px] transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <div
            className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white to-slate-50 shadow-xl border border-slate-100 p-8 flex flex-col"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {card.status === "new" && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full font-medium">
                    NEW
                  </span>
                )}
                {card.status === "learning" && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-600 text-xs rounded-full font-medium">
                    학습중
                  </span>
                )}
                {card.status === "mastered" && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-xs rounded-full font-medium">
                    완료
                  </span>
                )}
              </div>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  speakEnglish(card.word);
                }}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <h2 className="text-4xl font-bold text-slate-800 mb-2">{card.word}</h2>
              {card.pronunciation && (
                <p className="text-slate-400 text-lg">{card.pronunciation}</p>
              )}
              {card.partOfSpeech && (
                <span className="inline-block mt-3 px-3 py-1 bg-slate-100 text-slate-500 text-sm rounded-full">
                  {card.partOfSpeech}
                </span>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
              <RotateCw className="w-4 h-4" />
              <span>탭해서 뜻 보기</span>
            </div>
          </div>

          <div
            className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-xl p-8 flex flex-col text-white"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div className="text-center mb-6">
              <p className="text-white/80 text-sm mb-2">뜻</p>
              <h3 className="text-3xl font-bold">{meaning}</h3>
            </div>

            {displaySentence && (
              <div className="bg-white/10 rounded-2xl p-4 mb-4">
                <p className="text-xs text-white/70 uppercase tracking-wide mb-1.5">
                  원서 예문
                </p>
                <p className="text-sm italic">
                  &ldquo;{highlightWord(displaySentence, card.word)}&rdquo;
                </p>
                {card.exampleSentenceKorean && (
                  <p className="text-sm text-white/80 mt-2">
                    {card.exampleSentenceKorean}
                  </p>
                )}
              </div>
            )}

            <div className="mt-auto flex items-center justify-center gap-2 text-sm text-white/80">
              <RotateCw className="w-4 h-4" />
              <span>다시 탭하면 앞면</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => handleResult(false)}
          className="flex-1 py-3.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-colors active:scale-95"
        >
          <ThumbsDown className="w-5 h-5" />
          모르겠어요
        </button>
        <button
          onClick={() => handleResult(true)}
          className="flex-[2] py-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-colors active:scale-95"
        >
          <ThumbsUp className="w-5 h-5" />
          알아요!
        </button>
      </div>
    </div>
  );
}
