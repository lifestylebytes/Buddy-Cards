"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Camera,
  Library,
  Brain,
  LayoutGrid,
  Plus,
  ArrowLeft,
  Layers,
  Menu,
  Shuffle,
  ChevronDown,
  FileDown,
  FileUp,
  Trash2,
  Undo2,
  Mail,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import ImageUploader from "@/components/ImageUploader";
import TextInputer from "@/components/TextInputer";
import ExtractedWordsList from "@/components/ExtractedWordsList";
import Flashcard from "@/components/Flashcard";
import QuizMode, { QuizResult } from "@/components/QuizMode";
import CardDeck from "@/components/CardDeck";
import { VocabCard, ExtractedWord } from "@/types/vocab";
import {
  loadDeck,
  saveDeck,
  addCards,
  updateCard,
  deleteCard,
  clearDeck,
  loadDeletedCards,
  restoreDeletedCards,
  loadScanDraft,
  saveScanDraft,
  clearScanDraft,
  loadDeckFromCloud,
  isCloudSyncEnabled,
  loadActiveTab,
  saveActiveTab,
  loadReadingProgress,
  saveReadingProgress,
  ReadingProgress,
  AuthSession,
  loadAuthSession,
  hydrateAuthSessionFromUrl,
  sendEmailOtp,
  verifyEmailOtp,
  hasCompletedAuthMigration,
  markAuthMigrationCompleted,
  signOut,
  clearLocalDeckData,
} from "@/lib/storage";

type Tab = "scan" | "flashcard" | "quiz" | "deck";
type ScanStep = "upload" | "extracted";
type InputMode = "image" | "text";
type QuizState = "playing" | "result";
type QuizQuestionCount = 10 | 20 | "all";
type AuthStep = "request" | "verify";

function mergeCards(primary: VocabCard[], secondary: VocabCard[]) {
  const seen = new Set<string>();
  const merged: VocabCard[] = [];

  for (const card of [...primary, ...secondary]) {
    const key = card.word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(card);
  }

  return merged;
}

function getNormalizedWords(cards: VocabCard[]) {
  return cards
    .map((card) => card.word.trim().toLowerCase())
    .filter(Boolean)
    .sort();
}

function hasSameWords(a: VocabCard[], b: VocabCard[]) {
  const aWords = getNormalizedWords(a);
  const bWords = getNormalizedWords(b);

  if (aWords.length !== bWords.length) return false;
  return aWords.every((word, idx) => word === bWords[idx]);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((currentRow) => currentRow.some((value) => value !== ""));
}

