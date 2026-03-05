"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  BookOpen,
  CheckCircle,
  Clock,
  Sparkles,
  Star,
  Volume2,
  SlidersHorizontal,
  ExternalLink,
  Wand2,
  Loader2,
} from "lucide-react";
import { VocabCard } from "@/types/vocab";
import { speakEnglish } from "@/lib/tts";

interface Props {
  cards: VocabCard[];
  onDelete: (id: string) => void;
  onToggleFavorite: (card: VocabCard) => void;
  onUpdateCard: (card: VocabCard) => void;
}

type SortOption = "newest" | "oldest" | "az" | "za" | "page" | "random";
type DisplayMode = 0 | 1 | 2;
type StatusInfo = "new" | "learning" | "mastered" | null;

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "newest", label: "최근 추가순" },
  { value: "oldest", label: "오래된 순" },
  { value: "page", label: "페이지 순" },
  { value: "random", label: "랜덤 순" },
  { value: "az", label: "A-Z" },
  { value: "za", label: "Z-A" },
];

const PART_OF_SPEECH_OPTIONS = [
  "",
  "noun",
  "verb",
  "adjective",
  "adverb",
  "phrasal verb",
  "pronoun",
  "preposition",
  "conjunction",
  "interjection",
  "article",
  "determiner",
] as const;

