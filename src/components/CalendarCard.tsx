import React from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Account, AttendanceStatus, ShopRole } from '../types';
import {
  MONTH_NAMES,
  MONTH_NAMES_HI,
  WEEKDAYS,
  getEffectiveStatus,
  getHolidayName,
  hasMoneyOnDate,
  makeDateKey,
} from '../utils/hazri';

interface CalendarCardProps {
  account: Account;
  year: number;
  monthIndex: number;
  todayKey: string;
  cloudRole?: ShopRole | null;
  readOnlyAttendance?: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (dateKey: string) => void;
  onMarkTodayPresent: () => void;
}

const STATUS_TILE_STYLES: Record<Exclude<AttendanceStatus, ''>, string> = {
  P: 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:border-emerald-500',
  A: 'bg-red-600 border-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:border-red-500',
  L: 'bg-amber-600 border-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:border-amber-500',
  H: 'bg-violet-600 border-violet-600 text-white hover:bg-violet-700 dark:bg-violet-600 dark:border-violet-500',
  O: 'bg-slate-500 border-slate-500 text-white hover:bg-slate-600 dark:bg-slate-600 dark:border-slate-500',
};

const SELF_PENDING_STYLES: Record<Exclude<AttendanceStatus, ''>, string> = {
  P: 'border-dashed border-2 border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-200',
  A: 'border-dashed border-2 border-red-600 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-400 dark:bg-red-950/60 dark:text-red-200',
  L: 'border-dashed border-2 border-amber-600 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-400 dark:bg-amber-950/60 dark:text-amber-200',
  H: 'border-dashed border-2 border-violet-600 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-400 dark:bg-violet-950/60 dark:text-violet-200',
  O: 'border-dashed border-2 border-slate-500 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-400 dark:bg-slate-800 dark:text-slate-200',
};

export const CalendarCard: React.FC<CalendarCardProps> = ({
  account,
  year,
  monthIndex,
  todayKey,
  cloudRole,
  readOnlyAttendance,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  onMarkTodayPresent,
}) => {
  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells: Array<{ day: number; key: string; dow: number } | null> = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      key: makeDateKey(year, monthIndex, d),
      dow: new Date(year, monthIndex, d).getDay(),
    });
  }

  const isStaffMode = cloudRole === 'staff';
  const todayEntry = account.days[todayKey];
  const todaySelfEntry = account.selfDays?.[todayKey];
  const isTodayPresent = isStaffMode
    ? todayEntry?.s === 'P' || todaySelfEntry?.s === 'P'
    : todayEntry?.s === 'P';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      {/* Month Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="पिछला महीना"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="text-center">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            {MONTH_NAMES[monthIndex]} {year}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {MONTH_NAMES_HI[monthIndex]} {year}
          </p>
        </div>

        <button
          type="button"
          onClick={onNextMonth}
          aria-label="अगला महीना"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAYS.map((w, idx) => (
          <div
            key={w}
            className={`py-1 text-center text-xs font-semibold ${
              idx === 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const hasOfficialEntry = Boolean(account.days[cell.key]?.s);
          const selfStatus = account.selfDays?.[cell.key]?.s || '';
          const isSelfPending = !hasOfficialEntry && Boolean(selfStatus);
          const status = hasOfficialEntry
            ? account.days[cell.key].s
            : selfStatus || getEffectiveStatus(account, cell.key, cell.dow);

          const isToday = cell.key === todayKey;
          const hasMoney = hasMoneyOnDate(account, cell.key);
          const holiday = getHolidayName(cell.key);
          const hasNote = Boolean(
            account.days[cell.key]?.n || account.selfDays?.[cell.key]?.n
          );

          const tileStyle = isSelfPending && status
            ? SELF_PENDING_STYLES[status]
            : status
              ? STATUS_TILE_STYLES[status]
              : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 dark:bg-slate-800/70 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800';

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelectDate(cell.key)}
              title={
                isSelfPending
                  ? 'Staff द्वारा स्वयं लगाई गई हाज़िरी (Owner की पुष्टि बाकी)'
                  : holiday || undefined
              }
              className={`relative flex aspect-square min-h-[44px] flex-col items-center justify-center rounded-xl border p-1 transition-all duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-indigo-600 ${tileStyle} ${
                isToday
                  ? 'ring-2 ring-indigo-600 ring-offset-2 ring-offset-white dark:ring-indigo-400 dark:ring-offset-slate-900'
                  : ''
              }`}
            >
              {hasMoney && (
                <span
                  aria-label="लेन-देन दर्ज है"
                  className={`absolute top-1 right-1.5 font-mono-num text-[10px] font-bold ${
                    status && !isSelfPending
                      ? 'text-white/95'
                      : 'text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  ₹
                </span>
              )}
              {hasNote && (
                <span
                  aria-hidden="true"
                  className={`absolute top-1.5 left-1.5 h-1.5 w-1.5 rounded-full ${
                    status && !isSelfPending ? 'bg-white/80' : 'bg-indigo-500'
                  }`}
                />
              )}
              <span className="font-mono-num text-sm font-semibold leading-none sm:text-base">
                {cell.day}
              </span>
              <span className="mt-1 text-[11px] font-bold leading-none">
                {status === 'O' ? 'छु' : status || '·'}
                {isSelfPending ? '·स्व' : ''}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
          Present (P)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-red-600" />
          Absent (A)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-amber-600" />
          Leave (L)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-violet-600" />
          Half Leave (H)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-slate-500" />
          छुट्टी (रविवार/त्योहार)
        </span>
        {cloudRole && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs border border-dashed border-emerald-600 bg-emerald-100 dark:bg-emerald-950" />
            स्वयं (Self Marked)
          </span>
        )}
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {isStaffMode
          ? 'आप अपनी खुद की हाज़िरी (Self) लगा सकते हैं। सैलरी हिसाब Owner की पक्की हाज़िरी से जुड़ता है।'
          : 'रविवार और सरकारी छुट्टी अपने आप \'छुट्टी\' दिखती है। उस दिन काम किया हो तो तारीख पर टैप करके Present लगा दें।'}
      </p>

      {/* Primary Quick Action */}
      {readOnlyAttendance && !isStaffMode ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-center text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          हाज़िरी बदलने का अधिकार सीमित है — Owner से Manager अनुमतियाँ अपडेट कराएं।
        </div>
      ) : (
        <button
          type="button"
          onClick={onMarkTodayPresent}
          className={`mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-emerald-600 ${
            isTodayPresent
              ? 'bg-emerald-700 hover:bg-emerald-800'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          <CheckCircle2 className="h-5 w-5" />
          <span>
            {isStaffMode
              ? isTodayPresent
                ? 'आज मेरी हाज़िरी लग चुकी है (Self)'
                : 'आज मेरी हाज़िरी लगाओ (Self)'
              : isTodayPresent
                ? 'आज Present लग चुकी है'
                : 'आज Present लगाओ'}
          </span>
        </button>
      )}
    </section>
  );
};