function shuffleCards(cards: VocabCard[]) {
  const next = [...cards];

  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }

  return next;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("scan");
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [scanStep, setScanStep] = useState<ScanStep>("upload");
  const [inputMode, setInputMode] = useState<InputMode>("image");
  const [extractedWords, setExtractedWords] = useState<ExtractedWord[]>([]);
  const [imageBase64, setImageBase64] = useState("");
  const [flashcardIdx, setFlashcardIdx] = useState(0);
  const [quizState, setQuizState] = useState<QuizState>("playing");
  const [quizScore, setQuizScore] = useState({ score: 0, total: 0 });
  const [quizKey, setQuizKey] = useState(0);
  const [quizQuestionCount, setQuizQuestionCount] =
    useState<QuizQuestionCount>(10);
  const [quizAutoSpeak, setQuizAutoSpeak] = useState(true);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [shuffleFlashcards, setShuffleFlashcards] = useState(false);
  const [showFlashcardMenu, setShowFlashcardMenu] = useState(false);
  const [flashcardDeck, setFlashcardDeck] = useState<VocabCard[]>([]);
  const [showCloudMenu, setShowCloudMenu] = useState(false);
  const [showAuthSheet, setShowAuthSheet] = useState(false);
  const [deletedCards, setDeletedCards] = useState<VocabCard[]>([]);
  const [showRestoreSheet, setShowRestoreSheet] = useState(false);
  const [selectedDeletedIds, setSelectedDeletedIds] = useState<string[]>([]);
  const [readingProgress, setReadingProgress] = useState<ReadingProgress>(
    loadReadingProgress()
  );
  const [authSession, setAuthSession] = useState<AuthSession | null>(
    loadAuthSession()
  );
  const [authStep, setAuthStep] = useState<AuthStep>("request");
  const [loginEmail, setLoginEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pendingAuthEmail, setPendingAuthEmail] = useState("");
  const [rememberedLoginEmail, setRememberedLoginEmail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authCooldownUntil, setAuthCooldownUntil] = useState<number | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const lastCloudUpdatedAtRef = useRef<string | null>(null);

  useEffect(() => {
    const deck = loadDeck();
    setCards(deck.cards);
    const deleted = loadDeletedCards();
    setDeletedCards(deleted);
    setSelectedDeletedIds(deleted.map((card) => card.id));
    setTab(loadActiveTab<Tab>("scan"));

    const highestSavedPage = deck.cards.reduce<number | null>((highest, card) => {
      if (typeof card.sourcePage !== "number") return highest;
      return highest === null ? card.sourcePage : Math.max(highest, card.sourcePage);
    }, null);
    const savedProgress = loadReadingProgress();

    if (
      highestSavedPage !== null &&
      (savedProgress.currentPage === null || highestSavedPage > savedProgress.currentPage)
    ) {
      const nextProgress = {
        ...savedProgress,
        currentPage: highestSavedPage,
      };
      setReadingProgress(nextProgress);
      saveReadingProgress(nextProgress);
    } else {
      setReadingProgress(savedProgress);
    }

    const draft = loadScanDraft();
    if (draft && draft.words.length > 0) {
      setExtractedWords(draft.words);
      setImageBase64(draft.imageBase64);
      setInputMode(draft.inputMode);
      setScanStep("extracted");
    }

    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem("buddy-cards-login-email");
      if (savedEmail) {
        setLoginEmail(savedEmail);
        setRememberedLoginEmail(savedEmail);
      }
    }
  }, []);

  useEffect(() => {
    void hydrateAuthSessionFromUrl().then((session) => {
      setAuthSession(session);
    });
  }, []);

  useEffect(() => {
    saveActiveTab(tab);
  }, [tab]);

  useEffect(() => {
    lastCloudUpdatedAtRef.current = null;
  }, [authSession?.user.id]);

  useEffect(() => {
    if (authSession?.user.id) return;
    clearLocalDeckData();
    setCards([]);
    setDeletedCards([]);
    setSelectedDeletedIds([]);
  }, [authSession?.user.id]);

  useEffect(() => {
    if (authCooldownUntil === null) return;

    const timer = window.setInterval(() => {
      if (Date.now() >= authCooldownUntil) {
        setAuthCooldownUntil(null);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [authCooldownUntil]);

  const syncAuthenticatedDeck = useCallback(async () => {
    if (!isCloudSyncEnabled()) return;
    if (!authSession?.user.id) return;

    const userId = authSession.user.id;
    const localDeck = loadDeck();
    const remoteDeck = await loadDeckFromCloud();
    setReadingProgress(loadReadingProgress());

    if (!remoteDeck) {
      if (localDeck.cards.length > 0) {
        saveDeck(localDeck);
        lastCloudUpdatedAtRef.current = localDeck.updatedAt;
        setCards(localDeck.cards);
      }
      if (!hasCompletedAuthMigration(userId)) {
        markAuthMigrationCompleted(userId);
      }
      return;
    }

    const localUpdatedAt = new Date(localDeck.updatedAt).getTime();
    const remoteUpdatedAt = new Date(remoteDeck.updatedAt).getTime();
    const primaryCards =
      localUpdatedAt >= remoteUpdatedAt ? localDeck.cards : remoteDeck.cards;
    const secondaryCards =
      localUpdatedAt >= remoteUpdatedAt ? remoteDeck.cards : localDeck.cards;
    const mergedCards = mergeCards(primaryCards, secondaryCards);

    const localMatchesMerged = hasSameWords(localDeck.cards, mergedCards);
    const remoteMatchesMerged = hasSameWords(remoteDeck.cards, mergedCards);
    const shouldSaveMerged = !localMatchesMerged || !remoteMatchesMerged;

    const nextDeck = {
      ...remoteDeck,
      cards: mergedCards,
      updatedAt:
        localUpdatedAt >= remoteUpdatedAt ? localDeck.updatedAt : remoteDeck.updatedAt,
    };

    setCards(mergedCards);
    lastCloudUpdatedAtRef.current = nextDeck.updatedAt;

    if (shouldSaveMerged) {
      saveDeck(nextDeck);
    }

    if (!hasCompletedAuthMigration(userId)) {
      markAuthMigrationCompleted(userId);
    }
  }, [authSession?.user.id]);

  useEffect(() => {
    void syncAuthenticatedDeck();
  }, [syncAuthenticatedDeck]);

  useEffect(() => {
    if (!authSession?.user.id) return;

    const handleWindowFocus = () => {
      void syncAuthenticatedDeck();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncAuthenticatedDeck();
      }
    };
    const interval = window.setInterval(() => {
      void syncAuthenticatedDeck();
    }, 4000);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authSession?.user.id, syncAuthenticatedDeck]);

  const handleExtracted = useCallback(
    (words: ExtractedWord[], img: string, pageNumber?: number | null) => {
      setExtractedWords(words);
      setImageBase64(img);
      saveScanDraft(words, img, img ? "image" : "text");
      setScanStep("extracted");

      if (typeof pageNumber === "number") {
        setReadingProgress((current) => {
          const next = {
            ...current,
            currentPage:
              current.currentPage === null
                ? pageNumber
                : Math.max(current.currentPage, pageNumber),
          };
          saveReadingProgress(next);
          return next;
        });
      }
    },
    []
  );

  const handleSave = useCallback((newCards: VocabCard[]) => {
    const deck = addCards(newCards);
    setCards(deck.cards);
    setSavedCount(newCards.length);
    clearScanDraft();
    setTimeout(() => {
      setSavedCount(null);
      setScanStep("upload");
      setExtractedWords([]);
      setImageBase64("");
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
    const deleted = loadDeletedCards();
    setDeletedCards(deleted);
    setSelectedDeletedIds(deleted.map((card) => card.id));
  }, []);

  const handleClearAll = useCallback(() => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("단어장을 전부 비울까요?");
      if (!confirmed) return;
    }

    const deck = clearDeck();
    setCards(deck.cards);
    const deleted = loadDeletedCards();
    setDeletedCards(deleted);
    setSelectedDeletedIds(deleted.map((card) => card.id));
    setShowCloudMenu(false);
  }, []);

  const handleOpenRestore = useCallback(() => {
    if (deletedCards.length === 0) return;
    setSelectedDeletedIds(deletedCards.map((card) => card.id));
    setShowRestoreSheet(true);
    setShowCloudMenu(false);
  }, [deletedCards]);

  const handleRestoreDeleted = useCallback(() => {
    const deck = restoreDeletedCards(selectedDeletedIds);
    setCards(deck.cards);
    const deleted = loadDeletedCards();
    setDeletedCards(deleted);
    setSelectedDeletedIds(deleted.map((card) => card.id));
    setShowRestoreSheet(false);
  }, [selectedDeletedIds]);

  const handleToggleFavorite = useCallback((card: VocabCard) => {
    const deck = updateCard({
      ...card,
      isFavorite: !card.isFavorite,
    });
    setCards(deck.cards);
  }, []);

  const handleSendOtp = useCallback(async () => {
    if (!loginEmail.trim() || authBusy) return;
    if (authCooldownUntil && Date.now() < authCooldownUntil) {
      const seconds = Math.max(
        1,
        Math.ceil((authCooldownUntil - Date.now()) / 1000)
      );
      setAuthMessage(`잠시만요. ${seconds}초 뒤에 다시 시도해 주세요.`);
      return;
    }

    setAuthBusy(true);
    setAuthMessage(null);

    try {
      const normalizedEmail = loginEmail.trim();
      await sendEmailOtp(normalizedEmail, true);
      if (typeof window !== "undefined") {
        localStorage.setItem("buddy-cards-login-email", normalizedEmail);
      }
      setRememberedLoginEmail(normalizedEmail);
      setPendingAuthEmail(normalizedEmail);
      setOtpCode("");
      setAuthStep("verify");
      setAuthCooldownUntil(Date.now() + 60_000);
      setAuthMessage("인증 코드를 이메일로 보냈어요. 6자리 코드를 입력해 주세요.");
    } catch (error) {
      setAuthMessage(
        error instanceof Error
          ? error.message
          : "인증 코드 전송에 실패했어요."
      );
    } finally {
      setAuthBusy(false);
    }
  }, [authBusy, authCooldownUntil, loginEmail]);

  const handleVerifyOtp = useCallback(async () => {
    const normalizedEmail = pendingAuthEmail || loginEmail.trim();
    const normalizedCode = otpCode.trim();

    if (!normalizedEmail || normalizedCode.length !== 6 || authBusy) return;

    setAuthBusy(true);
    setAuthMessage(null);

    try {
      const session = await verifyEmailOtp(normalizedEmail, normalizedCode);
      setAuthSession(session);
      setRememberedLoginEmail(normalizedEmail);
      setLoginEmail(normalizedEmail);
      setOtpCode("");
      setPendingAuthEmail("");
      setAuthStep("request");
      setShowAuthSheet(false);
      setAuthMessage("로그인됐어요.");
    } catch (error) {
      setAuthMessage(
        error instanceof Error ? error.message : "OTP 확인에 실패했어요."
      );
    } finally {
      setAuthBusy(false);
    }
  }, [authBusy, loginEmail, otpCode, pendingAuthEmail]);

  const handleSignOut = useCallback(async () => {
    setAuthBusy(true);
    try {
      await signOut();
      clearLocalDeckData();
      setAuthSession(null);
      setCards([]);
      setDeletedCards([]);
      setSelectedDeletedIds([]);
      setAuthMessage("로그아웃됐어요.");
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const exportCards = useCallback(() => {
    if (cards.length === 0 || typeof window === "undefined") return;

    const escapeCsv = (value?: string | number) => {
      const text = String(value ?? "").replace(/"/g, '""');
      return `"${text}"`;
    };

    const header = [
      "Word",
      "Pronunciation",
      "PartOfSpeech",
      "Definition",
      "KoreanDefinition",
      "OriginalSentence",
      "ExampleSentenceKorean",
      "Status",
      "ReviewCount",
      "CorrectCount",
      "SourcePage",
      "CreatedAt",
      "LastReviewed",
    ];

    const rows = cards.map((card) => [
      card.word,
      card.pronunciation,
      card.partOfSpeech,
      card.definition,
      card.koreanDefinition,
      card.contextSentence || card.exampleSentence,
      card.exampleSentenceKorean,
      card.status,
      card.reviewCount,
      card.correctCount,
      card.sourcePage,
      card.createdAt,
      card.lastReviewed,
    ]);

    const csv = [
      header.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `buddy-cards-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [cards]);

  const handleImportCsv = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const rows = parseCsv(text.replace(/^\uFEFF/, ""));
        if (rows.length < 2) {
          throw new Error("가져올 데이터가 없어요.");
        }

        const [header, ...dataRows] = rows;
        const indexOf = (name: string) => header.indexOf(name);
        const getValue = (row: string[], name: string) => {
          const index = indexOf(name);
          return index >= 0 ? row[index] : "";
        };

        const importedCards = dataRows
          .map<VocabCard | null>((row, index) => {
            const word = getValue(row, "Word").trim();
            if (!word) return null;

            const statusRaw = getValue(row, "Status");
            const status: VocabCard["status"] =
              statusRaw === "learning" || statusRaw === "mastered"
                ? statusRaw
                : "new";

            const reviewCount = Number.parseInt(getValue(row, "ReviewCount"), 10);
            const correctCount = Number.parseInt(getValue(row, "CorrectCount"), 10);
            const sourcePage = Number.parseInt(getValue(row, "SourcePage"), 10);

            return {
              id:
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
              word,
              isFavorite: false,
              pronunciation: getValue(row, "Pronunciation") || undefined,
              partOfSpeech: getValue(row, "PartOfSpeech") || undefined,
              definition: getValue(row, "Definition") || "",
              koreanDefinition: getValue(row, "KoreanDefinition") || undefined,
              exampleSentence: getValue(row, "OriginalSentence") || undefined,
              exampleSentenceKorean:
                getValue(row, "ExampleSentenceKorean") || undefined,
              contextSentence: getValue(row, "OriginalSentence") || undefined,
              tags: [],
              difficulty: "medium",
              reviewCount: Number.isFinite(reviewCount) ? reviewCount : 0,
              correctCount: Number.isFinite(correctCount) ? correctCount : 0,
              lastReviewed: getValue(row, "LastReviewed") || undefined,
              createdAt: getValue(row, "CreatedAt") || new Date().toISOString(),
              status,
              sourcePage:
                Number.isFinite(sourcePage) && sourcePage > 0
                  ? sourcePage
                  : undefined,
            } satisfies VocabCard;
          })
          .filter((card): card is VocabCard => card !== null);

        const deck = addCards(importedCards);
        setCards(deck.cards);

        if (typeof window !== "undefined") {
          window.alert(`${importedCards.length}개 단어를 가져왔어요.`);
        }
      } catch (error) {
        if (typeof window !== "undefined") {
          window.alert(
            error instanceof Error ? error.message : "CSV 가져오기에 실패했어요."
          );
        }
      } finally {
        if (event.target) {
          event.target.value = "";
        }
      }
    },
    []
  );

  const updateReadingTitle = useCallback(() => {
    if (typeof window === "undefined") return;

    const nextTitle = window.prompt("읽는 책 제목", readingProgress.title);
    if (nextTitle === null) return;

    const title = nextTitle.trim() || readingProgress.title;
    const next = { ...readingProgress, title };
    setReadingProgress(next);
    saveReadingProgress(next);
  }, [readingProgress]);

  const updateReadingPage = useCallback(() => {
    if (typeof window === "undefined") return;

    const nextPage = window.prompt(
      "현재 페이지 숫자",
      readingProgress.currentPage?.toString() || ""
    );
    if (nextPage === null) return;

    const parsed = Number.parseInt(nextPage, 10);
    const currentPage = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    const next = { ...readingProgress, currentPage };
    setReadingProgress(next);
    saveReadingProgress(next);
  }, [readingProgress]);

  const reviewCards = cards.filter((c) => c.status !== "mastered");
  const flashcardSource = reviewCards.length > 0 ? reviewCards : cards;
  const flashcardSignature = flashcardSource
    .map((card) => `${card.id}:${card.status}`)
    .join("|");
  const authCooldownSeconds = authCooldownUntil
    ? Math.max(0, Math.ceil((authCooldownUntil - Date.now()) / 1000))
    : 0;
  const resolvedQuizQuestionCount =
    quizQuestionCount === "all"
      ? cards.length
      : Math.min(cards.length, quizQuestionCount);
  const quizCardsSignature = cards
    .map((card) => `${card.id}:${card.reviewCount}:${card.correctCount}`)
    .join("|");
  const quizSessionId = `${quizCardsSignature}:${resolvedQuizQuestionCount}:${quizKey}`;

  useEffect(() => {
    const nextDeck = reviewCards.length > 0 ? reviewCards : cards;
    setFlashcardDeck(
      shuffleFlashcards ? shuffleCards(nextDeck) : nextDeck
    );
  }, [flashcardSignature, shuffleFlashcards]);

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
              <Library className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-lg leading-none">
                Buddy Cards
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">원서 어휘 카드</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowAuthSheet(true);
                setAuthMessage(null);
                setAuthStep("request");
                setOtpCode("");
                setPendingAuthEmail("");
              }}
              type="button"
              aria-label={authSession?.user.email ? "로그인됨" : "로그인"}
              title={authSession?.user.email ? "로그인됨" : "로그인"}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
                authSession?.user.email
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                  : "bg-white border-slate-200 text-slate-500"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowCloudMenu((value) => !value)}
                className="bg-violet-100 text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1"
              >
                저장 수 · {cards.length}개
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showCloudMenu && (
                <div className="absolute right-0 top-11 z-20 w-44 rounded-2xl border border-slate-100 bg-white shadow-xl p-2">
                <button
                  onClick={() => {
                    importInputRef.current?.click();
                    setShowCloudMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FileUp className="w-4 h-4" />
                  CSV 가져오기
                </button>
                <button
                  onClick={() => {
                    exportCards();
                    setShowCloudMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  disabled={cards.length === 0}
                >
                  <FileDown className="w-4 h-4" />
                  CSV로 내보내기
                </button>
                <button
                  onClick={handleOpenRestore}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  disabled={deletedCards.length === 0}
                >
                  <Undo2 className="w-4 h-4" />
                  휴지통
                </button>
                <button
                  onClick={handleClearAll}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 disabled:opacity-40"
                  disabled={cards.length === 0}
                >
                  <Trash2 className="w-4 h-4" />
                  전체 비우기
                </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <input
        ref={importInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportCsv}
      />

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
                    어휘 추출
                  </h2>
                  <p className="text-sm text-slate-400">
                    이미지나 텍스트로 어휘를 추출해요
                  </p>
                </div>

                {/* 이미지 / 텍스트 토글 */}
                <div className="flex bg-slate-100 rounded-2xl p-1">
                  <button
                    onClick={() => setInputMode("image")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      inputMode === "image"
                        ? "bg-white text-violet-600 shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    📷 이미지
                  </button>
                  <button
                    onClick={() => setInputMode("text")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      inputMode === "text"
                        ? "bg-white text-violet-600 shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    ✏️ 텍스트
                  </button>
                </div>

                {inputMode === "image" ? (
                  <ImageUploader onExtracted={handleExtracted} />
                ) : (
                  <TextInputer onExtracted={handleExtracted} />
                )}
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
                    <p className="text-sm text-slate-400">저장할 단어를 선택하세요</p>
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
                <div className="mb-6 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-1">
                      플래시카드 복습
                    </h2>
                    <p className="text-sm text-slate-400">
                      {reviewCards.length > 0
                        ? `${reviewCards.length}개 복습 필요`
                        : "모든 단어를 마스터했어요!"}
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setShowFlashcardMenu((value) => !value)}
                      className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
                    {showFlashcardMenu && (
                      <div className="absolute right-0 top-12 w-40 rounded-2xl border border-slate-100 bg-white shadow-xl p-2 z-10">
                        <button
                          onClick={() => {
                            setShuffleFlashcards((value) => !value);
                            setFlashcardIdx(0);
                            setShowFlashcardMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <Shuffle className="w-4 h-4" />
                          {shuffleFlashcards ? "셔플 끄기" : "셔플 켜기"}
                        </button>
                      </div>
                    )}
                  </div>
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
            ) : (
              <>
                <div className="mb-4 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setQuizQuestionCount(10);
                        setQuizState("playing");
                        setQuizKey((k) => k + 1);
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        quizQuestionCount === 10
                          ? "bg-violet-100 text-violet-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      10문제
                    </button>
                    <button
                      onClick={() => {
                        setQuizQuestionCount(20);
                        setQuizState("playing");
                        setQuizKey((k) => k + 1);
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        quizQuestionCount === 20
                          ? "bg-violet-100 text-violet-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      20문제
                    </button>
                    <button
                      onClick={() => {
                        setQuizQuestionCount("all");
                        setQuizState("playing");
                        setQuizKey((k) => k + 1);
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        quizQuestionCount === "all"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      전체
                    </button>
                  </div>
                  <button
                    onClick={() => setQuizAutoSpeak((value) => !value)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      quizAutoSpeak
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    자동음성 {quizAutoSpeak ? "켜짐" : "꺼짐"}
                  </button>
                </div>
              {quizState === "result" ? (
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
              <QuizMode
                key={quizSessionId}
                cards={cards}
                questionCount={resolvedQuizQuestionCount}
                autoSpeak={quizAutoSpeak}
                sessionId={quizSessionId}
                onCardUpdate={handleCardUpdate}
                onComplete={(score, total) => {
                  setQuizScore({ score, total });
                  setQuizState("result");
                }}
              />
            )}
              </>
            )}
          </div>
        )}

        {/* ---- DECK TAB ---- */}
        {tab === "deck" && (
          <div className="fade-in">
            <div className="mb-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-900 text-white text-sm font-semibold">
                    B
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">내 단어장</h2>
                    <p className="text-xs text-slate-400">총 {cards.length}개</p>
                  </div>
                </div>
                <button
                  onClick={() => setTab("scan")}
                  className="shrink-0 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  단어 추가
                </button>
              </div>

              <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3">
                <div className="flex items-start gap-2">
                  <button
                    onClick={updateReadingTitle}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      읽는 중
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-slate-700 break-words">
                      {"<"}
                      {readingProgress.title}
                      {">"}
                    </p>
                  </button>
                  <button
                    onClick={updateReadingPage}
                    className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500"
                  >
                    p.{readingProgress.currentPage ?? "?"}
                  </button>
                </div>

              </div>
            </div>
            <CardDeck
              cards={cards}
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
              onUpdateCard={handleCardUpdate}
            />
          </div>
        )}
      </main>

      {showRestoreSheet && (
        <div className="fixed inset-0 z-30 bg-slate-950/30 px-5 py-8 flex items-end">
          <div className="w-full max-w-2xl mx-auto rounded-3xl bg-white border border-slate-100 shadow-2xl p-4 max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-800">휴지통</h3>
                <p className="text-xs text-slate-400">지운 단어를 골라서 다시 가져오세요</p>
              </div>
              <button
                onClick={() => setShowRestoreSheet(false)}
                className="px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium text-slate-500"
              >
                닫기
              </button>
            </div>

            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setSelectedDeletedIds(deletedCards.map((card) => card.id))}
                className="text-xs font-medium text-violet-600"
              >
                전체 선택
              </button>
              <button
                onClick={() => setSelectedDeletedIds([])}
                className="text-xs font-medium text-slate-400"
              >
                전체 해제
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 pr-1">
              {deletedCards.map((card) => {
                const checked = selectedDeletedIds.includes(card.id);

                return (
                  <button
                    key={card.id}
                    onClick={() =>
                      setSelectedDeletedIds((current) =>
                        current.includes(card.id)
                          ? current.filter((id) => id !== card.id)
                          : [...current, card.id]
                      )
                    }
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                      checked
                        ? "border-violet-200 bg-violet-50"
                        : "border-slate-100 bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center ${
                          checked
                            ? "border-violet-500 bg-violet-500"
                            : "border-slate-300"
                        }`}
                      >
                        {checked ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">{card.word}</p>
                        <p className="text-sm text-slate-500 line-clamp-1">
                          {card.koreanDefinition || card.definition}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {typeof card.sourcePage === "number" ? `p.${card.sourcePage}` : "페이지 없음"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleRestoreDeleted}
              disabled={selectedDeletedIds.length === 0}
              className="mt-4 w-full py-3.5 rounded-2xl bg-slate-900 text-white font-semibold disabled:opacity-40"
            >
              선택한 단어 가져오기
            </button>
          </div>
        </div>
      )}

      {showAuthSheet && (
        <div className="fixed inset-0 z-40 bg-slate-950/30 p-5 flex items-center justify-center">
          <div className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-800">보안 로그인</h3>
                <p className="text-xs text-slate-400">
                  매직링크로 로그인하면 같은 계정으로 단어장을 불러와요
                </p>
              </div>
              <button
                onClick={() => setShowAuthSheet(false)}
                className="px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium text-slate-500"
              >
                닫기
              </button>
            </div>

            {authSession ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-400 mb-1">로그인됨</p>
                  <p className="text-sm font-medium text-slate-700">
                    {authSession.user.email || authSession.user.id}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    이제 같은 계정으로 들어오면 같은 단어장을 불러옵니다.
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={authBusy}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500 leading-relaxed">
                  비밀번호 없이 이메일 6자리 코드로 로그인합니다.
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  처음 쓰는 이메일도, 이미 쓰던 이메일도 같은 방식으로 인증 코드를 보내요.
                </p>

                {authStep === "request" ? (
                  <>
                    <input
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                      type="email"
                      placeholder="you@example.com"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                    />
                    {rememberedLoginEmail && (
                      <button
                        type="button"
                        onClick={() => setLoginEmail(rememberedLoginEmail)}
                        className="text-xs text-slate-400 text-left"
                      >
                        최근 이메일 사용: {rememberedLoginEmail}
                      </button>
                    )}
                    <button
                      onClick={handleSendOtp}
                      disabled={!loginEmail.trim() || authBusy || authCooldownSeconds > 0}
                      className="w-full rounded-2xl bg-slate-900 text-white py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      <Mail className="w-4 h-4" />
                      {authBusy
                        ? "인증 코드 보내는 중..."
                        : authCooldownSeconds > 0
                          ? `${authCooldownSeconds}초 후 다시 보내기`
                        : "이메일 인증"}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
                      <p className="text-xs text-violet-500 mb-1">코드 보낸 이메일</p>
                      <p className="text-sm font-medium text-violet-700">
                        {pendingAuthEmail}
                      </p>
                    </div>
                    <input
                      value={otpCode}
                      onChange={(event) =>
                        setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6자리 코드"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm tracking-[0.3em] text-slate-700"
                    />
                    <button
                      onClick={handleVerifyOtp}
                      disabled={otpCode.trim().length !== 6 || authBusy}
                      className="w-full rounded-2xl bg-slate-900 text-white py-3 text-sm font-semibold disabled:opacity-40"
                    >
                      {authBusy ? "코드 확인 중..." : "코드로 로그인"}
                    </button>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthStep("request");
                          setOtpCode("");
                          setAuthMessage(null);
                        }}
                        className="text-slate-400"
                      >
                        이메일 다시 입력
                      </button>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={authBusy || authCooldownSeconds > 0}
                        className="text-violet-600 font-medium disabled:opacity-40"
                      >
                        {authCooldownSeconds > 0
                          ? `${authCooldownSeconds}초 후 재전송`
                          : "코드 다시 보내기"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {authMessage && (
              <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                {authMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white/80 backdrop-blur-xl border-t border-slate-100 px-4 pb-safe">
        <div className="flex">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
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