function sortCards(cards: VocabCard[], sortBy: SortOption) {
  const next = [...cards];

  if (sortBy === "random") {
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }

    return next;
  }

  next.sort((a, b) => {
    if (sortBy === "az") return a.word.localeCompare(b.word);
    if (sortBy === "za") return b.word.localeCompare(a.word);
    if (sortBy === "page") {
      const pageA = typeof a.sourcePage === "number" ? a.sourcePage : Number.MAX_SAFE_INTEGER;
      const pageB = typeof b.sourcePage === "number" ? b.sourcePage : Number.MAX_SAFE_INTEGER;

      if (pageA !== pageB) return pageA - pageB;

      return a.word.localeCompare(b.word);
    }
    if (sortBy === "oldest") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return next;
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
      <span key={`${part}-${index}`} className="font-semibold text-violet-600">
        {part}
      </span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function abbreviatePartOfSpeech(value?: string) {
  if (!value) return "";

  const normalized = value.toLowerCase();
  const map: Record<string, string> = {
    adjective: "adj",
    adverb: "adv",
    noun: "n",
    verb: "v",
    "phrasal verb": "phr v",
    pronoun: "pron",
    preposition: "prep",
    conjunction: "conj",
    interjection: "intj",
    article: "art",
    determiner: "det",
  };

  return map[normalized] || value;
}

function getSearchScore(card: VocabCard, rawSearch: string) {
  const search = rawSearch.trim().toLowerCase();
  if (!search) return 0;

  const word = card.word.toLowerCase();
  const korean = (card.koreanDefinition || "").toLowerCase();
  const definition = card.definition.toLowerCase();
  const tags = card.tags.join(" ").toLowerCase();

  if (word === search) return 400;
  if (word.startsWith(search)) return 300;
  if (word.includes(search)) return 200;
  if (korean.startsWith(search)) return 120;
  if (korean.includes(search)) return 100;
  if (tags.includes(search)) return 80;
  if (definition.includes(search)) return 40;
  return -1;
}

function renderPortal(content: ReactNode) {
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

function CardItem({
  card,
  onToggleFavorite,
  onRequestEdit,
}: {
  card: VocabCard;
  onToggleFavorite: () => void;
  onRequestEdit: (card: VocabCard) => void;
}) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>(1);
  const holdTimerRef = useRef<number | null>(null);
  const skipNextTapRef = useRef(false);
  const meaning = card.koreanDefinition || card.definition;
  const displaySentence = card.contextSentence || card.exampleSentence;

  const openNaverImageSearch = () => {
    if (typeof window === "undefined") return;

    const url = `https://en.dict.naver.com/#/search?query=${encodeURIComponent(card.word)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const clearHold = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const openEditor = () => {
    skipNextTapRef.current = true;
    onRequestEdit(card);
  };

  const handlePressStart = () => {
    if (typeof window === "undefined") return;

    clearHold();
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      openEditor();
    }, 450);
  };

  const handleCardTap = () => {
    if (skipNextTapRef.current) {
      skipNextTapRef.current = false;
      return;
    }

    setDisplayMode((mode) => ((mode + 1) % 3) as DisplayMode);
  };

  const statusConfig = {
    new: { color: "bg-blue-100 text-blue-600", label: "NEW", icon: Sparkles },
    learning: { color: "bg-amber-100 text-amber-600", label: "학습중", icon: Clock },
    mastered: { color: "bg-emerald-100 text-emerald-600", label: "완료", icon: CheckCircle },
  };
  const s = statusConfig[card.status];

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:border-slate-200 transition-colors cursor-pointer"
      onClick={handleCardTap}
      onPointerDown={handlePressStart}
      onPointerUp={clearHold}
      onPointerLeave={clearHold}
      onPointerCancel={clearHold}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800 text-lg">{card.word}</span>
              {card.partOfSpeech && (
                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                  {abbreviatePartOfSpeech(card.partOfSpeech)}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
                {s.label}
              </span>
            </div>

            {(displayMode === 0 || displayMode === 2) && (
              <div className="mt-1.5">
                <p className="text-sm text-slate-700 line-clamp-2">{meaning}</p>
                {card.koreanDefinition && (
                  <p className="text-sm text-slate-400 line-clamp-2">{card.definition}</p>
                )}
              </div>
            )}

            {displayMode === 1 && (
              <p className="mt-2 text-xs text-slate-400">클릭해서 뜻 보기</p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onToggleFavorite();
              }}
              className={`p-1.5 transition-colors ${
                card.isFavorite
                  ? "text-amber-400 hover:text-amber-500"
                  : "text-slate-300 hover:text-amber-400"
              }`}
            >
              <Star
                className="w-4 h-4"
                fill={card.isFavorite ? "currentColor" : "none"}
              />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                speakEnglish(card.word);
              }}
              className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                openNaverImageSearch();
              }}
              className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors"
              aria-label="네이버 영어사전 검색"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {displayMode === 0 && (
          <div className="mt-3 rounded-2xl bg-slate-50 px-3.5 py-3 border border-slate-100">
            <p className="text-[11px] font-semibold tracking-wide text-slate-400 mb-1">
              원문 문장
            </p>
            <p className="text-sm text-slate-700 italic leading-relaxed">
              {displaySentence
                ? (
                  <>
                    “{highlightWord(displaySentence, card.word)}”
                  </>
                )
                : "저장된 원문 문장이 없어요"}
            </p>
            {card.exampleSentenceKorean && (
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                {card.exampleSentenceKorean}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-4 text-xs text-slate-400 pt-3 mt-3 border-t border-slate-50">
          <span>복습 {card.reviewCount}회</span>
          <span>정답 {card.correctCount}회</span>
          <span>
            마지막:{" "}
            {card.lastReviewed
              ? new Date(card.lastReviewed).toLocaleDateString("ko-KR")
              : "아직 없음"}
          </span>
          {typeof card.sourcePage === "number" && (
            <span className="ml-auto text-violet-600 font-semibold">
              p.{card.sourcePage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CardDeck({
  cards,
  onDelete,
  onToggleFavorite,
  onUpdateCard,
}: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "learning" | "mastered">("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [editingCard, setEditingCard] = useState<VocabCard | null>(null);
  const [statusInfo, setStatusInfo] = useState<StatusInfo>(null);
  const [editWord, setEditWord] = useState("");
  const [editKorean, setEditKorean] = useState("");
  const [editDefinition, setEditDefinition] = useState("");
  const [editPartOfSpeech, setEditPartOfSpeech] = useState("");
  const [editStatus, setEditStatus] = useState<VocabCard["status"]>("new");
  const [editSentence, setEditSentence] = useState("");
  const [editSentenceKorean, setEditSentenceKorean] = useState("");
  const [editPage, setEditPage] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  const baseFiltered = cards.filter((c) => {
    const matchFilter = filter === "all" || c.status === filter;
    if (!matchFilter) return false;
    return !search.trim() || getSearchScore(c, search) >= 0;
  });

  const filtered = search.trim()
    ? [...baseFiltered].sort((a, b) => {
        const scoreDiff = getSearchScore(b, search) - getSearchScore(a, search);
        if (scoreDiff !== 0) return scoreDiff;
        return a.word.localeCompare(b.word);
      })
    : sortCards(baseFiltered, sortBy);

  useEffect(() => {
    if (!editingCard) return;

    setEditWord(editingCard.word);
    setEditKorean(editingCard.koreanDefinition || "");
    setEditDefinition(editingCard.definition);
    setEditPartOfSpeech(editingCard.partOfSpeech || "");
    setEditStatus(editingCard.status);
    setEditSentence(editingCard.contextSentence || editingCard.exampleSentence || "");
    setEditSentenceKorean(editingCard.exampleSentenceKorean || "");
    setEditPage(
      typeof editingCard.sourcePage === "number" ? String(editingCard.sourcePage) : ""
    );
  }, [editingCard]);

  const submitEdit = () => {
    if (!editingCard) return;

    const parsedPage = Number.parseInt(editPage.trim(), 10);
    onUpdateCard({
      ...editingCard,
      word: editWord.trim() || editingCard.word,
      koreanDefinition: editKorean.trim() || undefined,
      definition: editDefinition.trim() || editingCard.definition,
      status: editStatus,
      partOfSpeech: editPartOfSpeech.trim() || undefined,
      tags: editingCard.tags,
      contextSentence: editSentence.trim() || undefined,
      exampleSentence: editSentence.trim() || undefined,
      exampleSentenceKorean: editSentenceKorean.trim() || undefined,
      sourcePage:
        Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : undefined,
    });
    setEditingCard(null);
  };

  const translateSentence = async () => {
    if (!editSentence.trim() || isTranslating) return;

    setIsTranslating(true);

    try {
      const res = await fetch("/api/translate-sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence: editSentence.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "번역에 실패했어요.");
      }

      setEditSentenceKorean(data?.translation || "");
    } catch (error) {
      if (typeof window !== "undefined") {
        const message =
          error instanceof Error ? error.message : "번역에 실패했어요.";
        window.alert(message);
      }
    } finally {
      setIsTranslating(false);
    }
  };

  const counts = {
    all: cards.length,
    new: cards.filter((c) => c.status === "new").length,
    learning: cards.filter((c) => c.status === "learning").length,
    mastered: cards.filter((c) => c.status === "mastered").length,
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setStatusInfo("new")}
          className="bg-blue-50 rounded-2xl p-4 text-center"
        >
          <div className="text-2xl font-bold text-blue-600">{counts.new}</div>
          <div className="text-xs text-blue-400 mt-0.5">새 단어</div>
        </button>
        <button
          type="button"
          onClick={() => setStatusInfo("learning")}
          className="bg-amber-50 rounded-2xl p-4 text-center"
        >
          <div className="text-2xl font-bold text-amber-600">{counts.learning}</div>
          <div className="text-xs text-amber-400 mt-0.5">학습중</div>
        </button>
        <button
          type="button"
          onClick={() => setStatusInfo("mastered")}
          className="bg-emerald-50 rounded-2xl p-4 text-center"
        >
          <div className="text-2xl font-bold text-emerald-600">{counts.mastered}</div>
          <div className="text-xs text-emerald-400 mt-0.5">완료</div>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="단어 검색..."
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
          {(["all", "new", "learning", "mastered"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                filter === f
                  ? "bg-violet-500 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {f === "all" ? "전체" : f === "new" ? "새 단어" : f === "learning" ? "학습중" : "완료"}
              <span className="ml-1 opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setShowSortMenu((value) => !value)}
            className="flex items-center gap-1 px-3 py-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-600"
          >
            <SlidersHorizontal className="w-4 h-4" />
            정렬
          </button>

          {showSortMenu && (
            <div className="absolute right-0 top-12 z-10 w-40 rounded-2xl border border-slate-100 bg-white shadow-xl p-2">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSortBy(option.value);
                    setShowSortMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm ${
                    sortBy === option.value
                      ? "bg-violet-50 text-violet-700 font-medium"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

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
            <CardItem
              key={card.id}
              card={card}
              onToggleFavorite={() => onToggleFavorite(card)}
              onRequestEdit={setEditingCard}
            />
          ))}
        </div>
      )}

      {statusInfo &&
        renderPortal(
          <div className="fixed inset-0 z-[90] bg-slate-950/30 p-4 flex items-center justify-center">
            <div className="w-[min(24rem,100%)] rounded-3xl bg-white border border-slate-100 shadow-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-800">
                    {statusInfo === "new"
                      ? "새 단어"
                      : statusInfo === "learning"
                        ? "학습중"
                        : "완료"}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                    {statusInfo === "new"
                      ? "아직 맞힌 기록이 없는 단어예요. 저장하면 기본으로 여기 들어옵니다."
                      : statusInfo === "learning"
                        ? "카드나 퀴즈에서 1번 이상 맞혔지만, 누적 정답이 3회 미만인 단어예요."
                        : "카드와 퀴즈를 합쳐 누적 정답이 3회 이상이면 완료로 넘어갑니다."}
                  </p>
                </div>
                <button
                  onClick={() => setStatusInfo(null)}
                  className="px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium text-slate-500"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

      {editingCard &&
        renderPortal(
          <div className="fixed inset-0 z-[100] bg-slate-950/40 p-4 flex items-center justify-center">
            <div className="w-[min(32rem,100%)] rounded-3xl bg-white border border-slate-100 shadow-2xl p-4 max-h-[78vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    const confirmed = window.confirm(
                      `${editingCard.word} 단어를 삭제할까요?`
                    );
                    if (!confirmed) return;
                  }

                  onDelete(editingCard.id);
                  setEditingCard(null);
                }}
                className="px-3 py-1.5 rounded-full bg-red-50 text-xs font-medium text-red-500"
              >
                단어 삭제
              </button>
              <div className="text-center">
                <h3 className="text-base font-semibold text-slate-800">단어 수정</h3>
                <p className="text-xs text-slate-400">한 번에 수정할 수 있어요</p>
              </div>
              <button
                onClick={() => setEditingCard(null)}
                className="px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium text-slate-500"
              >
                닫기
              </button>
            </div>

            <div className="space-y-3">
              <input
                value={editWord}
                onChange={(event) => setEditWord(event.target.value)}
                placeholder="영단어"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              />
              <input
                value={editKorean}
                onChange={(event) => setEditKorean(event.target.value)}
                placeholder="한국어 뜻"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              />
              <input
                value={editDefinition}
                onChange={(event) => setEditDefinition(event.target.value)}
                placeholder="영어 뜻"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={editPartOfSpeech}
                  onChange={(event) => setEditPartOfSpeech(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 bg-white"
                >
                  {PART_OF_SPEECH_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option || "품사 선택"}
                    </option>
                  ))}
                  {!PART_OF_SPEECH_OPTIONS.includes(
                    editPartOfSpeech as (typeof PART_OF_SPEECH_OPTIONS)[number]
                  ) &&
                    editPartOfSpeech && (
                      <option value={editPartOfSpeech}>{editPartOfSpeech}</option>
                    )}
                </select>
                <select
                  value={editStatus}
                  onChange={(event) =>
                    setEditStatus(event.target.value as VocabCard["status"])
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 bg-white"
                >
                  <option value="new">새 단어</option>
                  <option value="learning">학습중</option>
                  <option value="mastered">완료</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <input
                  value={editPage}
                  onChange={(event) => setEditPage(event.target.value)}
                  placeholder="페이지"
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                />
              </div>
              <textarea
                value={editSentence}
                onChange={(event) => setEditSentence(event.target.value)}
                placeholder="원문 예문"
                rows={4}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 resize-none"
              />
              <div className="relative">
                <textarea
                  value={editSentenceKorean}
                  onChange={(event) => setEditSentenceKorean(event.target.value)}
                  placeholder="예문 해석"
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12 text-sm text-slate-700 resize-none"
                />
                <button
                  type="button"
                  onClick={translateSentence}
                  disabled={!editSentence.trim() || isTranslating}
                  className="absolute right-3 top-3 text-violet-600 disabled:opacity-30"
                  aria-label="AI 예문 해석"
                >
                  {isTranslating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={submitEdit}
              className="mt-4 w-full rounded-2xl bg-slate-900 text-white py-3.5 font-semibold"
            >
              저장하기
            </button>
          </div>
          </div>
        )}
    </div>
  );
}
