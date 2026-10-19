import { useSyncExternalStore } from "react";

export type SahmLanguage = "en" | "ar";

const STORAGE_KEY = "sahm-language";
const LANGUAGE_EVENT = "sahm-language-change";

function getLanguageSnapshot(): SahmLanguage {
  if (typeof window === "undefined") return "ar";
  return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ar";
}

function subscribeToLanguageChanges(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(LANGUAGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LANGUAGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setSahmLanguage(language: SahmLanguage): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, language);
  window.dispatchEvent(new Event(LANGUAGE_EVENT));
}

export function useSahmLanguage(): SahmLanguage {
  return useSyncExternalStore(subscribeToLanguageChanges, getLanguageSnapshot, () => "ar");
}
