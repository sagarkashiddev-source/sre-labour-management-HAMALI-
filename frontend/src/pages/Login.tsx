import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, password);
      navigate('/'); // App.tsx's role router takes it from here
    } catch (err: any) {
      setError(err.message ?? t('login.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-center">
          <LanguageSwitcher />
        </div>

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-700 text-lg font-bold text-white shadow-card">
            SR
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{t('login.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('login.tagline')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-800">
          {error && <div className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('login.identifier')}</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-900"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('login.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary-700 py-3.5 text-sm font-semibold text-white shadow-card hover:bg-primary-800 disabled:opacity-50"
          >
            {loading ? t('login.signingIn') : t('login.loginButton')}
          </button>
        </form>
      </div>
    </div>
  );
}
