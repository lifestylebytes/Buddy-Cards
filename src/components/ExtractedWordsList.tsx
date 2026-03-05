"use client";

import { useState } from "react";
import { Check, BookMarked, ChevronDown, ChevronUp, Volume2 } from "lucide-react";
import { ExtractedWord, VocabCard } from "@/types/vocab";

interface Props {
  words: ExtractedWord[];
  imageBase64: string;
  onSave: (cards: VocabCard[]) => void;
}

function WordItem({
  word,
  selected,
  onToggle,
}: {
  word: ExtractedWord;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSameSentence =
    !!word.contextSentence &&
    !!word.exampleSentence &&
    word.contextSentence.trim() === word.exampleSentence.trim();

  const speak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(word.word);
    utterance.lang = "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        selected
          ? "border-violet-300 bg-violet-50"
          : "border-slate-100 bg-white hover:border-slate-200"
      }`}
    >
      <div className="p-4 flex items-start gap-3">
        <button
          onClick={onToggle}
          className={`mt-0.5 w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all ${
            selected
              ? "bg-violet-500 border-violet-500"
              : "border-slate-200 hover:border-violet-300"
          }`}
        >
          {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-bold text-slate-800 text-lg">{word.word}</span>
              {typeof word.sourcePage === "number" && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-semibold">
                  p.{word.sourcePage}
                </span>
              )}
              {word.pronunciation && (
                <span className="ml-2 text-sm text-slate-400">{word.pronunciation}</span>
              )}
              {word.partOfSpeech && (
                <span className="ml-2 text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                  {word.partOfSpeech}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={speak}
                className="text-slate-400 hover:text-slate-600 mt-1 p-1"
                aria-label="발음 듣기"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-slate-400 hover:text-slate-600 mt-1 p-1"
                aria-label={expanded ? "접기" : "펼치기"}
              >
                {expanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-600 mt-1">{word.definition}</p>
          {word.koreanDefinition && (
            <p className="text-sm text-violet-600 font-medium">{word.koreanDefinition}</p>
          )}

          {expanded && (
            <div className="mt-3 space-y-2 pt-3 border-t border-slate-100">
              {word.contextSentence && (
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">
                    원서 예문
                  </p>
                  <p className="text-sm text-slate-600 italic">
                    &ldquo;{word.contextSentence}&rdquo;
                  </p>
                </div>
              )}
              {word.exampleSentence && !hasSameSentence && (
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">
                    예문
                  </p>
                  <p className="text-sm text-slate-600">{word.exampleSentence}</p>
                  {word.exampleSentenceKorean && (
                    <p className="text-sm text-slate-400 mt-0.5">
                      {word.exampleSentenceKorean}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExtractedWordsList({ words, imageBase64, onSave }: Props) {
  const [selected, setSelected] = useState<Set<number>>(
    new Set(words.map((_, i) => i))
  );

  const toggleAll = () => {
    if (selected.size === words.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(words.map((_, i) => i)));
    }
  };

  const handleSave = () => {
    const cards: VocabCard[] = Array.from(selected).map((idx) => {
      const w = words[idx];
      return {
        id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2)}`,
        word: w.word,
        isFavorite: false,
        sourcePage: w.sourcePage,
        pronunciation: w.pronunciation,
        partOfSpeech: w.partOfSpeech,
        definition: w.definition,
        koreanDefinition: w.koreanDefinition,
        exampleSentence: w.exampleSentence,
        exampleSentenceKorean: w.exampleSentenceKorean,
        contextSentence: w.contextSentence,
        imageSource: imageBase64.slice(0, 200), // small ref
        tags: [],
        difficulty: "medium",
        reviewCount: 0,
        correctCount: 0,
        createdAt: new Date().toISOString(),
        status: "new",
      };
    });
    onSave(cards);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            발견된 어휘 {words.length}개
          </h2>
          <p className="text-sm text-slate-400">저장할 단어를 선택해주세요</p>
        </div>
        <button
          onClick={toggleAll}
          className="text-sm text-violet-600 font-medium hover:text-violet-700"
        >
          {selected.size === words.length ? "전체 해제" : "전체 선택"}
        </button>
      </div>

      <div className="space-y-2">
        {words.map((word, idx) => (
          <WordItem
            key={idx}
            word={word}
            selected={selected.has(idx)}
            onToggle={() => {
              const next = new Set(selected);
              if (next.has(idx)) next.delete(idx);
              else next.add(idx);
              setSelected(next);
            }}
          />
        ))}
      </div>

      {selected.size > 0 && (
        <button
          onClick={handleSave}
          className="w-full py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-2xl font-semibold text-base flex items-center justify-center gap-2 hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-200 active:scale-95"
        >
          <BookMarked className="w-5 h-5" />
          단어장에 {selected.size}개 저장하기
        </button>
      )}
    </div>
  );
}
