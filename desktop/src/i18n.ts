import {
  createInstance,
  type i18n as I18nInstance,
  type Resource,
} from "i18next";
import { initReactI18next } from "react-i18next";
import { invoke, isTauri } from "@tauri-apps/api/core";

import en from "@/locales/en.json";
import ko from "@/locales/ko.json";
import enUi from "@/locales/en.ui.json";
import koUi from "@/locales/ko.ui.json";
import zhHans from "@/locales/zh-Hans.json";
import zhHant from "@/locales/zh-Hant.json";

import {
  APP_LANGUAGES,
  DEFAULT_LANGUAGE,
  resolveAppLanguage,
  resolveLanguagePreference,
  readLanguagePreference,
  writeLanguagePreference,
  type AppLanguage,
  type AppLanguagePreference,
} from "./language";

export {
  APP_LANGUAGES,
  APP_LANGUAGE_PREFERENCES,
  DEFAULT_LANGUAGE,
  DEFAULT_LANGUAGE_PREFERENCE,
  LANGUAGE_STORAGE_KEY,
  isAppLanguage,
  isAppLanguagePreference,
  readLanguagePreference,
  resolveAppLanguage,
  resolveLanguagePreference,
  resolveSystemAppLanguage,
  writeLanguagePreference,
} from "./language";
export type { AppLanguage, AppLanguagePreference } from "./language";

function getSystemLanguageCandidates(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : navigator.language
      ? [navigator.language]
      : [];
}

function getLanguageStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredLanguagePreference(): AppLanguagePreference {
  return readLanguagePreference(
    getLanguageStorage(),
    resolveLanguagePreference(import.meta.env?.VITE_BUZZ_DEFAULT_LANGUAGE),
  );
}

let preferenceState = {
  preference: readStoredLanguagePreference(),
  saved: true,
  nativeSynced: true,
};
const preferenceListeners = new Set<() => void>();

/** Current session preference, including a choice that storage could not save. */
export function getLanguagePreferenceState() {
  return preferenceState;
}

/** Observe preference persistence separately from rendered language changes. */
export function subscribeLanguagePreference(listener: () => void) {
  preferenceListeners.add(listener);
  return () => {
    preferenceListeners.delete(listener);
  };
}

export function createAppI18n(
  resources: Resource,
  language: AppLanguage,
): I18nInstance {
  const instance = createInstance();
  void instance.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: APP_LANGUAGES,
    load: "currentOnly",
    returnEmptyString: false,
    initAsync: false,
    interpolation: {
      escapeValue: false,
    },
  });
  return instance;
}

export const i18n = createAppI18n(
  {
    en: { translation: en, ui: enUi },
    ko: { translation: ko, ui: koUi },
    "zh-Hant": { translation: zhHant },
    "zh-Hans": { translation: zhHans },
  },
  resolveAppLanguage(preferenceState.preference, getSystemLanguageCandidates()),
);

function applyDocumentLanguage(language: AppLanguage) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

applyDocumentLanguage(resolveAppLanguage(i18n.resolvedLanguage));

async function syncNativeLanguage(language: AppLanguage): Promise<boolean> {
  if (typeof window !== "undefined" && isTauri()) {
    try {
      await invoke("set_desktop_language", { language });
      return true;
    } catch (error) {
      console.warn("Buzz could not update its native menu language", error);
      return false;
    }
  }
  return true;
}

void syncNativeLanguage(resolveAppLanguage(i18n.resolvedLanguage));

export async function setAppLanguage(
  preference: AppLanguagePreference,
): Promise<{ saved: boolean; nativeSynced: boolean }> {
  const language = resolveAppLanguage(
    preference,
    getSystemLanguageCandidates(),
  );
  await i18n.changeLanguage(language);
  applyDocumentLanguage(language);
  const nativeSynced = await syncNativeLanguage(language);
  const saved = writeLanguagePreference(getLanguageStorage(), preference);
  preferenceState = { preference, saved, nativeSynced };
  for (const listener of preferenceListeners) listener();
  return { saved, nativeSynced };
}
