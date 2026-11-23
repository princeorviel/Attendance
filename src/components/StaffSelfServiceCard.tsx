import React, { useState } from 'react';
import {
  CalendarPlus,
  Camera,
  Check,
  Clock,
  FileText,
  MapPin,
  Trash2,
  X,
} from 'lucide-react';
import {
  Account,
  ManagerPermissions,
  ShopRequestDoc,
  ShopRole,
} from '../types';
import {
  MonthCalculation,
  STATUS_META,
  formatDisplayDate,
  formatRs,
  formatTimeShort,
  resizePunchSelfie,
} from '../utils/hazri';

interface StaffSelfServiceCardProps {
  role: ShopRole;
  permissions: ManagerPermissions;
  account: Account;
  calculation: MonthCalculation;
  todayKey: string;
  requests: ShopRequestDoc[];
  onPunchIn: (payload: {
    requestedStatus: 'P' | 'H';
    inTime: string;
    gps: string;
    selfie: string;
    reason: string;
  }) => Promise<void>;
  onPunchOut: (requestId: string, outTime: string, gps: string) => Promise<void>;
  onSubmitLeave: (payload: {
    fromDate: string;
    toDate: string;
    requestedStatus: 'L' | 'H';
    reason: string;
  }) => Promise<void>;
  onReviewRequest: (
    req: ShopRequestDoc,
    decision: 'approved' | 'rejected',
    reviewNote?: string
  ) => Promise<void>;
  onDeleteRequest: (requestId: string) => Promise<void>;
  onShareLedger: () => void;
}

