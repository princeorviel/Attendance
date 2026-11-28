import React, { useEffect, useRef, useState } from 'react';
import {
  CalendarOff,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  Sun,
  X,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
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

interface StatusButtonConfig {
  code: Exclude<AttendanceStatus, ''>;
  label: string;
  activeBg: string;
  inactiveClasses: string;
  badgeClasses: string;
  ringColor: string;
  colSpan?: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const STATUS_BUTTONS: StatusButtonConfig[] = [
  {
    code: 'P',
    label: 'Present',
    activeBg: 'bg-emerald-600 shadow-emerald-600/25',
    inactiveClasses:
      'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/80 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-300 dark:hover:bg-emerald-950/60',
    badgeClasses:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300',
    ringColor: 'ring-emerald-400/50',
    Icon: CheckCircle2,
  },
  {
    code: 'A',
    label: 'Absent',
    activeBg: 'bg-red-600 shadow-red-600/25',
    inactiveClasses:
      'border-red-200 bg-red-50/70 text-red-800 hover:bg-red-100/80 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-300 dark:hover:bg-red-950/60',
    badgeClasses:
      'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300',
    ringColor: 'ring-red-400/50',
    Icon: XCircle,
  },
  {
    code: 'L',
    label: 'Leave',
    activeBg: 'bg-amber-600 shadow-amber-600/25',
    inactiveClasses:
      'border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100/80 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-300 dark:hover:bg-amber-950/60',
    badgeClasses:
      'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300',
    ringColor: 'ring-amber-400/50',
    Icon: CalendarOff,
  },
  {
    code: 'H',
    label: 'Half Leave',
    activeBg: 'bg-violet-600 shadow-violet-600/25',
    inactiveClasses:
      'border-violet-200 bg-violet-50/70 text-violet-800 hover:bg-violet-100/80 dark:border-violet-900/70 dark:bg-violet-950/35 dark:text-violet-300 dark:hover:bg-violet-950/60',
    badgeClasses:
      'bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300',
    ringColor: 'ring-violet-400/50',
    Icon: Clock,
  },
  {
    code: 'O',
    label: 'छुट्टी',
    activeBg: 'bg-slate-600 shadow-slate-600/25',
    inactiveClasses:
      'border-slate-200 bg-slate-100/80 text-slate-700 hover:bg-slate-200/70 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800',
    badgeClasses:
      'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    ringColor: 'ring-slate-400/50',
    colSpan: 'col-span-2',
    Icon: Sun,
  },
];

const STATUS_BUTTON_MAP = Object.fromEntries(
  STATUS_BUTTONS.map((btn) => [btn.code, btn])
) as Record<Exclude<AttendanceStatus, ''>, StatusButtonConfig>;

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
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('');
  const saveTimerRef = useRef<number | null>(null);
  const onSaveStatusRef = useRef(onSaveStatus);
  onSaveStatusRef.current = onSaveStatus;

  const isStaffMode = cloudRole === 'staff';
  const allowAttendance = isStaffMode || (canMarkAttendance ?? true);
  const allowMoney = !isStaffMode && (canManageMoney ?? true);

  const clearPendingTimer = () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  };

  useEffect(() => {
    clearPendingTimer();
    if (!dateKey) {
      setSelectedStatus('');
      return;
    }
    const dw = new Date(`${dateKey}T00:00:00`).getDay();
    const initialStatus = isStaffMode
      ? account.selfDays?.[dateKey]?.s || getEffectiveStatus(account, dateKey, dw)
      : getEffectiveStatus(account, dateKey, dw);
    setSelectedStatus(initialStatus);

    const entry = isStaffMode
      ? account.selfDays?.[dateKey] || account.days[dateKey]
      : account.days[dateKey];
    setNote(entry?.n || '');
    const adv = getMoneySumForDate(account, dateKey, 'adv');
    const pay = getMoneySumForDate(account, dateKey, 'pay');
    setAdvance(adv ? String(adv) : '');
    setPayment(pay ? String(pay) : '');

    return () => clearPendingTimer();
    // Only reset when the opened date or account changes — never cancel a pending save on background re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, account.id, isStaffMode]);

  const dw = dateKey ? new Date(`${dateKey}T00:00:00`).getDay() : 0;
  const officialEntry = dateKey ? account.days[dateKey] : undefined;
  const selfEntry = dateKey ? account.selfDays?.[dateKey] : undefined;
  const holidayName = dateKey
    ? getHolidayName(dateKey) || (dw === 0 ? 'रविवार' : '')
    : '';

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

  const handleSelectStatus = (code: Exclude<AttendanceStatus, ''>) => {
    if (!dateKey) return;
    clearPendingTimer();
    setSelectedStatus(code);

    const noteVal = note.trim();
    const nextAdv = allowMoney ? advVal : 0;
    const nextPay = allowMoney ? payVal : 0;

    // Brief spring-settle delay so smooth visual feedback completes before saving & closing
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      onSaveStatusRef.current(dateKey, code, noteVal, nextAdv, nextPay);
    }, 220);
  };

  const handleCloseSheet = () => {
    clearPendingTimer();
    onClose();
  };

  const activeStatusBadge = selectedStatus
    ? STATUS_BUTTON_MAP[selectedStatus]
    : null;

  return (
    <AnimatePresence>
      {dateKey && (
        <motion.div
          key="day-sheet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={handleCloseSheet}
        >
          <motion.div
            key={`day-sheet-${dateKey}`}
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 pb-safe shadow-2xl sm:rounded-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-mono-num text-base font-bold text-slate-900 dark:text-white">
                    {formatDisplayDate(dateKey)}
                  </h3>
                  {selectedStatus && activeStatusBadge && (
                    <motion.span
                      key={selectedStatus}
                      initial={{ opacity: 0, y: -4, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold ${activeStatusBadge.badgeClasses}`}
                    >
                      <activeStatusBadge.Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{STATUS_META[selectedStatus].label}</span>
                    </motion.span>
                  )}
                </div>
                {selectedStatus === 'O' && holidayName && (
                  <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {holidayName}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleCloseSheet}
                aria-label="बंद करें"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
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
                      {selfEntry?.n || daySelfRequest?.reason
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

            {/* Animated Status Toggle Buttons (Framer Motion) */}
            {allowAttendance && (
              <LayoutGroup id={`day-status-${dateKey}`}>
                <div
                  role="radiogroup"
                  aria-label="हाज़िरी स्टेटस चुनें"
                  className="mt-4 grid grid-cols-2 gap-2.5"
                >
                  {STATUS_BUTTONS.map((btn) => {
                    const isSelected = selectedStatus === btn.code;
                    const StatusIcon = btn.Icon;

                    return (
                      <motion.button
                        key={btn.code}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        whileHover={{ scale: 1.015 }}
                        whileTap={{ scale: 0.96 }}
                        animate={{ scale: isSelected ? 1.02 : 1 }}
                        transition={{
                          type: 'spring',
                          stiffness: 460,
                          damping: 28,
                        }}
                        onClick={() => handleSelectStatus(btn.code)}
                        className={`relative flex min-h-[50px] items-center justify-center gap-2 overflow-hidden rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                          btn.colSpan || ''
                        } ${
                          isSelected
                            ? `border-transparent text-white ring-2 ${btn.ringColor}`
                            : btn.inactiveClasses
                        }`}
                      >
                        {isSelected && (
                          <motion.span
                            layoutId="day-status-active-bg"
                            transition={{
                              type: 'spring',
                              stiffness: 440,
                              damping: 32,
                            }}
                            className={`absolute inset-0 rounded-xl shadow-md ${btn.activeBg}`}
                          />
                        )}

                        <span className="relative z-10 flex items-center gap-2">
                          <motion.span
                            animate={{ scale: isSelected ? 1.12 : 1 }}
                            transition={{
                              type: 'spring',
                              stiffness: 500,
                              damping: 26,
                            }}
                            className="flex items-center justify-center"
                          >
                            <StatusIcon className="h-4 w-4 shrink-0" />
                          </motion.span>
                          <span>{btn.label}</span>
                        </span>

                        {isSelected && (
                          <motion.span
                            key={`check-${btn.code}`}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              type: 'spring',
                              stiffness: 520,
                              damping: 24,
                            }}
                            className="relative z-10 ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-white"
                          >
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </motion.span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </LayoutGroup>
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
                onClick={() => {
                  clearPendingTimer();
                  onSaveNoteAndMoneyOnly(
                    dateKey,
                    note.trim(),
                    allowMoney ? advVal : 0,
                    allowMoney ? payVal : 0
                  );
                }}
                className="mt-3 min-h-[46px] w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                {allowMoney ? 'सिर्फ़ Advance / नोट सेव करो' : 'सिर्फ़ नोट सेव करो'}
              </button>
            )}

            <div className={`mt-2.5 grid gap-2 pb-2 ${footerGridClass}`}>
              {allowMoney && (
                <button
                  type="button"
                  onClick={() => {
                    clearPendingTimer();
                    onClearMoney(dateKey);
                  }}
                  className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Advance हटाओ
                </button>
              )}
              {allowAttendance && (
                <button
                  type="button"
                  onClick={() => {
                    clearPendingTimer();
                    setSelectedStatus('');
                    onClearStatus(dateKey);
                  }}
                  className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {isStaffMode ? 'Self Status हटाओ' : 'Status हटाओ'}
                </button>
              )}
              <button
                type="button"
                onClick={handleCloseSheet}
                className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                बंद करो
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
