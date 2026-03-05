"use client";

const FEMALE_HINTS = [
  "samantha",
  "ava",
  "victoria",
  "karen",
  "tessa",
  "moira",
  "allison",
  "serena",
  "female",
];

function pickPreferredEnglishVoice(voices: SpeechSynthesisVoice[]) {
  const englishVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith("en")
  );
  if (englishVoices.length === 0) return null;

  const female = englishVoices.find((voice) => {
    const name = voice.name.toLowerCase();
    return FEMALE_HINTS.some((hint) => name.includes(hint));
  });
  if (female) return female;

  const us = englishVoices.find((voice) =>
    voice.lang.toLowerCase().startsWith("en-us")
  );
  return us || englishVoices[0];
}

function createUtterance(text: string, voice?: SpeechSynthesisVoice) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.96;
  utterance.pitch = 1.08;
  if (voice) {
    utterance.voice = voice;
  }
  return utterance;
}

export function speakEnglish(text: string): void {
  if (!text.trim()) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  const preferredVoice = pickPreferredEnglishVoice(voices);
  const utterance = createUtterance(text, preferredVoice || undefined);

  synth.cancel();
  synth.resume();
  synth.speak(utterance);

  // iOS Safari can return empty voices on first call; retry once when voices load.
  if (voices.length === 0) {
    const retryWithLoadedVoices = () => {
      if (synth.speaking || synth.pending) return;
      const nextVoice = pickPreferredEnglishVoice(synth.getVoices());
      const retryUtterance = createUtterance(text, nextVoice || undefined);
      synth.speak(retryUtterance);
    };
    synth.addEventListener("voiceschanged", retryWithLoadedVoices, { once: true });
  }
}