export const StaffSelfServiceCard: React.FC<StaffSelfServiceCardProps> = ({
  role,
  permissions,
  account,
  calculation,
  todayKey,
  requests,
  onPunchIn,
  onPunchOut,
  onSubmitLeave,
  onReviewRequest,
  onDeleteRequest,
  onShareLedger,
}) => {
  const isStaff = role === 'staff';
  const [punchStatus, setPunchStatus] = useState<'P' | 'H'>('P');
  const [punchNote, setPunchNote] = useState('');
  const [selfie, setSelfie] = useState('');
  const [gps, setGps] = useState('');
  const [gpsStatus, setGpsStatus] = useState('');
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveFrom, setLeaveFrom] = useState(todayKey);
  const [leaveTo, setLeaveTo] = useState(todayKey);
  const [leaveType, setLeaveType] = useState<'L' | 'H'>('L');
  const [leaveReason, setLeaveReason] = useState('');
  const [busyId, setBusyId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3500);
  };

  const captureGpsLocation = (): Promise<string> =>
    new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setGpsStatus('GPS उपलब्ध नहीं');
        resolve('');
        return;
      }
      setGpsStatus('लोकेशन ले रहे हैं…');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coord = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
          setGps(coord);
          setGpsStatus(`लोकेशन दर्ज: ${coord}`);
          resolve(coord);
        },
        () => {
          setGpsStatus('लोकेशन अनुमति नहीं मिली');
          resolve('');
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
      );
    });

  const handleSelfieSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const thumb = await resizePunchSelfie(file);
      setSelfie(thumb);
      showNotice('Selfie फोटो तैयार है');
    } catch {
      showNotice('Selfie पढ़ी नहीं जा सकी');
    }
  };

  const todayPunchReq = requests.find(
    (r) =>
      r.type === 'punch' &&
      r.fromDate === todayKey &&
      r.staffId === account.id
  );
  const todaySelf = account.selfDays?.[todayKey];
  const todayOfficial = account.days[todayKey];
  const isPunchedInToday = Boolean(
    todayPunchReq || todaySelf?.s || todayOfficial?.s
  );
  const effectiveInTime =
    todayPunchReq?.inTime || todaySelf?.inTime || todayOfficial?.inTime || '';
  const effectiveOutTime =
    todayPunchReq?.outTime ||
    todaySelf?.outTime ||
    todayOfficial?.outTime ||
    '';

  const handlePunchInSubmit = async () => {
    setBusyId('punch_in');
    try {
      const finalGps = gps || (await captureGpsLocation());
      const nowTime = formatTimeShort();
      await onPunchIn({
        requestedStatus: punchStatus,
        inTime: nowTime,
        gps: finalGps,
        selfie,
        reason: punchNote.trim(),
      });
      setPunchNote('');
      setSelfie('');
      showNotice(`Punch In दर्ज हो गया (${nowTime})`);
    } finally {
      setBusyId('');
    }
  };

  const handlePunchOutSubmit = async () => {
    if (!todayPunchReq || todayPunchReq.status !== 'pending') return;
    setBusyId('punch_out');
    try {
      const finalGps = gps || '';
      const nowTime = formatTimeShort();
      await onPunchOut(todayPunchReq.requestId, nowTime, finalGps);
      showNotice(`Punch Out दर्ज हो गया (${nowTime})`);
    } finally {
      setBusyId('');
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveFrom) return;
    setBusyId('leave');
    try {
      await onSubmitLeave({
        fromDate: leaveFrom,
        toDate: leaveTo >= leaveFrom ? leaveTo : leaveFrom,
        requestedStatus: leaveType,
        reason: leaveReason.trim() || 'छुट्टी अनुरोध',
      });
      setLeaveReason('');
      setShowLeaveForm(false);
      showNotice('छुट्टी का अनुरोध भेज दिया गया');
    } finally {
      setBusyId('');
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const displayedRequests = showAllHistory
    ? requests
    : isStaff
      ? requests.slice(0, 5)
      : pendingRequests;

  // Owner / Manager view: show only when there are requests (pending or toggleable history)
  if (!isStaff) {
    if (requests.length === 0) return null;

    return (
      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Staff Self-Service अनुरोध
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {pendingRequests.length > 0
                ? `${pendingRequests.length} अनुरोध मंज़ूरी के लिए बाकी हैं`
                : 'सभी स्टाफ़ अनुरोध निपटाए जा चुके हैं'}
            </p>
          </div>
          {requests.length > pendingRequests.length && (
            <button
              type="button"
              onClick={() => setShowAllHistory((v) => !v)}
              className="min-h-[36px] whitespace-nowrap shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {showAllHistory
                ? `सिर्फ़ Pending (${pendingRequests.length})`
                : `पूरा इतिहास (${requests.length})`}
            </button>
          )}
        </div>

        {!permissions.canApproveRequests && pendingRequests.length > 0 && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            आपकी Manager अनुमतियों में अनुरोध मंज़ूर करने का अधिकार बंद है — केवल Owner या अधिकृत Manager मंज़ूरी दे सकते हैं।
          </p>
        )}

        {displayedRequests.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            कोई लंबित Self-Punch या Leave अनुरोध नहीं है।
          </div>
        ) : (
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {displayedRequests.map((req) => {
              const isPending = req.status === 'pending';
              const dateRangeLabel =
                req.fromDate === req.toDate
                  ? formatDisplayDate(req.fromDate)
                  : `${formatDisplayDate(req.fromDate)} – ${formatDisplayDate(req.toDate)}`;
              return (
                <div
                  key={req.requestId}
                  className="flex flex-col gap-2.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {req.selfie && (
                      <img
                        src={req.selfie}
                        alt={`${req.staffName} selfie`}
                        referrerPolicy="no-referrer"
                        className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 object-cover dark:border-slate-700"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                        <span>{req.staffName}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                          {req.type === 'punch'
                            ? `Self Punch (${STATUS_META[req.requestedStatus]?.label || req.requestedStatus})`
                            : `Leave (${STATUS_META[req.requestedStatus]?.label || req.requestedStatus})`}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono-num text-xs text-slate-500 dark:text-slate-400">
                        <span>{dateRangeLabel}</span>
                        {req.inTime && <span>· In: {req.inTime}</span>}
                        {req.outTime && <span>· Out: {req.outTime}</span>}
                      </div>
                      {req.gps && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="font-mono-num">{req.gps}</span>
                        </div>
                      )}
                      {req.reason && (
                        <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                          {req.reason}
                        </p>
                      )}
                      {!isPending && (
                        <p
                          className={`mt-1 text-xs font-semibold ${
                            req.status === 'approved'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {req.status === 'approved'
                            ? `मंज़ूर (${req.reviewedByName || 'Owner'})`
                            : `अस्वीकृत (${req.reviewedByName || 'Owner'})`}
                          {req.reviewNote ? ` · ${req.reviewNote}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {isPending && permissions.canApproveRequests && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === req.requestId}
                        onClick={async () => {
                          setBusyId(req.requestId);
                          try {
                            await onReviewRequest(req, 'approved');
                          } finally {
                            setBusyId('');
                          }
                        }}
                        className="inline-flex min-h-[38px] items-center gap-1 whitespace-nowrap rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>मंज़ूर</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyId === req.requestId}
                        onClick={async () => {
                          setBusyId(req.requestId);
                          try {
                            await onReviewRequest(req, 'rejected');
                          } finally {
                            setBusyId('');
                          }
                        }}
                        className="inline-flex min-h-[38px] items-center gap-1 whitespace-nowrap rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>अस्वीकार</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  // Staff Self-Service Dashboard Hub
  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Staff Self-Service — {account.name}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            अपनी हाज़िरी Punch करें, छुट्टी मांगें और सैलरी/पेमेंट हिसाब देखें
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLeaveForm((v) => !v)}
            className="inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            <span>{showLeaveForm ? 'फार्म बंद करें' : 'छुट्टी मांगें'}</span>
          </button>
          <button
            type="button"
            onClick={onShareLedger}
            className="inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Payslip / रिपोर्ट</span>
          </button>
        </div>
      </div>

      {/* 4-Column Personal Payroll Snapshot */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/80">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Present / Payable
          </div>
          <div className="mt-0.5 font-mono-num text-base font-bold text-slate-900 dark:text-white">
            {calculation.counts.P} / {calculation.payableDays} दिन
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/80">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            महीने की कमाई
          </div>
          <div className="mt-0.5 font-mono-num text-base font-bold text-emerald-600 dark:text-emerald-400">
            {formatRs(calculation.grossEarned)}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/80">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Advance + Payment
          </div>
          <div className="mt-0.5 font-mono-num text-base font-bold text-slate-900 dark:text-white">
            {formatRs(calculation.totalAdvance + calculation.totalPayment)}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/80">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            बाकी सैलरी (Net)
          </div>
          <div
            className={`mt-0.5 font-mono-num text-base font-bold ${
              calculation.netBalance < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-indigo-600 dark:text-indigo-400'
            }`}
          >
            {formatRs(calculation.netBalance)}
          </div>
        </div>
      </div>

      {/* Today's Punch-In / Punch-Out Controls */}
      <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
        {!isPunchedInToday ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>आज ({formatDisplayDate(todayKey)}) की Punch-In हाज़िरी</span>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setPunchStatus('P')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    punchStatus === 'P'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Full Day (P)
                </button>
                <button
                  type="button"
                  onClick={() => setPunchStatus('H')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    punchStatus === 'H'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Half Day (H)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Camera className="h-4 w-4" />
                <span>{selfie ? 'Selfie बदलें ✓' : 'Selfie जोड़ें'}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleSelfieSelect}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => void captureGpsLocation()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <MapPin className="h-4 w-4" />
                <span>{gps ? 'GPS दर्ज ✓' : 'GPS लोकेशन लें'}</span>
              </button>

              {selfie && (
                <img
                  src={selfie}
                  alt="Selfie preview"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                />
              )}

              <input
                type="text"
                value={punchNote}
                onChange={(e) => setPunchNote(e.target.value)}
                placeholder="शिफ्ट / कार्य नोट (optional)"
                className="min-h-[40px] flex-1 min-w-[160px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />

              <button
                type="button"
                disabled={busyId === 'punch_in'}
                onClick={() => void handlePunchInSubmit()}
                className="inline-flex min-h-[40px] whitespace-nowrap shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                <span>{busyId === 'punch_in' ? 'दर्ज हो रहा…' : 'Punch In करें'}</span>
              </button>
            </div>
            {gpsStatus && (
              <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                {gpsStatus}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {todayPunchReq?.selfie && (
                <img
                  src={todayPunchReq.selfie}
                  alt="Today punch selfie"
                  referrerPolicy="no-referrer"
                  className="h-11 w-11 rounded-xl border border-slate-200 object-cover dark:border-slate-700"
                />
              )}
              <div>
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  आज की हाज़िरी दर्ज है{' '}
                  {todayOfficial?.s
                    ? '(Owner द्वारा पक्की ✓)'
                    : '(मंज़ूरी बाकी)'}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono-num text-xs text-slate-500 dark:text-slate-400">
                  {effectiveInTime && <span>In: {effectiveInTime}</span>}
                  {effectiveOutTime && <span>· Out: {effectiveOutTime}</span>}
                  {(todayPunchReq?.gps || todaySelf?.gps) && (
                    <span>· GPS: {todayPunchReq?.gps || todaySelf?.gps}</span>
                  )}
                </div>
              </div>
            </div>

            {todayPunchReq &&
              todayPunchReq.status === 'pending' &&
              !effectiveOutTime && (
                <button
                  type="button"
                  disabled={busyId === 'punch_out'}
                  onClick={() => void handlePunchOutSubmit()}
                  className="inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {busyId === 'punch_out' ? 'सेव हो रहा…' : 'Punch Out दर्ज करें'}
                  </span>
                </button>
              )}
          </div>
        )}
      </div>

      {/* Leave Application Form */}
      {showLeaveForm && (
        <form
          onSubmit={handleLeaveSubmit}
          className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800"
        >
          <div className="text-xs font-bold text-slate-900 dark:text-white">
            छुट्टी का आवेदन भेजें (Leave Request)
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                कब से (From)
              </label>
              <input
                type="date"
                value={leaveFrom}
                onChange={(e) => {
                  setLeaveFrom(e.target.value);
                  if (e.target.value > leaveTo) setLeaveTo(e.target.value);
                }}
                required
                className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono-num text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                कब तक (To)
              </label>
              <input
                type="date"
                value={leaveTo}
                min={leaveFrom}
                onChange={(e) => setLeaveTo(e.target.value)}
                required
                className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono-num text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                प्रकार
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as 'L' | 'H')}
                className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="L">Full Day Leave (L)</option>
                <option value="H">Half Day Leave (H)</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              placeholder="छुट्टी का कारण (जैसे: घर पर ज़रूरी काम)"
              required
              className="min-h-[40px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="submit"
              disabled={busyId === 'leave'}
              className="min-h-[40px] whitespace-nowrap shrink-0 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {busyId === 'leave' ? 'भेज रहे हैं…' : 'आवेदन भेजें'}
            </button>
          </div>
        </form>
      )}

      {feedback && (
        <p className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {feedback}
        </p>
      )}

      {/* Staff Requests History */}
      {requests.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              मेरे Punch व छुट्टी अनुरोध ({requests.length})
            </span>
            {requests.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllHistory((v) => !v)}
                className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {showAllHistory ? 'कम देखें' : 'सभी देखें'}
              </button>
            )}
          </div>
          <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {displayedRequests.map((req) => {
              const dateLabel =
                req.fromDate === req.toDate
                  ? formatDisplayDate(req.fromDate)
                  : `${formatDisplayDate(req.fromDate)} – ${formatDisplayDate(req.toDate)}`;
              return (
                <div
                  key={req.requestId}
                  className="flex items-center justify-between gap-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                      <span>
                        {req.type === 'punch' ? 'Self Punch' : 'Leave Request'}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-mono-num">{dateLabel}</span>
                      {req.inTime && (
                        <span className="font-mono-num text-slate-500 dark:text-slate-400">
                          ({req.inTime}
                          {req.outTime ? `–${req.outTime}` : ''})
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {req.status === 'pending' && 'Owner / Manager की मंज़ूरी बाकी'}
                      {req.status === 'approved' &&
                        `मंज़ूर ✓ (${req.reviewedByName || 'Owner'})`}
                      {req.status === 'rejected' &&
                        `अस्वीकृत (${req.reviewedByName || 'Owner'})`}
                      {req.reason ? ` · ${req.reason}` : ''}
                    </div>
                  </div>
                  {req.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => void onDeleteRequest(req.requestId)}
                      aria-label="अनुरोध रद्द करें"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
