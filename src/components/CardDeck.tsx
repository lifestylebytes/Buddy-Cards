"use client";

import { useState } from "react";
import {
  Search,
  Trash2,
  Star,
  BookOpen,
  CheckCircle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { VocabCard } from "@/types/vocab";

interface Props {
  cards: VocabCard[];
  onDelete: (id: string) => void;
}

function CardItem({ card, onDelete }: { card: VocabCard; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const accuracy =
    card.reviewCount > 0
      ? Math.round((card.correctCount / card.reviewCount) * 100)
      : null;

  const statusConfig = {
    new: { color: "bg-blue-100 text-blue-600", label: "NEW", icon: Sparkles },
    learning: { color: "bg-amber-100 text-amber-600", label: "학습중", icon: Clock },
    mastered: { color: "bg-emerald-100 text-emerald-600", label: "완료", icon: CheckCircle },
  };
  const s = statusConfig[card.status];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:border-slate-200 transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800 text-lg">{card.word}</span>
              {card.pronunciation && (
                <span className="text-sm text-slate-400">{card.pronunciation}</span>
              )}
              {card.partOfSpeech && (
                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                  {card.partOfSpeech}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
                {s.label}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1 line-clamp-2">{card.definition}</p>
            {card.koreanDefinition && (
              <p className="text-sm text-violet-600">{card.koreanDefinition}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {accuracy !== null && (
              <span className="text-xs text-slate-400">{accuracy}%</span>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-slate-300 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-50 space-y-2">
            {card.contextSentence && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">원문</p>
                <p className="text-sm text-slate-600 italic">
                  &ldquo;{card.contextSentence}&rdquo;
                </p>
              </div>
            )}
            {card.exampleSentence && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">예문</p>
                <p className="text-sm text-slate-600">{card.exampleSentence}</p>
                {card.exampleSentenceKorean && (
                  <p className="text-sm text-slate-400">{card.exampleSentenceKorean}</p>
                )}
              </div>
            )}
            {card.reviewCount > 0 && (
              <div className="flex gap-4 text-xs text-slate-400 pt-1">
                <span>복습 {card.reviewCount}회</span>
                <span>정답 {card.correctCount}회</span>
                {card.lastReviewed && (
                  <span>
                    마지막: {new Date(card.lastReviewed).toLocaleDateString("ko-KR")}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CardDeck({ cards, onDelete }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "learning" | "mastered">("all");

  const filtered = cards.filter((c) => {
    const matchSearch =
      !search ||
      c.word.toLowerCase().includes(search.toLowerCase()) ||
      c.definition.toLowerCase().includes(search.toLowerCase()) ||
      c.koreanDefinition?.includes(search);
    const matchFilter = filter === "all" || c.status === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    all: cards.length,
    new: cards.filter((c) => c.status === "new").length,
    learning: cards.filter((c) => c.status === "learning").length,
    mastered: cards.filter((c) => c.status === "mastered").length,
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{counts.new}</div>
          <div className="text-xs text-blue-400 mt-0.5">새 단어</div>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{counts.learning}</div>
          <div className="text-xs text-amber-400 mt-0.5">학습중</div>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{counts.mastered}</div>
          <div className="text-xs text-emerald-400 mt-0.5">완료</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="단어 검색..."
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "new", "learning", "mastered"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === f
                ? "bg-violet-500 text-white shadow-sm"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {f === "all" ? "전체" : f === "new" ? "새 단어" : f === "learning" ? "학습중" : "완료"}
            <span className="ml-1 opacity-70">
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Cards list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400">
            {cards.length === 0 ? "아직 저장된 단어가 없어요" : "검색 결과가 없어요"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((card) => (
            <CardItem key={card.id} card={card} onDelete={() => onDelete(card.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
