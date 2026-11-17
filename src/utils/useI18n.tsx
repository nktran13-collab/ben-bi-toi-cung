import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getStoredLang,
  localeOf,
  persistLang,
  setActiveLang,
  translate,
  type Lang,
  type TranslationKey,
  type TranslationVars,
} from './i18n';

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  locale: string;
  t: (key: TranslationKey, vars?: TranslationVars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getStoredLang);

  useEffect(() => {
    setActiveLang(lang);
    persistLang(lang);
    document.documentElement.lang = lang;
    document.title = translate(lang, 'app.name');
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);
  const toggleLang = useCallback(() => setLangState((prev) => (prev === 'vi' ? 'en' : 'vi')), []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      toggleLang,
      locale: localeOf(lang),
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang, setLang, toggleLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside LanguageProvider');
  return context;
}
