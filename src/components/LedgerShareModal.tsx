import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  FileSpreadsheet,
  FileText,
  Printer,
  Send,
  Share2,
  Store,
  X,
} from 'lucide-react';
import { Account } from '../types';
import {
  MONTH_NAMES,
  buildAccountLedgerCsv,
  buildLedgerStatementText,
  calculateMonthSummary,
  formatDisplayDate,
  formatRs,
  makeDateKey,
  makeYearMonthKey,
} from '../utils/hazri';
import { generateLedgerPdfBlob } from '../utils/pdfLedger';

export interface InAppShareRecipient {
  staffId: string;
  name: string;
  roleLabel: string;
  uid: string;
  email: string;
}

interface LedgerShareModalProps {
  isOpen: boolean;
  account: Account;
  year: number;
  monthIndex: number;
  upToDate: string;
  todayKey: string;
  inAppShareContext?: {
    isCloudActive: boolean;
    recipients: InAppShareRecipient[];
    onSendToStaff: (
      recipient: InAppShareRecipient,
      title: string,
      summaryText: string
    ) => Promise<void>;
    onOpenShopTeam: () => void;
  };
  onClose: () => void;
}

export const LedgerShareModal: React.FC<LedgerShareModalProps> = ({
  isOpen,
  account,
  year,
  monthIndex,
  upToDate,
  todayKey,
  inAppShareContext,
  onClose,
}) => {
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [inAppSending, setInAppSending] = useState(false);

  const recipients = inAppShareContext?.recipients || [];

  useEffect(() => {
    if (!isOpen) return;
    setStatusMsg('');
    if (recipients.length > 0) {
      const matched = recipients.find((r) => r.staffId === account.id);
      setSelectedStaffId(matched ? matched.staffId : recipients[0].staffId);
    } else {
      setSelectedStaffId('');
    }
  }, [isOpen, account.id, recipients.length]);

  const statementText = useMemo(() => {
    if (!isOpen) return '';
    return buildLedgerStatementText(
      account,
      year,
      monthIndex,
      upToDate,
      todayKey,
      scope
    );
  }, [isOpen, account, year, monthIndex, upToDate, todayKey, scope]);

  const monthCalc = useMemo(() => {
    if (!isOpen) return null;
    return calculateMonthSummary(
      account,
      year,
      monthIndex,
      upToDate,
      todayKey
    );
  }, [isOpen, account, year, monthIndex, upToDate, todayKey]);

  const allMonthsRows = useMemo(() => {
    if (!isOpen || scope !== 'all') return { months: [], total: 0, entries: [] };
    const ymSet = new Set<string>();
    Object.keys(account.days).forEach((k) => {
      const ym = k.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) ymSet.add(ym);
    });
    account.money.forEach((m) => {
      const ym = m.d.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) ymSet.add(ym);
    });
    Object.entries(account.sal).forEach(([ym, val]) => {
      if (/^\d{4}-\d{2}$/.test(ym) && val > 0) ymSet.add(ym);
    });
    ymSet.add(makeYearMonthKey(year, monthIndex));

    const sorted = Array.from(ymSet).sort();
    let running = 0;
    const months = sorted.map((ym) => {
      const [yStr, mStr] = ym.split('-');
      const py = Number(yStr);
      const pm = Number(mStr) - 1;
      const dim = new Date(py, pm + 1, 0).getDate();
      const mStart = makeDateKey(py, pm, 1);
      const mEnd = makeDateKey(py, pm, dim);
      const mUpTo =
        mEnd <= todayKey ? mEnd : mStart <= todayKey ? todayKey : mEnd;
      const calc = calculateMonthSummary(account, py, pm, mUpTo, todayKey);
      running += calc.monthNet;
      return {
        label: `${MONTH_NAMES[pm].slice(0, 3)} ${py}`,
        counts: calc.counts,
        gross: calc.grossEarned,
        adv: calc.totalAdvance,
        pay: calc.totalPayment,
        running,
      };
    });
    const entries = [...account.money].sort((a, b) => (a.d > b.d ? 1 : -1));
    return { months, total: running, entries };
  }, [isOpen, scope, account, year, monthIndex, todayKey]);

  if (!isOpen) return null;

  const safeFileName = (account.name || 'account')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-');
  const pdfFileName = `${safeFileName}-ledger-${
    scope === 'month' ? makeYearMonthKey(year, monthIndex) : 'all'
  }.pdf`;

  const showTempStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3500);
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(statementText);
      setCopied(true);
      showTempStatus('लेजर विवरण कॉपी हो गया');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showTempStatus('कृपया टेक्स्ट चुनकर कॉपी करें');
    }
  };

  const handleShareDocument = async () => {
    setBusy(true);
    try {
      const pdfBlob = generateLedgerPdfBlob(
        account,
        year,
        monthIndex,
        upToDate,
        todayKey,
        scope
      );
      const pdfFile = new File([pdfBlob], pdfFileName, {
        type: 'application/pdf',
      });

      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };

      if (nav.share && nav.canShare && nav.canShare({ files: [pdfFile] })) {
        try {
          await nav.share({
            files: [pdfFile],
            title: `${account.name} — Account Ledger`,
            text: statementText,
          });
          return;
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') return;
        }
      }

      // Fallback when browser/iframe does not support file attachment sharing
      triggerDownload(pdfBlob, pdfFileName);
      try {
        await navigator.clipboard.writeText(statementText);
        showTempStatus('PDF फ़ाइल डाउनलोड हो गई और विवरण कॉपी हो गया');
      } catch {
        showTempStatus('PDF फ़ाइल डाउनलोड हो गई — अब शेयर कर सकते हैं');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadPdf = () => {
    setBusy(true);
    try {
      const pdfBlob = generateLedgerPdfBlob(
        account,
        year,
        monthIndex,
        upToDate,
        todayKey,
        scope
      );
      triggerDownload(pdfBlob, pdfFileName);
      showTempStatus('PDF Document डाउनलोड हो गया');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadCsv = () => {
    const csv = buildAccountLedgerCsv(
      account,
      year,
      monthIndex,
      upToDate,
      todayKey,
      scope
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, `${safeFileName}-ledger-${scope}.csv`);
    showTempStatus('CSV फ़ाइल डाउनलोड हो गई');
  };

  const handlePrintDocument = () => {
    const pdfBlob = generateLedgerPdfBlob(
      account,
      year,
      monthIndex,
      upToDate,
      todayKey,
      scope
    );
    const blobUrl = URL.createObjectURL(pdfBlob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        triggerDownload(pdfBlob, pdfFileName);
      }
      setTimeout(() => {
        iframe.remove();
        URL.revokeObjectURL(blobUrl);
      }, 4000);
    };
    document.body.appendChild(iframe);
  };

  const monthEntries = monthCalc
    ? monthCalc.monthMoney
        .filter((m) => m.d <= upToDate)
        .sort((a, b) => (a.d > b.d ? 1 : -1))
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 pb-safe shadow-2xl sm:rounded-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" />

        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Account Ledger Document
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="बंद करें"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scope Selector */}
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setScope('month')}
            className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              scope === 'month'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            इस महीने का हिसाब
          </button>
          <button
            type="button"
            onClick={() => setScope('all')}
            className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              scope === 'all'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            पूरा अकाउंट लेजर
          </button>
        </div>

        {/* Styled A4-like Document Preview */}
        <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-inner dark:border-slate-700">
          <div className="border-t-4 border-indigo-600 pt-2.5">
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div>
                <div className="text-sm font-bold text-slate-900">
                  {account.name}
                </div>
                {(account.ph || account.em) && (
                  <div className="text-[11px] text-slate-500">
                    {[account.ph, account.em].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold tracking-wider text-indigo-700">
                  ACCOUNT LEDGER
                </div>
                <div className="font-mono-num text-[11px] text-slate-600">
                  {scope === 'month'
                    ? `${MONTH_NAMES[monthIndex]} ${year} (${formatDisplayDate(upToDate)} तक)`
                    : `पूरा लेजर (${formatDisplayDate(todayKey)} तक)`}
                </div>
              </div>
            </div>

            {scope === 'month' && monthCalc ? (
              <div className="mt-3 space-y-3 text-xs">
                <div className="grid grid-cols-5 gap-1 text-center">
                  <div className="rounded-lg bg-emerald-50 py-1.5">
                    <div className="font-mono-num font-bold text-emerald-700">
                      {monthCalc.counts.P}
                    </div>
                    <div className="text-[10px] text-slate-600">Present</div>
                  </div>
                  <div className="rounded-lg bg-red-50 py-1.5">
                    <div className="font-mono-num font-bold text-red-700">
                      {monthCalc.counts.A}
                    </div>
                    <div className="text-[10px] text-slate-600">Absent</div>
                  </div>
                  <div className="rounded-lg bg-amber-50 py-1.5">
                    <div className="font-mono-num font-bold text-amber-700">
                      {monthCalc.counts.L}
                    </div>
                    <div className="text-[10px] text-slate-600">Leave</div>
                  </div>
                  <div className="rounded-lg bg-violet-50 py-1.5">
                    <div className="font-mono-num font-bold text-violet-700">
                      {monthCalc.counts.H}
                    </div>
                    <div className="text-[10px] text-slate-600">Half</div>
                  </div>
                  <div className="rounded-lg bg-slate-100 py-1.5">
                    <div className="font-mono-num font-bold text-slate-700">
                      {monthCalc.counts.O}
                    </div>
                    <div className="text-[10px] text-slate-600">छुट्टी</div>
                  </div>
                </div>

                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 px-3">
                  {Math.round(monthCalc.openingBalance) !== 0 && (
                    <div className="flex justify-between py-1.5">
                      <span>पिछला हिसाब (Carry Forward)</span>
                      <span
                        className={`font-mono-num font-semibold ${
                          monthCalc.openingBalance > 0
                            ? 'text-emerald-700'
                            : 'text-red-600'
                        }`}
                      >
                        {monthCalc.openingBalance > 0
                          ? `+ ${formatRs(monthCalc.openingBalance)}`
                          : `− ${formatRs(Math.abs(monthCalc.openingBalance))}`}
                      </span>
                    </div>
                  )}
                  {monthCalc.salary > 0 && (
                    <>
                      <div className="flex justify-between py-1.5">
                        <span>महीने की सैलरी</span>
                        <span className="font-mono-num">
                          {formatRs(monthCalc.salary)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span>कमाई ({monthCalc.payableDays} दिन)</span>
                        <span className="font-mono-num font-semibold">
                          {formatRs(monthCalc.grossEarned)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between py-1.5">
                    <span>Advance लिया</span>
                    <span className="font-mono-num text-red-600">
                      − {formatRs(monthCalc.totalAdvance)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span>Payment मिली</span>
                    <span className="font-mono-num text-emerald-700">
                      − {formatRs(monthCalc.totalPayment)}
                    </span>
                  </div>
                  <div className="flex justify-between bg-indigo-50/70 px-1 py-2 font-bold">
                    <span>कुल बाकी</span>
                    <span className="font-mono-num text-indigo-700">
                      {formatRs(monthCalc.netBalance)}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="mb-1 font-bold text-slate-800">
                    Advance / Payment एंट्री ({monthEntries.length})
                  </div>
                  {monthEntries.length === 0 ? (
                    <div className="text-[11px] text-slate-500">
                      इस महीने कोई लेन-देन एंट्री नहीं
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 text-left text-slate-600">
                          <th className="p-1.5">तारीख</th>
                          <th className="p-1.5">प्रकार</th>
                          <th className="p-1.5">नोट</th>
                          <th className="p-1.5 text-right">रकम</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {monthEntries.map((m) => (
                          <tr key={m.id}>
                            <td className="p-1.5 font-mono-num">
                              {formatDisplayDate(m.d)}
                            </td>
                            <td
                              className={`p-1.5 font-semibold ${
                                m.t === 'adv'
                                  ? 'text-red-600'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {m.t === 'adv' ? 'Advance' : 'Payment'}
                            </td>
                            <td className="p-1.5 text-slate-500">
                              {m.n || '—'}
                            </td>
                            <td className="p-1.5 text-right font-mono-num font-semibold">
                              {formatRs(m.a)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-3 text-xs">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-left text-slate-600">
                      <th className="p-1.5">महीना</th>
                      <th className="p-1.5 text-right">कमाई</th>
                      <th className="p-1.5 text-right">Adv</th>
                      <th className="p-1.5 text-right">Pay</th>
                      <th className="p-1.5 text-right">बाकी</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {allMonthsRows.months.map((row) => (
                      <tr key={row.label}>
                        <td className="p-1.5 font-semibold">{row.label}</td>
                        <td className="p-1.5 text-right font-mono-num">
                          {formatRs(row.gross)}
                        </td>
                        <td className="p-1.5 text-right font-mono-num text-red-600">
                          {formatRs(row.adv)}
                        </td>
                        <td className="p-1.5 text-right font-mono-num text-emerald-700">
                          {formatRs(row.pay)}
                        </td>
                        <td className="p-1.5 text-right font-mono-num font-bold text-indigo-700">
                          {formatRs(row.running)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-between rounded-lg bg-indigo-50 px-3 py-2 font-bold">
                  <span>मौजूदा कुल बाकी</span>
                  <span className="font-mono-num text-indigo-700">
                    {formatRs(allMonthsRows.total)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {statusMsg && (
          <p className="mt-2 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {statusMsg}
          </p>
        )}

        {/* Direct In-App Staff Send */}
        {inAppShareContext && (
          <div className="mt-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3 dark:border-indigo-900 dark:bg-indigo-950/40">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                <Send className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>इसी App में Staff को भेजें (In-App Send)</span>
              </div>
              {inAppShareContext.isCloudActive && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    inAppShareContext.onOpenShopTeam();
                  }}
                  className="text-[11px] font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
                >
                  Inbox देखें →
                </button>
              )}
            </div>

            {inAppShareContext.isCloudActive ? (
              recipients.length > 0 ? (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="min-h-[40px] flex-1 rounded-xl border border-indigo-200 bg-white px-3 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-800 dark:bg-slate-900 dark:text-white"
                  >
                    {recipients.map((r) => (
                      <option key={r.staffId} value={r.staffId}>
                        {r.name} ({r.roleLabel})
                        {r.uid ? ' · ऐप से जुड़ा है' : ` · ${r.email}`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={inAppSending}
                    onClick={async () => {
                      const target =
                        recipients.find((r) => r.staffId === selectedStaffId) ||
                        recipients[0];
                      if (!target) return;
                      setInAppSending(true);
                      try {
                        const title = `${account.name} — ${
                          scope === 'month'
                            ? `${MONTH_NAMES[monthIndex]} ${year}`
                            : 'पूरा लेजर'
                        } हिसाब`;
                        await inAppShareContext.onSendToStaff(
                          target,
                          title,
                          statementText
                        );
                        showTempStatus(
                          `✓ ${target.name} को इसी App में भेज दिया गया`
                        );
                      } catch (err) {
                        showTempStatus(
                          (err as Error)?.message || 'App में नहीं भेजा जा सका'
                        );
                      } finally {
                        setInAppSending(false);
                      }
                    }}
                    className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{inAppSending ? 'भेज रहे हैं…' : 'App में भेजें'}</span>
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    सीधे App में भेजने के लिए Staff का Gmail जोड़ें या उन्हें Shop Code से जोड़ें।
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      inAppShareContext.onOpenShopTeam();
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    <Store className="h-3.5 w-3.5" />
                    <span>Shop टीम खोलें</span>
                  </button>
                </div>
              )
            ) : (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Staff को यहीं App के अंदर हिसाब भेजने के लिए Shop Team चालू करें।
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    inAppShareContext.onOpenShopTeam();
                  }}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <Store className="h-3.5 w-3.5" />
                  <span>App में भेजने के लिए खोलें</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Primary Share CTA (Shares PDF Document + Text Together) */}
        <button
          type="button"
          disabled={busy}
          onClick={handleShareDocument}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          <Share2 className="h-4 w-4" />
          <span>Document शेयर / डाउनलोड करें (PDF + विवरण)</span>
        </button>

        {/* Secondary Document Export Actions */}
        <div className="mt-2.5 grid grid-cols-4 gap-2 pb-1">
          <button
            type="button"
            disabled={busy}
            onClick={handleDownloadPdf}
            className="inline-flex min-h-[42px] items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <FileText className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={handlePrintDocument}
            className="inline-flex min-h-[42px] items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>प्रिंट</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex min-h-[42px] items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex min-h-[42px] items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>कॉपी</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>कॉपी</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
