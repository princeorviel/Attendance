import React from 'react';
import { Share2 } from 'lucide-react';
import { Account, AttendanceStatus } from '../types';
import {
  MonthCalculation,
  STATUS_META,
  formatDisplayDate,
  formatRs,
} from '../utils/hazri';

interface HisabCardProps {
  account: Account;
  upToDate: string;
  monthStart: string;
  monthEnd: string;
  calculation: MonthCalculation;
  readOnlyFinance?: boolean;
  readOnlyHint?: string;
  onChangeUpToDate: (value: string) => void;
  onChangeSalary: (value: number) => void;
  onShareLedger: () => void;
}

const STAT_KEYS: Array<{
  key: Exclude<AttendanceStatus, ''>;
  colorClass: string;
}> = [
  { key: 'P', colorClass: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'A', colorClass: 'text-red-600 dark:text-red-400' },
  { key: 'L', colorClass: 'text-amber-600 dark:text-amber-400' },
  { key: 'H', colorClass: 'text-violet-600 dark:text-violet-400' },
  { key: 'O', colorClass: 'text-slate-600 dark:text-slate-300' },
];

export const HisabCard: React.FC<HisabCardProps> = ({
  account,
  upToDate,
  monthStart,
  monthEnd,
  calculation,
  readOnlyFinance,
  readOnlyHint,
  onChangeUpToDate,
  onChangeSalary,
  onShareLedger,
}) => {
  const {
    counts,
    totalWorkingDays,
    workingDaysUpToDate,
    unmarkedDays,
    payableDays,
    salary,
    perDayRate,
    grossEarned,
    totalAdvance,
    totalPayment,
    openingBalance,
    netBalance,
    lastKnownSalary,
  } = calculation;

  const hasCarryForward = Math.round(openingBalance) !== 0;
  const showTotalRow =
    salary > 0 || hasCarryForward || totalAdvance > 0 || totalPayment > 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-slate-900 dark:text-white">
            {account.name} का हिसाब
          </h2>
          <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
            {formatDisplayDate(upToDate)} तक
          </span>
        </div>
        <button
          type="button"
          onClick={onShareLedger}
          className="inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>शेयर</span>
        </button>
      </div>

      {/* Date Filter */}
      <div className="mt-3">
        <label
          htmlFor="hisab-upto-date"
          className="block text-xs text-slate-500 dark:text-slate-400"
        >
          तारीख बदलकर उस तारीख तक का हिसाब देखें
        </label>
        <input
          id="hisab-upto-date"
          type="date"
          value={upToDate}
          min={monthStart}
          max={monthEnd}
          onChange={(e) => {
            if (e.target.value) onChangeUpToDate(e.target.value);
          }}
          className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono-num text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      {/* 5-Column Summary Strip */}
      <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">
        {STAT_KEYS.map(({ key, colorClass }) => (
          <div
            key={key}
            className="rounded-xl bg-slate-50 px-1 py-2.5 text-center dark:bg-slate-800/80"
          >
            <div className={`font-mono-num text-xl font-bold ${colorClass}`}>
              {counts[key]}
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {STATUS_META[key].label}
            </div>
          </div>
        ))}
      </div>

      {/* Salary Input */}
      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="monthly-salary-input"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            महीने की सैलरी (₹)
          </label>
          {readOnlyFinance ? (
            <span className="text-[11px] font-medium text-slate-400">
              {readOnlyHint || 'केवल Owner बदल सकते हैं'}
            </span>
          ) : (
            salary === 0 &&
            lastKnownSalary > 0 && (
              <button
                type="button"
                onClick={() => onChangeSalary(lastKnownSalary)}
                className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                पिछली सैलरी ({formatRs(lastKnownSalary)}) लागू करें
              </button>
            )
          )}
        </div>
        <input
          id="monthly-salary-input"
          type="number"
          inputMode="decimal"
          value={salary || ''}
          readOnly={Boolean(readOnlyFinance)}
          placeholder={readOnlyFinance ? 'Owner द्वारा सेट होगी' : 'जैसे 12000'}
          onChange={(e) => {
            if (!readOnlyFinance) {
              onChangeSalary(parseFloat(e.target.value) || 0);
            }
          }}
          className={`mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 px-3 py-2 font-mono-num text-sm font-semibold focus:outline-none dark:border-slate-700 ${
            readOnlyFinance
              ? 'cursor-not-allowed bg-slate-100 text-slate-500 dark:bg-slate-800/40 dark:text-slate-400'
              : 'bg-slate-50 text-slate-900 focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100'
          }`}
        />
      </div>

      {/* Calculation Breakdown */}
      <div className="mt-4 divide-y divide-dashed divide-slate-200 text-sm dark:divide-slate-700/80">
        {hasCarryForward && (
          <div className="flex items-center justify-between gap-2 py-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {openingBalance > 0
                ? 'पिछला बाकी (Carry Forward)'
                : 'पिछला एडवांस / बकाया (Carry Forward)'}
            </span>
            <span
              className={`font-mono-num font-semibold ${
                openingBalance > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {openingBalance > 0
                ? `+ ${formatRs(openingBalance)}`
                : `− ${formatRs(Math.abs(openingBalance))}`}
            </span>
          </div>
        )}

        {salary > 0 && (
          <>
            <div className="flex items-center justify-between gap-2 py-2">
              <span className="text-slate-600 dark:text-slate-300">
                महीने की सैलरी (÷ {totalWorkingDays} दिन)
              </span>
              <span className="font-mono-num font-medium text-slate-900 dark:text-slate-100">
                {formatRs(salary)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 py-2">
              <span className="text-slate-600 dark:text-slate-300">
                {workingDaysUpToDate} दिन (रविवार छोड़कर) × {formatRs(perDayRate)}
              </span>
              <span className="font-mono-num font-medium text-slate-900 dark:text-slate-100">
                {formatRs(perDayRate * workingDaysUpToDate)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 py-2">
              <span className="text-slate-600 dark:text-slate-300">
                Absent {counts.A} दिन × {formatRs(perDayRate)}
              </span>
              <span className="font-mono-num font-medium text-red-600 dark:text-red-400">
                − {formatRs(perDayRate * counts.A)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 py-2">
              <span className="text-slate-600 dark:text-slate-300">
                Leave {counts.L} + Half {counts.H} + बिना entry {unmarkedDays} दिन
              </span>
              <span className="font-mono-num font-medium text-red-600 dark:text-red-400">
                − {formatRs(perDayRate * (counts.L + counts.H * 0.5 + unmarkedDays))}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 py-2">
              <span className="text-slate-700 dark:text-slate-200">
                इस महीने की कमाई ({payableDays} दिन)
              </span>
              <span className="font-mono-num font-semibold text-slate-900 dark:text-white">
                {formatRs(grossEarned)}
              </span>
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-2 py-2">
          <span className="text-slate-600 dark:text-slate-300">Advance लिया</span>
          <span className="font-mono-num font-medium text-red-600 dark:text-red-400">
            − {formatRs(totalAdvance)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 py-2">
          <span className="text-slate-600 dark:text-slate-300">Payment मिली</span>
          <span className="font-mono-num font-medium text-emerald-600 dark:text-emerald-400">
            − {formatRs(totalPayment)}
          </span>
        </div>

        {showTotalRow && (
          <div className="flex items-center justify-between gap-2 pt-3 pb-1 text-base font-bold">
            <span className="text-slate-900 dark:text-white">
              {hasCarryForward
                ? 'कुल बाकी (पिछले हिसाब सहित)'
                : 'बाकी (इस तारीख तक)'}
            </span>
            <span
              className={`font-mono-num ${
                netBalance < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-indigo-600 dark:text-indigo-400'
              }`}
            >
              {formatRs(netBalance)}
            </span>
          </div>
        )}

        {salary === 0 && (
          <p className="pt-3 text-center text-xs text-slate-500 dark:text-slate-400">
            सैलरी भरो तो इस महीने की कमाई भी जुड़ जाएगी
          </p>
        )}
      </div>
    </section>
  );
};
