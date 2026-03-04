import { VocabCard, CardDeck, ExtractedWord } from "@/types/vocab";

const DECK_KEY = "buddy-cards-deck";
const SCAN_DRAFT_KEY = "buddy-cards-scan-draft";
const DEVICE_ID_KEY = "buddy-cards-device-id";
const ACTIVE_TAB_KEY = "buddy-cards-active-tab";
const READING_PROGRESS_KEY = "buddy-cards-reading-progress";
const DELETED_CARDS_KEY = "buddy-cards-deleted-cards";
const AUTH_SESSION_KEY = "buddy-cards-auth-session";
const AUTH_MIGRATIONS_KEY = "buddy-cards-auth-migrations";

export interface ScanDraft {
  words: ExtractedWord[];
  imageBase64: string;
  inputMode: "image" | "text";
  updatedAt: string;
}

export interface ReadingProgress {
  title: string;
  currentPage: number | null;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
}

interface RemoteDeckRow {
  device_id: string;
  name: string;
  description: string | null;
  cards: VocabCard[];
  created_at: string;
  updated_at: string;
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  return {
    url,
    anonKey,
  };
}

function getDeviceId(): string | null {
  if (typeof window === "undefined") return null;

  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const nextId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  localStorage.setItem(DEVICE_ID_KEY, nextId);
  return nextId;
}

function getSupabaseHeaders() {
  const config = getSupabaseConfig();
  if (!config) return null;

  return {
    "Content-Type": "application/json",
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
  };
}

function getSupabaseHeadersForToken(accessToken?: string) {
  const config = getSupabaseConfig();
  if (!config) return null;

  return {
    "Content-Type": "application/json",
    apikey: config.anonKey,
    Authorization: `Bearer ${accessToken || config.anonKey}`,
  };
}

async function fetchAuthUser(accessToken: string): Promise<AuthUser | null> {
  const config = getSupabaseConfig();
  const headers = getSupabaseHeadersForToken(accessToken);

  if (!config || !headers) return null;

  try {
    const res = await fetch(`${config.url}/auth/v1/user`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) return null;

    const user = (await res.json()) as { id?: string; email?: string };
    if (!user?.id) return null;

    return {
      id: user.id,
      email: user.email,
    };
  } catch {
    return null;
  }
}

function getOwnerKey(): string | null {
  const session = loadAuthSession();
  if (session?.user.id) return session.user.id;
  return getDeviceId();
}

