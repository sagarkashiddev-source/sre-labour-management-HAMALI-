import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      mr: { translation: mr },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi', 'mr'],
    interpolation: { escapeValue: false },
    detection: {
      // Every role (Labour, Owner, Admin) shares one login screen and one
      // device is usually one person, so we persist the choice locally and
      // check it before falling back to the browser's own language.
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'sre-language',
    },
  });

// Keep <html lang="..."> in sync so screen readers and font-selection CSS
// pick the right script (Devanagari for hi/mr, Latin for en).
i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', lng);
  }
});
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('lang', i18n.language || 'en');
}

export default i18n;
