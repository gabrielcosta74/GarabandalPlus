'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { type LocaleCode, getTranslations, type Translations } from '../i18n';

interface LocaleContextValue {
  locale: LocaleCode;
  t: Translations;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'pt',
  t: getTranslations('pt'),
});

export function LocaleProvider({
  locale,
  children,
}: {
  locale: LocaleCode;
  children: ReactNode;
}) {
  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en' : 'pt-BR';
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, t: getTranslations(locale) }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