function mapRemoteDeck(row: RemoteDeckRow): CardDeck {
  return {
    id: "default",
    name: row.name || "내 단어장",
    description: row.description || "Buddy Cards로 모은 어휘들",
    cards: Array.isArray(row.cards) ? row.cards : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getDefaultDeck(): CardDeck {
  return {
    id: "default",
    name: "내 단어장",
    description: "Buddy Cards로 모은 어휘들",
    cards: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getDefaultReadingProgress(): ReadingProgress {
  return {
    title: "Sherlock Holmes: A Scandal In Bohemia",
    currentPage: null,
    updatedAt: new Date().toISOString(),
  };
}

export function loadAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.user?.id !== "string"
    ) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken:
        typeof parsed.refreshToken === "string" ? parsed.refreshToken : undefined,
      user: {
        id: parsed.user.id,
        email:
          typeof parsed.user.email === "string" ? parsed.user.email : undefined,
      },
    };
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function loadAuthMigrations(): Record<string, boolean> {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(AUTH_MIGRATIONS_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    return Object.entries(parsed).reduce<Record<string, boolean>>(
      (acc, [key, value]) => {
        if (typeof key === "string" && value === true) {
          acc[key] = true;
        }
        return acc;
      },
      {}
    );
  } catch {
    return {};
  }
}

export function hasCompletedAuthMigration(userId: string): boolean {
  return !!loadAuthMigrations()[userId];
}

export function markAuthMigrationCompleted(userId: string): void {
  if (typeof window === "undefined" || !userId) return;

  const next = {
    ...loadAuthMigrations(),
    [userId]: true,
  };

  localStorage.setItem(AUTH_MIGRATIONS_KEY, JSON.stringify(next));
}

export async function sendEmailOtp(
  email: string,
  createUser = true
): Promise<void> {
  const config = getSupabaseConfig();
  const headers = getSupabaseHeadersForToken();

  if (!config || !headers) {
    throw new Error("Supabase is not configured");
  }

  const redirectTo =
    typeof window !== "undefined" ? window.location.origin : undefined;

  const res = await fetch(`${config.url}/auth/v1/otp`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      create_user: createUser,
      options: redirectTo ? { email_redirect_to: redirectTo } : undefined,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const details = [
      data?.code,
      data?.msg,
      data?.error,
      data?.error_description,
    ]
      .filter((value): value is string => typeof value === "string" && !!value.trim())
      .join(" | ");

    if (res.status === 429) {
      throw new Error(
        "요청이 너무 많아요. 잠시만 기다렸다가 다시 시도해 주세요. 보통 1분 안에 다시 보낼 수 있어요."
      );
    }

    throw new Error(
      details
        ? `로그인 링크 전송 실패 (${res.status}): ${details}`
        : `로그인 링크 전송 실패 (${res.status})`
    );
  }
}

export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<AuthSession> {
  const config = getSupabaseConfig();
  const headers = getSupabaseHeadersForToken();

  if (!config || !headers) {
    throw new Error("Supabase is not configured");
  }

  const res = await fetch(`${config.url}/auth/v1/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      token,
      type: "email",
    }),
  });

  const data = (await res.json().catch(() => null)) as
    | {
        access_token?: string;
        refresh_token?: string;
        user?: { id?: string; email?: string };
        code?: string;
        msg?: string;
        error?: string;
        error_description?: string;
      }
    | null;

  if (!res.ok) {
    const details = [
      data?.code,
      data?.msg,
      data?.error,
      data?.error_description,
    ]
      .filter((value): value is string => typeof value === "string" && !!value.trim())
      .join(" | ");

    throw new Error(
      details
        ? `OTP 확인 실패 (${res.status}): ${details}`
        : `OTP 확인 실패 (${res.status})`
    );
  }

  const accessToken = data?.access_token;
  const refreshToken = data?.refresh_token;
  const user =
    typeof data?.user?.id === "string"
      ? {
          id: data.user.id,
          email:
            typeof data.user.email === "string" ? data.user.email : undefined,
        }
      : accessToken
        ? await fetchAuthUser(accessToken)
        : null;

  if (!accessToken || !user?.id) {
    throw new Error("로그인 세션을 만들지 못했어요. 다시 시도해 주세요.");
  }

  const session: AuthSession = {
    accessToken,
    refreshToken:
      typeof refreshToken === "string" ? refreshToken : undefined,
    user,
  };

  saveAuthSession(session);
  return session;
}

export async function hydrateAuthSessionFromUrl(): Promise<AuthSession | null> {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");

  if (!accessToken) {
    return loadAuthSession();
  }

  const user = await fetchAuthUser(accessToken);
  if (!user) {
    return null;
  }

  const session: AuthSession = {
    accessToken,
    refreshToken: params.get("refresh_token") || undefined,
    user,
  };

  saveAuthSession(session);
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`
  );

  return session;
}

export async function signOut(): Promise<void> {
  const config = getSupabaseConfig();
  const session = loadAuthSession();
  const headers = getSupabaseHeadersForToken(session?.accessToken);

  if (config && headers && session?.accessToken) {
    try {
      await fetch(`${config.url}/auth/v1/logout`, {
        method: "POST",
        headers,
      });
    } catch {
      // Best effort.
    }
  }

  clearAuthSession();
}

export function clearLocalDeckData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DECK_KEY);
  localStorage.removeItem(DELETED_CARDS_KEY);
}

export function loadDeck(): CardDeck {
  if (typeof window === "undefined") return getDefaultDeck();
  try {
    const raw = localStorage.getItem(DECK_KEY);
    if (!raw) return getDefaultDeck();
    return JSON.parse(raw) as CardDeck;
  } catch {
    return getDefaultDeck();
  }
}

export function saveDeck(deck: CardDeck): void {
  if (typeof window === "undefined") return;
  deck.updatedAt = new Date().toISOString();
  localStorage.setItem(DECK_KEY, JSON.stringify(deck));
  void saveDeckToCloud(deck);
}

function loadDeletedCardsBuffer(): VocabCard[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(DELETED_CARDS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VocabCard[]) : [];
  } catch {
    return [];
  }
}

function saveDeletedCardsBuffer(cards: VocabCard[]): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(DELETED_CARDS_KEY, JSON.stringify(cards));
}

function archiveDeletedCards(cards: VocabCard[]): void {
  if (cards.length === 0) return;

  const current = loadDeletedCardsBuffer();
  const merged = [...cards, ...current];
  const seen = new Set<string>();
  const deduped = merged.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });

  saveDeletedCardsBuffer(deduped);
}

export function addCards(newCards: VocabCard[]): CardDeck {
  const deck = loadDeck();
  const existingWords = new Set(deck.cards.map((c) => c.word.toLowerCase()));
  const unique = newCards.filter(
    (c) => !existingWords.has(c.word.toLowerCase())
  );
  deck.cards = [...deck.cards, ...unique];
  saveDeck(deck);
  return deck;
}

export function updateCard(updated: VocabCard): CardDeck {
  const deck = loadDeck();
  deck.cards = deck.cards.map((c) => (c.id === updated.id ? updated : c));
  saveDeck(deck);
  return deck;
}

