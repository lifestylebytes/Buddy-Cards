"use client";

import { useState } from "react";
import {
  RotateCw,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Volume2,
} from "lucide-react";
import { VocabCard } from "@/types/vocab";

interface Props {
  card: VocabCard;
  onResult: (correct: boolean) => void;
  current: number;
  total: number;
}

export default function Flashcard({ card, onResult, current, total }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [exiting, setExiting] = useState<"correct" | "wrong" | null>(null);

  const handleResult = (correct: boolean) => {
    setExiting(correct ? "correct" : "wrong");
    setTimeout(() => {
      setExiting(null);
      setFlipped(false);
      onResult(correct);
    }, 350);
  };

  const speak = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(card.word);
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
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
      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-slate-400 mb-1.5">
          <span>{current} / {total}</span>
          <span>{Math.round((current / total) * 100)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div
        className="relative cursor-pointer"
        style={{ perspective: "1200px" }}
        onClick={() => !flipped && setFlipped(true)}
      >
        <div
          className="relative w-full transition-all duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            minHeight: "320px",
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-3xl bg-white shadow-xl border border-slate-100 flex flex-col items-center justify-center p-8 gap-4"
            style={{ backfaceVisibility: "hidden" }}
          >
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
            <div className="text-center">
              <h2 className="text-4xl font-bold text-slate-800 mb-1">{card.word}</h2>
              {card.pronunciation && (
                <p className="text-slate-400 text-lg">{card.pronunciation}</p>
              )}
              {card.partOfSpeech && (
                <span className="inline-block mt-2 px-3 py-1 bg-slate-100 text-slate-500 text-sm rounded-full">
                  {card.partOfSpeech}
                </span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                speak();
              }}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Volume2 className="w-5 h-5" />
            </button>
            <p className="text-slate-400 text-sm animate-pulse">탭하면 뜻이 보여요</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-xl flex flex-col justify-center p-8 gap-4"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div className="text-white space-y-3">
              <h3 className="text-2xl font-bold opacity-80">{card.word}</h3>
              <p className="text-white/90 text-lg leading-relaxed">{card.definition}</p>
              {card.koreanDefinition && (
                <p className="text-white/75 text-base">{card.koreanDefinition}</p>
              )}
              {card.exampleSentence && (
                <div className="mt-4 pt-4 border-t border-white/20">
                  <p className="text-white/60 text-xs mb-1 uppercase tracking-wide">예문</p>
                  <p className="text-white/90 text-sm italic">&ldquo;{card.exampleSentence}&rdquo;</p>
                  {card.exampleSentenceKorean && (
                    <p className="text-white/65 text-sm mt-1">{card.exampleSentenceKorean}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      {flipped ? (
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
            className="flex-2 py-3.5 flex-[2] bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            <ThumbsUp className="w-5 h-5" />
            알아요!
          </button>
        </div>
      ) : (
        <div className="mt-6 text-center">
          <button
            onClick={() => setFlipped(true)}
            className="py-3.5 px-8 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-medium flex items-center gap-2 mx-auto transition-colors"
          >
            <RotateCw className="w-4 h-4" />
            뒤집기
          </button>
        </div>
      )}
    </div>
  );
}
