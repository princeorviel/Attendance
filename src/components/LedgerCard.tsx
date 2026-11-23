import React, { useEffect, useState } from 'react';
import { Plus, Share2, Trash2 } from 'lucide-react';
import { MoneyEntry } from '../types';
import { formatDisplayDate, formatRs } from '../utils/hazri';

interface LedgerCardProps {
  entries: MoneyEntry[];
  defaultDate: string;
  readOnlyFinance?: boolean;
  readOnlyHint?: string;
  onAddEntry: (entry: Omit<MoneyEntry, 'id'>) => void;
  onDeleteEntry: (id: number) => void;
  onShareLedger: () => void;
}

export const LedgerCard: React.FC<LedgerCardProps> = ({
  entries,
  defaultDate,
  readOnlyFinance,
  readOnlyHint,
  onAddEntry,
  onDeleteEntry,
  onShareLedger,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState<'adv' | 'pay'>('adv');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [note, setNote] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);

  useEffect(() => {
    setDate(defaultDate);
  }, [defaultDate]);

  useEffect(() => {
    if (confirmId === null) return;
    const t = setTimeout(() => setConfirmId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnlyFinance) return;
    const num = parseFloat(amount);
    if (!num || num <= 0 || !date) return;
    onAddEntry({ t: type, a: num, d: date, n: note.trim() });
    setAmount('');
    setNote('');
    setShowAdd(false);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Advance / Payment की सूची
        </h2>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onShareLedger}
            className="inline-flex min-h-[38px] items-center gap-1 whitespace-nowrap rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>शेयर</span>
          </button>
          {!readOnlyFinance && (
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex min-h-[38px] items-center gap-1 whitespace-nowrap rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{showAdd ? 'बंद करें' : 'जोड़ें'}</span>
            </button>
          )}
        </div>
      </div>

      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {readOnlyFinance
          ? readOnlyHint ||
            'Advance व Payment केवल Owner / Manager जोड़ सकते हैं।'
          : 'तारीख पर टैप करके या यहाँ से Advance और Payment जोड़ें।'}
      </p>

      {!readOnlyFinance && showAdd && (
        <form
          onSubmit={handleSubmit}
          className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800"
        >
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'adv' | 'pay')}
            className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="adv">Advance (लिया)</option>
            <option value="pay">Payment (मिली)</option>
          </select>

          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="रकम ₹"
            required
            className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono-num text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono-num text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="नोट (optional)"
            className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />

          <button
            type="submit"
            className="col-span-2 min-h-[44px] rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            एंट्री जोड़ें
          </button>
        </form>
      )}

      <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {entries.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
            इस महीने कोई Advance या Payment एंट्री नहीं है
          </p>
        ) : (
          entries.map((entry) => {
            const isConfirming = confirmId === entry.id;
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <div
                    className={`font-mono-num text-sm font-semibold ${
                      entry.t === 'adv'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {entry.t === 'adv' ? 'Advance' : 'Payment'}{' '}
                    {formatRs(entry.a)}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {formatDisplayDate(entry.d)}
                    {entry.n ? ` · ${entry.n}` : ''}
                  </div>
                </div>

                {!readOnlyFinance && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isConfirming) {
                        onDeleteEntry(entry.id);
                        setConfirmId(null);
                      } else {
                        setConfirmId(entry.id);
                      }
                    }}
                    aria-label="एंट्री हटाएं"
                    className={`flex min-h-[38px] items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                      isConfirming
                        ? 'bg-red-600 text-white'
                        : 'text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800 dark:hover:text-red-400'
                    }`}
                  >
                    {isConfirming ? (
                      'पक्का हटाएं?'
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
