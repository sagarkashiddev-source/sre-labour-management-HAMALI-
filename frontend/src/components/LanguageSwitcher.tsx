import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

/**
 * Small segmented control for EN / हिन्दी / मराठी. Deliberately shows each
 * language's own native label (not translated) so it stays legible to
 * someone who can't yet read the currently-active language — the whole
 * point of a language picker is that you can find your way out of a
 * language you don't understand.
 */
export function LanguageSwitcher({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { i18n } = useTranslation();

  const base =
    variant === 'dark'
      ? 'bg-white/10 text-white/70'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  const active = variant === 'dark' ? 'bg-white text-primary-700' : 'bg-white text-primary-700 shadow-sm dark:bg-slate-950 dark:text-primary-300';

  return (
    <div className={`inline-flex items-center gap-0.5 rounded-full p-0.5 text-xs font-semibold ${base}`} role="group" aria-label="Language">
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isActive = i18n.resolvedLanguage === lang.code || i18n.language === lang.code;
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => i18n.changeLanguage(lang.code)}
            aria-pressed={isActive}
            lang={lang.code}
            className={`rounded-full px-2.5 py-1 transition ${isActive ? active : 'hover:opacity-80'}`}
          >
            {lang.nativeLabel}
          </button>
        );
      })}
    </div>
  );
}