export function deleteCard(cardId: string): CardDeck {
  const deck = loadDeck();
  const removed = deck.cards.filter((c) => c.id === cardId);
  archiveDeletedCards(removed);
  deck.cards = deck.cards.filter((c) => c.id !== cardId);
  saveDeck(deck);
  return deck;
}

export function clearDeck(): CardDeck {
  const deck = loadDeck();
  archiveDeletedCards(deck.cards);
  deck.cards = [];
  saveDeck(deck);
  return deck;
}

export function loadDeletedCards(): VocabCard[] {
  return loadDeletedCardsBuffer();
}

export function restoreDeletedCards(cardIds?: string[]): CardDeck {
  const deck = loadDeck();
  const deleted = loadDeletedCardsBuffer();

  if (deleted.length === 0) return deck;

  const selectedIds = cardIds ? new Set(cardIds) : null;
  const targetCards = selectedIds
    ? deleted.filter((card) => selectedIds.has(card.id))
    : deleted;

  const existingIds = new Set(deck.cards.map((card) => card.id));
  const restored = targetCards.filter((card) => !existingIds.has(card.id));

  if (restored.length === 0) {
    if (!selectedIds) {
      saveDeletedCardsBuffer([]);
    }
    return deck;
  }

  deck.cards = [...restored.reverse(), ...deck.cards];
  saveDeck(deck);
  if (selectedIds) {
    saveDeletedCardsBuffer(
      deleted.filter((card) => !selectedIds.has(card.id))
    );
  } else {
    saveDeletedCardsBuffer([]);
  }
  return deck;
}

export function loadScanDraft(): ScanDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(SCAN_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ScanDraft;
  } catch {
    return null;
  }
}

export function saveScanDraft(
  words: ExtractedWord[],
  imageBase64: string,
  inputMode: "image" | "text"
): void {
  if (typeof window === "undefined") return;

  const draft: ScanDraft = {
    words,
    imageBase64,
    inputMode,
    updatedAt: new Date().toISOString(),
  };

  sessionStorage.setItem(SCAN_DRAFT_KEY, JSON.stringify(draft));
}

export function clearScanDraft(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SCAN_DRAFT_KEY);
}

export function loadActiveTab<T extends string>(fallback: T): T {
  if (typeof window === "undefined") return fallback;

  const raw = localStorage.getItem(ACTIVE_TAB_KEY);
  return raw ? (raw as T) : fallback;
}

export function saveActiveTab(tab: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_TAB_KEY, tab);
}

export function loadReadingProgress(): ReadingProgress {
  if (typeof window === "undefined") return getDefaultReadingProgress();

  try {
    const raw = localStorage.getItem(READING_PROGRESS_KEY);
    if (!raw) return getDefaultReadingProgress();

    const parsed = JSON.parse(raw) as Partial<ReadingProgress>;
    return {
      title:
        typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title
          : getDefaultReadingProgress().title,
      currentPage:
        typeof parsed.currentPage === "number" ? parsed.currentPage : null,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return getDefaultReadingProgress();
  }
}

export function saveReadingProgress(progress: ReadingProgress): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    READING_PROGRESS_KEY,
    JSON.stringify({
      ...progress,
      updatedAt: new Date().toISOString(),
    })
  );
}

export function isCloudSyncEnabled(): boolean {
  return !!getSupabaseConfig();
}

export async function loadDeckFromCloud(): Promise<CardDeck | null> {
  if (typeof window === "undefined") return null;

  const config = getSupabaseConfig();
  const session = loadAuthSession();
  const headers = getSupabaseHeadersForToken(session?.accessToken);
  const ownerKey = getOwnerKey();

  if (!config || !headers || !ownerKey) return null;

  try {
    const query = new URLSearchParams({
      "device_id": `eq.${ownerKey}`,
      select: "device_id,name,description,cards,created_at,updated_at",
      limit: "1",
    });

    const res = await fetch(`${config.url}/rest/v1/decks?${query.toString()}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) return null;

    const rows = (await res.json()) as RemoteDeckRow[];
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const deck = mapRemoteDeck(rows[0]);
    localStorage.setItem(DECK_KEY, JSON.stringify(deck));
    return deck;
  } catch {
    return null;
  }
}

export async function saveDeckToCloud(deck: CardDeck): Promise<void> {
  if (typeof window === "undefined") return;

  const config = getSupabaseConfig();
  const session = loadAuthSession();
  const headers = getSupabaseHeadersForToken(session?.accessToken);
  const ownerKey = getOwnerKey();

  if (!config || !headers || !ownerKey) return;

  const payload = {
    device_id: ownerKey,
    name: deck.name,
    description: deck.description || null,
    cards: deck.cards,
    created_at: deck.createdAt,
    updated_at: deck.updatedAt,
  };

  try {
    await fetch(`${config.url}/rest/v1/decks`, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Keep local storage as the source of truth when cloud sync fails.
  }
}
