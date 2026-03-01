import { VocabCard, CardDeck } from "@/types/vocab";

const DECK_KEY = "buddy-cards-deck";

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
  deck.cards = deck.cards.filter((c) => c.id !== cardId);
  saveDeck(deck);
  return deck;
}
