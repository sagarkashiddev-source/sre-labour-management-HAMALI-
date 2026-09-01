import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Company, EntryFormInput, LoadUnload, VehicleType, WorkEntry, companiesApi, vehicleTypesApi } from '../api/client';
import { getBusinessToday } from '../utils/businessDate';

/**
 * Renders the exact 6 fields every role is allowed to touch: Date, Vehicle
 * No., Type, Load/Unload, Company, Remark. There is deliberately no amount
 * field anywhere in this component's props, state, or markup — Admin's
 * amount entry is a completely separate component (AmountEntryCard) shown
 * only after this form saves, matching the backend's separation of
 * WorkEntry from EntryFinancial.
 *
 * Localization note: every label here is translated (EN/HI/MR) EXCEPT the
 * Vehicle No. field. Registration plates are always Latin characters and
 * digits, so that field's label, placeholder and input are intentionally
 * hardcoded in English and marked lang="en" regardless of the app's active
 * language — translating "Vehicle No." or letting the input pick up a
 * Devanagari font would only make plate numbers harder to read and enter.
 */

export interface EntryFormValues {
  date: string;
  vehicleNo: string;
  vehicleTypeId: string;
  loadUnload: LoadUnload;
  companyId: string;
  remark: string;
}

const emptyValues: EntryFormValues = {
  date: getBusinessToday(),
  vehicleNo: '',
  vehicleTypeId: '',
  loadUnload: 'LOAD',
  companyId: '',
  remark: '',
};

export function entryToFormValues(entry: WorkEntry): EntryFormValues {
  return {
    date: entry.date.slice(0, 10),
    vehicleNo: entry.vehicleNo,
    vehicleTypeId: entry.vehicleType.id,
    loadUnload: entry.loadUnload,
    companyId: entry.company.id,
    remark: entry.remark ?? '',
  };
}

