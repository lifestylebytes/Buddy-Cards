"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, Trophy, RotateCcw } from "lucide-react";
import { VocabCard, QuizQuestion } from "@/types/vocab";

function generateQuestions(cards: VocabCard[]): QuizQuestion[] {
  if (cards.length < 2) return [];

  return cards.map((card) => {
    const others = cards.filter((c) => c.id !== card.id);
    const wrongOptions = others
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((c) => c.definition);

    const correctIndex = Math.floor(Math.random() * 4);
    const options = [...wrongOptions];
    options.splice(correctIndex, 0, card.definition);

    return {
      card,
      type: "definition",
      options,
      correctIndex,
    };
  });
}

interface Props {
  cards: VocabCard[];
  onComplete: (score: number, total: number) => void;
  onCardUpdate: (card: VocabCard) => void;
}

export default function QuizMode({ cards, onComplete, onCardUpdate }: Props) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    const q = generateQuestions(cards).sort(() => Math.random() - 0.5);
    setQuestions(q);
  }, [cards]);

  const handleSelect = useCallback(
    (idx: number) => {
      if (answered) return;
      setSelected(idx);
      setAnswered(true);

      const q = questions[current];
      const correct = idx === q.correctIndex;
      if (correct) setScore((s) => s + 1);

      // update card stats
      const updated: VocabCard = {
        ...q.card,
        reviewCount: q.card.reviewCount + 1,
        correctCount: q.card.correctCount + (correct ? 1 : 0),
        lastReviewed: new Date().toISOString(),
        status:
          q.card.correctCount + (correct ? 1 : 0) >= 3
            ? "mastered"
            : "learning",
      };
      onCardUpdate(updated);
    },
    [answered, current, questions, onCardUpdate]
  );

  const handleNext = () => {
    if (current + 1 >= questions.length) {
      onComplete(score + (selected === questions[current].correctIndex ? 0 : 0), questions.length);
      // Note: score is already updated in handleSelect
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
      setAnswered(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        퀴즈를 위한 단어가 부족해요 (최소 2개 필요)
      </div>
    );
  }

  const q = questions[current];
  const progress = ((current + 1) / questions.length) * 100;

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Progress */}
      <div>
        <div className="flex justify-between text-sm text-slate-400 mb-1.5">
          <span>문제 {current + 1} / {questions.length}</span>
          <span>점수: {score}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-lg p-8 text-center">
        <p className="text-sm text-slate-400 mb-4">다음 단어의 뜻은?</p>
        <h2 className="text-4xl font-bold text-slate-800 mb-2">{q.card.word}</h2>
        {q.card.pronunciation && (
          <p className="text-slate-400">{q.card.pronunciation}</p>
        )}
      </div>

      {/* Options */}
      <div className="space-y-2.5">
        {q.options.map((option, idx) => {
          let style = "bg-white border-slate-100 text-slate-700 hover:border-amber-300 hover:bg-amber-50";
          if (answered) {
            if (idx === q.correctIndex) {
              style = "bg-emerald-50 border-emerald-300 text-emerald-700";
            } else if (idx === selected && idx !== q.correctIndex) {
              style = "bg-red-50 border-red-300 text-red-700";
            } else {
              style = "bg-white border-slate-100 text-slate-400 opacity-60";
            }
          } else if (selected === idx) {
            style = "bg-amber-50 border-amber-300 text-amber-700";
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={answered}
              className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3 ${style}`}
            >
              <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="text-sm leading-relaxed">{option}</span>
              {answered && idx === q.correctIndex && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-auto flex-shrink-0" />
              )}
              {answered && idx === selected && idx !== q.correctIndex && (
                <XCircle className="w-5 h-5 text-red-400 ml-auto flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {answered && (
        <button
          onClick={handleNext}
          className="w-full py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-2xl font-semibold hover:from-amber-500 hover:to-orange-600 transition-all shadow-lg shadow-orange-100 active:scale-95"
        >
          {current + 1 >= questions.length ? "결과 보기" : "다음 문제"}
        </button>
      )}
    </div>
  );
}

interface ResultProps {
  score: number;
  total: number;
  onRetry: () => void;
  onBack: () => void;
}

export function QuizResult({ score, total, onRetry, onBack }: ResultProps) {
  const pct = Math.round((score / total) * 100);
  const emoji =
    pct >= 90 ? "🏆" : pct >= 70 ? "🎉" : pct >= 50 ? "💪" : "📚";
  const msg =
    pct >= 90
      ? "완벽해요!"
      : pct >= 70
        ? "잘 했어요!"
        : pct >= 50
          ? "조금 더 연습해봐요"
          : "다시 복습해봐요";

  return (
    <div className="w-full max-w-lg mx-auto text-center space-y-6">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-10">
        <div className="text-6xl mb-4">{emoji}</div>
        <h2 className="text-2xl font-bold text-slate-800 mb-1">{msg}</h2>
        <p className="text-slate-400 mb-8">
          {total}문제 중 {score}개 정답
        </p>

        <div className="relative w-32 h-32 mx-auto mb-8">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="url(#grad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${pct * 2.64} 264`}
            />
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-slate-800">{pct}%</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onRetry}
            className="flex-1 py-3.5 border-2 border-slate-200 text-slate-600 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            다시 풀기
          </button>
          <button
            onClick={onBack}
            className="flex-1 py-3.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 hover:from-violet-600 hover:to-purple-700 transition-all"
          >
            <Trophy className="w-4 h-4" />
            단어장으로
          </button>
        </div>
      </div>
    </div>
  );
}
