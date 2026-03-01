export interface VocabCard {
  id: string;
  word: string;
  pronunciation?: string;
  partOfSpeech?: string;
  definition: string;
  koreanDefinition?: string;
  exampleSentence?: string;
  exampleSentenceKorean?: string;
  contextSentence?: string; // original sentence from book
  imageSource?: string; // base64 thumbnail
  tags: string[];
  difficulty: "easy" | "medium" | "hard";
  reviewCount: number;
  correctCount: number;
  lastReviewed?: string;
  createdAt: string;
  status: "new" | "learning" | "mastered";
}

export interface CardDeck {
  id: string;
  name: string;
  description?: string;
  cards: VocabCard[];
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedWord {
  word: string;
  pronunciation?: string;
  partOfSpeech?: string;
  definition: string;
  koreanDefinition?: string;
  exampleSentence?: string;
  exampleSentenceKorean?: string;
  contextSentence?: string;
}

export interface QuizQuestion {
  card: VocabCard;
  type: "definition" | "word" | "fill-blank";
  options: string[];
  correctIndex: number;
}