export function EntryForm({
  initialValues,
  onSubmit,
  submitLabel,
  size = 'compact',
  onCancel,
}: {
  initialValues?: EntryFormValues;
  onSubmit: (values: EntryFormInput) => Promise<{ warning?: string } | void>;
  submitLabel?: string;
  size?: 'compact' | 'large'; // 'large' = Labour's one-handed mobile form
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<EntryFormValues>(initialValues ?? emptyValues);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  // `saving` (React state) alone has a race window: a fast double-tap can
  // fire two submit events before React re-renders the disabled button.
  // This ref is checked synchronously, closing that window regardless of
  // render timing (spec section 9/37: "Prevent double-click duplicate
  // creation").
  const submitInFlight = useRef(false);

  useEffect(() => {
    vehicleTypesApi.list().then((r) => setVehicleTypes(r.vehicleTypes));
  }, []);

  useEffect(() => {
    const tmr = setTimeout(() => {
      companiesApi.list(companySearch).then((r) => setCompanies(r.companies));
    }, 200);
    return () => clearTimeout(tmr);
  }, [companySearch]);

  const selectedCompany = companies.find((c) => c.id === values.companyId);

  const inputClass =
    size === 'large'
      ? 'w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base dark:border-slate-600 dark:bg-slate-800 focus:border-primary-600 focus:ring-2 focus:ring-primary-200 outline-none'
      : 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 focus:border-primary-600 focus:ring-2 focus:ring-primary-200 outline-none';
  const labelClass = size === 'large' ? 'text-sm font-semibold text-slate-700 dark:text-slate-300' : 'text-xs font-medium text-slate-600 dark:text-slate-400';
  const buttonClass =
    size === 'large'
      ? 'w-full rounded-xl bg-primary-600 py-4 text-base font-semibold text-white shadow-card active:bg-primary-700 disabled:opacity-50'
      : 'rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50';

  async function handleSubmit(e: React.FormEvent, force = false) {
    e.preventDefault();
    if (submitInFlight.current) return; // synchronous re-entrancy guard
    setError(null);
    if (!values.vehicleNo.trim()) return setError(t('entryForm.vehicleRequired'));
    if (!values.vehicleTypeId) return setError(t('entryForm.typeRequired'));
    if (!values.companyId) return setError(t('entryForm.companyRequired'));

    submitInFlight.current = true;
    setSaving(true);
    try {
      const result = await onSubmit({ ...values, remark: values.remark || undefined, force });
      if (result && 'warning' in result && result.warning) {
        setDuplicateWarning(result.warning);
        submitInFlight.current = false;
        setSaving(false);
        return;
      }
      setDuplicateWarning(null);
    } catch (err: any) {
      setError(err.message ?? t('entryForm.genericError'));
    } finally {
      submitInFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => handleSubmit(e)} className={size === 'large' ? 'space-y-5' : 'space-y-4'}>
      {error && <div className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}

      {duplicateWarning && (
        <div className="rounded-lg bg-warning-50 px-3 py-3 text-sm text-warning-700">
          <p className="font-medium">{duplicateWarning}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded-md bg-warning-600 px-3 py-1.5 text-xs font-semibold text-white"
              onClick={(e) => handleSubmit(e as any, true)}
            >
              {t('entryForm.saveAnyway')}
            </button>
            <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs" onClick={() => setDuplicateWarning(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      <div>
        <label className={labelClass}>{t('entryForm.date')}</label>
        <input
          type="date"
          value={values.date}
          onChange={(e) => setValues({ ...values, date: e.target.value })}
          className={`${inputClass} mt-1`}
        />
      </div>

      {/* Vehicle No. — intentionally English-only, never translated (see file header note). */}
      <div className="field-vehicle-no" lang="en" dir="ltr">
        <label className={labelClass} lang="en">Vehicle No.</label>
        <input
          type="text"
          lang="en"
          placeholder="MH12AB1234"
          value={values.vehicleNo}
          onChange={(e) => setValues({ ...values, vehicleNo: e.target.value.toUpperCase() })}
          className={`${inputClass} mt-1 uppercase`}
        />
      </div>

      <div>
        <label className={labelClass}>{t('entryForm.type')}</label>
        <select
          value={values.vehicleTypeId}
          onChange={(e) => setValues({ ...values, vehicleTypeId: e.target.value })}
          className={`${inputClass} mt-1`}
        >
          <option value="">{t('entryForm.selectType')}</option>
          {vehicleTypes.map((tpe) => (
            <option key={tpe.id} value={tpe.id}>{tpe.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>{t('entryForm.loadUnload')}</label>
        <select
          value={values.loadUnload}
          onChange={(e) => setValues({ ...values, loadUnload: e.target.value as LoadUnload })}
          className={`${inputClass} mt-1`}
        >
          <option value="LOAD">{t('entryForm.load')}</option>
          <option value="UNLOAD">{t('entryForm.unload')}</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>{t('entryForm.company')}</label>

        {size === 'large' ? (
          // Labour gets a tap-friendly picker (spec: "labour can choose
          // companies") instead of a native <select>, which is small and
          // fiddly on a phone. Company names themselves are proper nouns
          // (client company names) and are never translated.
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setCompanyPickerOpen(true)}
              className={`${inputClass} flex items-center justify-between text-left`}
            >
              <span className={selectedCompany ? 'font-medium text-slate-900 dark:text-slate-50' : 'text-slate-400'}>
                {selectedCompany ? selectedCompany.name : t('entryForm.selectCompany')}
              </span>
              <span className="text-slate-400">▾</span>
            </button>

            {companyPickerOpen && (
              <div className="fixed inset-0 z-30 flex flex-col bg-black/40" onClick={() => setCompanyPickerOpen(false)}>
                <div
                  className="mt-auto max-h-[75vh] rounded-t-2xl bg-white p-4 shadow-card dark:bg-slate-900"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    autoFocus
                    type="text"
                    placeholder={t('entryForm.searchCompanyPlaceholder') ?? ''}
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    className={`${inputClass} mb-3`}
                  />
                  <div className="max-h-[55vh] space-y-1 overflow-y-auto">
                    {companies.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setValues({ ...values, companyId: c.id });
                          setCompanyPickerOpen(false);
                        }}
                        className={`block w-full rounded-xl px-4 py-3 text-left text-base font-medium ${
                          c.id === values.companyId
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                            : 'text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                    {companies.length === 0 && (
                      <p className="py-6 text-center text-sm text-slate-400">{t('entryForm.noCompaniesFound')}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <input
              type="text"
              placeholder={t('entryForm.searchCompanyPlaceholder') ?? ''}
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              className={`${inputClass} mt-1 mb-1.5`}
            />
            <select
              value={values.companyId}
              onChange={(e) => setValues({ ...values, companyId: e.target.value })}
              className={inputClass}
            >
              <option value="">{t('entryForm.selectCompany')}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </>
        )}
      </div>

      <div>
        <label className={labelClass}>{t('entryForm.remark')}</label>
        <textarea
          value={values.remark}
          onChange={(e) => setValues({ ...values, remark: e.target.value })}
          rows={size === 'large' ? 3 : 2}
          className={`${inputClass} mt-1`}
        />
      </div>

      <div className={size === 'large' ? 'pt-2' : 'flex justify-end gap-2 pt-2'}>
        {onCancel && size === 'compact' && (
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
            {t('common.cancel')}
          </button>
        )}
        <button type="submit" disabled={saving} className={buttonClass}>
          {saving ? t('common.saving') : submitLabel ?? t('entryForm.saveEntryDefault')}
        </button>
      </div>
    </form>
  );
}
