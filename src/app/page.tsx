"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Camera,
  BookOpen,
  Brain,
  LayoutGrid,
  Plus,
  ArrowLeft,
  Layers,
} from "lucide-react";
import ImageUploader from "@/components/ImageUploader";
import ExtractedWordsList from "@/components/ExtractedWordsList";
import Flashcard from "@/components/Flashcard";
import QuizMode, { QuizResult } from "@/components/QuizMode";
import CardDeck from "@/components/CardDeck";
import { VocabCard, ExtractedWord } from "@/types/vocab";
import { loadDeck, addCards, updateCard, deleteCard } from "@/lib/storage";

type Tab = "scan" | "flashcard" | "quiz" | "deck";
type ScanStep = "upload" | "extracted";
type QuizState = "playing" | "result";

export default function Home() {
  const [tab, setTab] = useState<Tab>("scan");
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [scanStep, setScanStep] = useState<ScanStep>("upload");
  const [extractedWords, setExtractedWords] = useState<ExtractedWord[]>([]);
  const [imageBase64, setImageBase64] = useState("");
  const [flashcardIdx, setFlashcardIdx] = useState(0);
  const [quizState, setQuizState] = useState<QuizState>("playing");
  const [quizScore, setQuizScore] = useState({ score: 0, total: 0 });
  const [quizKey, setQuizKey] = useState(0);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    const deck = loadDeck();
    setCards(deck.cards);
  }, []);

  const handleExtracted = useCallback(
    (words: ExtractedWord[], img: string) => {
      setExtractedWords(words);
      setImageBase64(img);
      setScanStep("extracted");
    },
    []
  );

  const handleSave = useCallback((newCards: VocabCard[]) => {
    const deck = addCards(newCards);
    setCards(deck.cards);
    setSavedCount(newCards.length);
    setTimeout(() => {
      setSavedCount(null);
      setScanStep("upload");
      setExtractedWords([]);
      setTab("deck");
    }, 1800);
  }, []);

  const handleCardUpdate = useCallback((updated: VocabCard) => {
    const deck = updateCard(updated);
    setCards(deck.cards);
  }, []);

  const handleDelete = useCallback((id: string) => {
    const deck = deleteCard(id);
    setCards(deck.cards);
  }, []);

  const reviewCards = cards.filter((c) => c.status !== "mastered");
  const flashcardDeck =
    reviewCards.length > 0 ? reviewCards : cards;

  const tabs = [
    { id: "scan" as Tab, icon: Camera, label: "스캔" },
    { id: "flashcard" as Tab, icon: Layers, label: "카드" },
    { id: "quiz" as Tab, icon: Brain, label: "퀴즈" },
    { id: "deck" as Tab, icon: LayoutGrid, label: "단어장" },
  ];

  return (
    <div className="min-h-dvh flex flex-col max-w-2xl mx-auto">
      {/* Header */}
      <header className="px-5 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-200">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-lg leading-none">
                Buddy Cards
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">원서 어휘 카드</p>
            </div>
          </div>
          <div className="bg-violet-100 text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            {cards.length}개 단어
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-5 pb-28 overflow-y-auto">
        {/* ---- SCAN TAB ---- */}
        {tab === "scan" && (
          <div className="fade-in space-y-6">
            {savedCount !== null ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-xl font-bold text-slate-800">저장 완료!</h2>
                <p className="text-slate-400 mt-1">{savedCount}개 단어가 단어장에 추가됐어요</p>
              </div>
            ) : scanStep === "upload" ? (
              <>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 mb-1">
                    원서 사진 스캔
                  </h2>
                  <p className="text-sm text-slate-400">
                    밑줄 친 부분을 AI가 자동으로 인식해요
                  </p>
                </div>
                <ImageUploader onExtracted={handleExtracted} />
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {["📸 사진 찍기", "🖼️ 갤러리에서", "✏️ 밑줄 인식"].map(
                    (item) => (
                      <div
                        key={item}
                        className="bg-white rounded-2xl p-3 text-center text-sm text-slate-500 border border-slate-100"
                      >
                        {item}
                      </div>
                    )
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setScanStep("upload")}
                    className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-500" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-0.5">
                      어휘 추출 결과
                    </h2>
                    <p className="text-sm text-slate-400">
                      저장할 단어를 선택하세요
                    </p>
                  </div>
                </div>
                <ExtractedWordsList
                  words={extractedWords}
                  imageBase64={imageBase64}
                  onSave={handleSave}
                />
              </>
            )}
          </div>
        )}

        {/* ---- FLASHCARD TAB ---- */}
        {tab === "flashcard" && (
          <div className="fade-in">
            {flashcardDeck.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <div className="text-5xl">📚</div>
                <p className="text-slate-500 font-medium">단어가 없어요</p>
                <button
                  onClick={() => setTab("scan")}
                  className="px-5 py-2.5 bg-violet-500 text-white rounded-full text-sm font-medium flex items-center gap-1.5 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  원서 스캔하기
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-800 mb-1">
                    플래시카드 복습
                  </h2>
                  <p className="text-sm text-slate-400">
                    {reviewCards.length > 0
                      ? `${reviewCards.length}개 복습 필요`
                      : "모든 단어를 마스터했어요!"}
                  </p>
                </div>
                <Flashcard
                  key={`${flashcardIdx}-${flashcardDeck[flashcardIdx % flashcardDeck.length]?.id}`}
                  card={flashcardDeck[flashcardIdx % flashcardDeck.length]}
                  current={flashcardIdx + 1}
                  total={flashcardDeck.length}
                  onResult={(correct) => {
                    const card = flashcardDeck[flashcardIdx % flashcardDeck.length];
                    const updated: VocabCard = {
                      ...card,
                      reviewCount: card.reviewCount + 1,
                      correctCount: card.correctCount + (correct ? 1 : 0),
                      lastReviewed: new Date().toISOString(),
                      status:
                        card.correctCount + (correct ? 1 : 0) >= 3
                          ? "mastered"
                          : "learning",
                    };
                    handleCardUpdate(updated);
                    if (flashcardIdx + 1 >= flashcardDeck.length) {
                      setFlashcardIdx(0);
                    } else {
                      setFlashcardIdx((i) => i + 1);
                    }
                  }}
                />
              </>
            )}
          </div>
        )}

        {/* ---- QUIZ TAB ---- */}
        {tab === "quiz" && (
          <div className="fade-in">
            {cards.length < 2 ? (
              <div className="text-center py-20 space-y-4">
                <div className="text-5xl">🧠</div>
                <p className="text-slate-500 font-medium">
                  퀴즈는 최소 2개 단어가 필요해요
                </p>
                <button
                  onClick={() => setTab("scan")}
                  className="px-5 py-2.5 bg-violet-500 text-white rounded-full text-sm font-medium flex items-center gap-1.5 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  원서 스캔하기
                </button>
              </div>
            ) : quizState === "result" ? (
              <QuizResult
                score={quizScore.score}
                total={quizScore.total}
                onRetry={() => {
                  setQuizState("playing");
                  setQuizKey((k) => k + 1);
                }}
                onBack={() => setTab("deck")}
              />
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-800 mb-1">
                    단어 퀴즈
                  </h2>
                  <p className="text-sm text-slate-400">뜻을 고르세요</p>
                </div>
                <QuizMode
                  key={quizKey}
                  cards={cards}
                  onCardUpdate={handleCardUpdate}
                  onComplete={(score, total) => {
                    setQuizScore({ score, total });
                    setQuizState("result");
                  }}
                />
              </>
            )}
          </div>
        )}

        {/* ---- DECK TAB ---- */}
        {tab === "deck" && (
          <div className="fade-in">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-1">
                  내 단어장
                </h2>
                <p className="text-sm text-slate-400">총 {cards.length}개</p>
              </div>
              <button
                onClick={() => setTab("scan")}
                className="px-4 py-2 bg-violet-500 text-white rounded-full text-sm font-medium flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>
            <CardDeck cards={cards} onDelete={handleDelete} />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white/80 backdrop-blur-xl border-t border-slate-100 px-4 pb-safe">
        <div className="flex">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                if (id === "quiz") {
                  setQuizState("playing");
                  setQuizKey((k) => k + 1);
                }
              }}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all ${
                tab === id ? "text-violet-600" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <div
                className={`p-2 rounded-xl transition-all ${
                  tab === id ? "bg-violet-100" : ""
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
