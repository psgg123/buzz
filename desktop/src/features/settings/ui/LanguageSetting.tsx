import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import {
  isAppLanguagePreference,
  getLanguagePreferenceState,
  setAppLanguage,
  subscribeLanguagePreference,
} from "@/i18n";
import { SettingsOptionGroup, SettingsOptionRow } from "./SettingsOptionGroup";

export function LanguageSetting() {
  const { t } = useTranslation();
  const {
    preference: languagePreference,
    saved,
    nativeSynced,
  } = useSyncExternalStore(
    subscribeLanguagePreference,
    getLanguagePreferenceState,
    getLanguagePreferenceState,
  );
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <SettingsOptionGroup className="mt-8">
      <SettingsOptionRow>
        <div className="min-w-0">
          <label className="text-sm font-medium" htmlFor="app-language">
            {t("settings.language.label")}
          </label>
          <p className="text-sm font-normal text-muted-foreground">
            {t("settings.language.description")}
          </p>
          {!saved ? (
            <p role="status">{t("settings.language.unsaved")}</p>
          ) : null}
          {error ? <p role="alert">{t("settings.language.error")}</p> : null}
          {!nativeSynced ? (
            <p role="alert">{t("settings.language.nativeError")}</p>
          ) : null}
        </div>
        <select
          className="h-8 min-w-36 rounded-full border border-border/50 bg-muted/45 px-3 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="app-language"
          disabled={pending}
          id="app-language"
          onChange={(event) => {
            const nextPreference = event.currentTarget.value;
            if (isAppLanguagePreference(nextPreference)) {
              setError(false);
              setPending(true);
              void setAppLanguage(nextPreference).then(
                () => {
                  setPending(false);
                },
                () => {
                  setError(true);
                  setPending(false);
                },
              );
            }
          }}
          value={languagePreference}
        >
          <option value="system">{t("settings.language.system")}</option>
          <option value="en">{t("settings.language.english")}</option>
          <option value="ko">한국어</option>
          <option value="zh-Hant">
            {t("settings.language.traditionalChinese")}
          </option>
          <option value="zh-Hans">
            {t("settings.language.simplifiedChinese")}
          </option>
        </select>
      </SettingsOptionRow>
    </SettingsOptionGroup>
  );
}
