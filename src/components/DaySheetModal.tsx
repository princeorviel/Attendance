import React, { useEffect, useState } from 'react';
import { Clock, MapPin, X } from 'lucide-react';
import {
  Account,
  AttendanceStatus,
  ShopRequestDoc,
  ShopRole,
} from '../types';
import {
  STATUS_META,
  formatDisplayDate,
  getEffectiveStatus,
  getHolidayName,
  getMoneySumForDate,
} from '../utils/hazri';

interface DaySheetModalProps {
  dateKey: string | null;
  account: Account;
  cloudRole?: ShopRole | null;
  canMarkAttendance?: boolean;
  canManageMoney?: boolean;
  daySelfRequest?: ShopRequestDoc;
  onClose: () => void;
  onSaveStatus: (
    dateKey: string,
    status: AttendanceStatus,
    note: string,
    advance: number,
    payment: number
  ) => void;
  onSaveNoteAndMoneyOnly: (
    dateKey: string,
    note: string,
    advance: number,
    payment: number
  ) => void;
  onClearMoney: (dateKey: string) => void;
  onClearStatus: (dateKey: string) => void;
}

const STATUS_BUTTONS: Array<{
  code: Exclude<AttendanceStatus, ''>;
  label: string;
  classes: string;
}> = [
  {
    code: 'P',
    label: 'Present',
    classes: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  {
    code: 'A',
    label: 'Absent',
    classes: 'bg-red-600 hover:bg-red-700 text-white',
  },
  {
    code: 'L',
    label: 'Leave',
    classes: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  {
    code: 'H',
    label: 'Half Leave',
    classes: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
  {
    code: 'O',
    label: 'छुट्टी',
    classes: 'bg-slate-600 hover:bg-slate-700 text-white col-span-2',
  },
];

export const DaySheetModal: React.FC<DaySheetModalProps> = ({
  dateKey,
  account,
  cloudRole,
  canMarkAttendance,
  canManageMoney,
  daySelfRequest,
  onClose,
  onSaveStatus,
  onSaveNoteAndMoneyOnly,
  onClearMoney,
  onClearStatus,
}) => {
  const [note, setNote] = useState('');
  const [advance, setAdvance] = useState('');
  const [payment, setPayment] = useState('');

  const isStaffMode = cloudRole === 'staff';
  const allowAttendance = isStaffMode || (canMarkAttendance ?? true);
  const allowMoney = !isStaffMode && (canManageMoney ?? true);

  useEffect(() => {
    if (!dateKey) return;
    const entry = isStaffMode
      ? account.selfDays?.[dateKey] || account.days[dateKey]
      : account.days[dateKey];
    setNote(entry?.n || '');
    const adv = getMoneySumForDate(account, dateKey, 'adv');
    const pay = getMoneySumForDate(account, dateKey, 'pay');
    setAdvance(adv ? String(adv) : '');
    setPayment(pay ? String(pay) : '');
  }, [dateKey, account, isStaffMode]);

  if (!dateKey) return null;

  const dw = new Date(`${dateKey}T00:00:00`).getDay();
  const effectiveStatus = getEffectiveStatus(account, dateKey, dw);
  const officialEntry = account.days[dateKey];
  const selfEntry = account.selfDays?.[dateKey];
  const holidayName =
    getHolidayName(dateKey) || (dw === 0 ? 'रविवार' : '');

  const inTime =
    selfEntry?.inTime || daySelfRequest?.inTime || officialEntry?.inTime || '';
  const outTime =
    selfEntry?.outTime ||
    daySelfRequest?.outTime ||
    officialEntry?.outTime ||
    '';
  const gps =
    selfEntry?.gps || daySelfRequest?.gps || officialEntry?.gps || '';
  const selfie = daySelfRequest?.selfie || '';
  const showSelfBanner = Boolean(selfEntry?.s || daySelfRequest || inTime || gps);

  const advVal = parseFloat(advance) || 0;
  const payVal = parseFloat(payment) || 0;

  const footerBtnCount =
    1 + (allowMoney ? 1 : 0) + (allowAttendance ? 1 : 0);
  const footerGridClass =
    footerBtnCount === 3
      ? 'grid-cols-3'
      : footerBtnCount === 2
        ? 'grid-cols-2'
        : 'grid-cols-1';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 pb-safe shadow-2xl sm:rounded-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-mono-num text-base font-bold text-slate-900 dark:text-white">
              {formatDisplayDate(dateKey)}
              {effectiveStatus
                ? ` — ${STATUS_META[effectiveStatus].label}`
                : ''}
            </h3>
            {effectiveStatus === 'O' && holidayName && (
              <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                {holidayName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="बंद करें"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Self-attendance & Punch metadata banner */}
        {showSelfBanner && (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-xs text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            {selfie && (
              <img
                src={selfie}
                alt="Selfie punch"
                referrerPolicy="no-referrer"
                className="h-12 w-12 shrink-0 rounded-lg border border-emerald-200 object-cover dark:border-emerald-800"
              />
            )}
            <div className="min-w-0 flex-1 space-y-1">
              {(selfEntry?.s || daySelfRequest) && (
                <div>
                  <strong>स्टाफ़ स्वयं हाज़िरी (Self):</strong>{' '}
                  {STATUS_META[
                    selfEntry?.s || daySelfRequest?.requestedStatus || 'P'
                  ]?.label ||
                    selfEntry?.s ||
                    daySelfRequest?.requestedStatus}
                  {(selfEntry?.n || daySelfRequest?.reason)
                    ? ` — ${selfEntry?.n || daySelfRequest?.reason}`
                    : ''}
                </div>
              )}
              {(inTime || outTime) && (
                <div className="flex flex-wrap items-center gap-2 font-mono-num text-[11px] text-emerald-800 dark:text-emerald-300">
                  <Clock className="h-3 w-3 shrink-0" />
                  {inTime && <span>In: {inTime}</span>}
                  {outTime && <span>· Out: {outTime}</span>}
                </div>
              )}
              {gps && (
                <div className="flex items-center gap-1 font-mono-num text-[11px] text-emerald-800 dark:text-emerald-300">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{gps}</span>
                </div>
              )}
              {!isStaffMode && !officialEntry?.s && allowAttendance && (
                <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  नीचे बटन दबाकर इसे Official हाज़िरी के रूप में पक्का करें।
                </div>
              )}
            </div>
          </div>
        )}

        {isStaffMode && (
          <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-[11px] text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
            आप <strong>अपनी खुद की हाज़िरी (Self Attendance)</strong> लगा रहे हैं। Advance/Payment और Official हाज़िरी Owner/Manager जोड़ते हैं।
          </div>
        )}

        {!allowAttendance && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            आपकी Manager अनुमतियों में हाज़िरी बदलना बंद है — केवल Owner या अधिकृत Manager बदलाव कर सकते हैं।
          </div>
        )}

        {/* Status Selection Buttons */}
        {allowAttendance && (
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {STATUS_BUTTONS.map((btn) => (
              <button
                key={btn.code}
                type="button"
                onClick={() =>
                  onSaveStatus(
                    dateKey,
                    btn.code,
                    note.trim(),
                    allowMoney ? advVal : 0,
                    allowMoney ? payVal : 0
                  )
                }
                className={`min-h-[48px] rounded-xl px-4 py-3 text-sm font-semibold transition-transform active:scale-[0.98] ${btn.classes}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}

        {/* Advance & Payment Inputs (Owner / authorized Manager or Local only) */}
        {allowMoney && (
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Advance (₹)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={advance}
                onChange={(e) => setAdvance(e.target.value)}
                placeholder="0"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono-num text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Payment (₹)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
                placeholder="0"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono-num text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        )}

        {(allowAttendance || allowMoney) && (
          <div className="mt-2.5">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="नोट (optional)"
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        )}

        {!isStaffMode && (allowMoney || allowAttendance) && (
          <button
            type="button"
            onClick={() =>
              onSaveNoteAndMoneyOnly(
                dateKey,
                note.trim(),
                allowMoney ? advVal : 0,
                allowMoney ? payVal : 0
              )
            }
            className="mt-3 min-h-[46px] w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            {allowMoney ? 'सिर्फ़ Advance / नोट सेव करो' : 'सिर्फ़ नोट सेव करो'}
          </button>
        )}

        <div className={`mt-2.5 grid gap-2 pb-2 ${footerGridClass}`}>
          {allowMoney && (
            <button
              type="button"
              onClick={() => onClearMoney(dateKey)}
              className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Advance हटाओ
            </button>
          )}
          {allowAttendance && (
            <button
              type="button"
              onClick={() => onClearStatus(dateKey)}
              className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {isStaffMode ? 'Self Status हटाओ' : 'Status हटाओ'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            बंद करो
          </button>
        </div>
      </div>
    </div>
  );
};
