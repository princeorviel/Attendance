import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-react';
import { Account } from '../types';
import {
  disableEncryptionWithPasscode,
  rotateRecoveryKeyForAccount,
  sealAccountWithNewPasscode,
} from '../utils/cryptoVault';

interface SecurityModalProps {
  isOpen: boolean;
  account: Account;
  masterKeyBytes?: Uint8Array;
  onClose: () => void;
  onUpdateSealedAccount: (
    updatedAccount: Account,
    newMasterKeyBytes?: Uint8Array
  ) => void;
  onLockNow: (accountId: string) => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  isOpen,
  account,
  masterKeyBytes,
  onClose,
  onUpdateSealedAccount,
  onLockNow,
}) => {
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [disablePasscode, setDisablePasscode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [autoLock, setAutoLock] = useState<boolean>(
    Boolean(account.e2ee?.autoLock)
  );
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showDisableBox, setShowDisableBox] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPasscode('');
    setConfirmPasscode('');
    setDisablePasscode('');
    setGeneratedRecoveryKey('');
    setShowDisableBox(false);
    setFeedback(null);
    setAutoLock(Boolean(account.e2ee?.autoLock));
  }, [isOpen, account.id, account.e2ee?.autoLock]);

  if (!isOpen) return null;

  const isEncrypted = Boolean(account.e2ee?.enabled);

  const handleEnableOrUpdateEncryption = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (passcode.trim().length < 4) {
      setFeedback({
        type: 'err',
        msg: 'Passcode कम से कम 4 अक्षर या अंक का रखें',
      });
      return;
    }
    if (passcode.trim() !== confirmPasscode.trim()) {
      setFeedback({
        type: 'err',
        msg: 'दोनों Passcode एक जैसे नहीं हैं',
      });
      return;
    }

    setBusy(true);
    try {
      const { sealedAccount, masterKeyBytes: mk, recoveryKeyFormatted } =
        await sealAccountWithNewPasscode(account, passcode, autoLock);
      onUpdateSealedAccount(sealedAccount, mk);
      setGeneratedRecoveryKey(recoveryKeyFormatted);
      setPasscode('');
      setConfirmPasscode('');
      setFeedback({
        type: 'ok',
        msg: 'AES-256-GCM End-to-End Encryption चालू हो गया!',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: (err as Error)?.message || 'Encryption सेट नहीं हो सका',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRotateRecovery = async () => {
    if (!masterKeyBytes) return;
    setBusy(true);
    setFeedback(null);
    try {
      const { updatedAccount, recoveryKeyFormatted } =
        await rotateRecoveryKeyForAccount(account, masterKeyBytes);
      onUpdateSealedAccount(updatedAccount, masterKeyBytes);
      setGeneratedRecoveryKey(recoveryKeyFormatted);
      setFeedback({
        type: 'ok',
        msg: 'नई 64-अंकों की Recovery Key तैयार हो गई',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: (err as Error)?.message || 'Recovery Key नहीं बन सकी',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAutoLock = (checked: boolean) => {
    setAutoLock(checked);
    if (account.e2ee?.enabled) {
      onUpdateSealedAccount(
        {
          ...account,
          e2ee: {
            ...account.e2ee,
            autoLock: checked,
          },
        },
        masterKeyBytes
      );
    }
  };

  const handleDisableEncryption = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const unsealed = await disableEncryptionWithPasscode(
        account,
        disablePasscode
      );
      onUpdateSealedAccount(unsealed, undefined);
      setShowDisableBox(false);
      setDisablePasscode('');
      setGeneratedRecoveryKey('');
      setFeedback({
        type: 'ok',
        msg: 'Passcode Lock हटा दिया गया है',
      });
    } catch {
      setFeedback({
        type: 'err',
        msg: 'Passcode गलत है — Lock नहीं हटाया जा सका',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCopyRecovery = async () => {
    if (!generatedRecoveryKey) return;
    try {
      await navigator.clipboard.writeText(generatedRecoveryKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleDownloadRecoveryTxt = () => {
    if (!generatedRecoveryKey) return;
    const text = [
      `Attendance — End-to-End Encryption Recovery Key`,
      `Account: ${account.name}`,
      `Safety Code: ${account.e2ee?.fingerprint || ''}`,
      ``,
      `64-Char Recovery Key (इसे किसी के साथ शेयर न करें):`,
      generatedRecoveryKey,
      ``,
      `चेतावनी: Passcode भूल जाने पर केवल इसी Key से आपका डेटा अनलॉक होगा।`,
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${account.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-recovery-key.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="End-to-End Encryption सुरक्षा"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 pb-safe shadow-2xl sm:rounded-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isEncrypted ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            )}
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              End-to-End Encryption सुरक्षा
            </h3>
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

        {/* Status Card */}
        <div
          className={`mt-3 rounded-2xl border p-3.5 text-xs ${
            isEncrypted
              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
              : 'border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
          }`}
        >
          <div className="font-bold">
            {isEncrypted
              ? `🔒 ${account.name} — AES-256-GCM Encrypted`
              : `🔓 ${account.name} पर Passcode Lock सेट नहीं है`}
          </div>
          <p className="mt-1 leading-relaxed opacity-90">
            {isEncrypted
              ? 'इस खाते की हाज़िरी, सैलरी, लेन-देन और नंबर ज़ीरो-नॉलेज एन्क्रिप्शन से सुरक्षित हैं। बिना Passcode या Recovery Key के कोई दूसरा यूज़र इन्हें पढ़, बदल या डिलीट नहीं कर सकता।'
              : 'Signal और WhatsApp की तरह अपने खाते पर Passcode Lock लगाएं ताकि कोई भी दूसरा व्यक्ति या यूज़र आपका डेटा देख या इस्तेमाल न कर पाए।'}
          </p>
        </div>

        {/* Safety Code / Verification Fingerprint */}
        {isEncrypted && account.e2ee?.fingerprint && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              सुरक्षा कोड (Safety Number — SHA-256)
            </div>
            <div className="mt-1.5 font-mono text-xs tracking-wider text-slate-800 leading-relaxed dark:text-slate-200">
              {account.e2ee.fingerprint}
            </div>
          </div>
        )}

        {/* Newly Generated 64-char Recovery Key Alert */}
        {generatedRecoveryKey && (
          <div className="mt-3 rounded-2xl border-2 border-indigo-500 bg-indigo-50 p-3.5 dark:border-indigo-400 dark:bg-indigo-950/50">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
              <KeyRound className="h-4 w-4 shrink-0" />
              <span>आपकी 64-अंकों की Recovery Key (इसे अभी सुरक्षित रखें)</span>
            </div>
            <p className="mt-1 text-[11px] text-indigo-800 dark:text-indigo-300">
              Passcode भूल जाने पर केवल इसी Key से आपका एन्क्रिप्टेड डेटा खुलेगा। इसे किसी दूसरे को न दें।
            </p>
            <div className="mt-2 rounded-lg border border-indigo-200 bg-white p-2.5 font-mono text-[11px] font-semibold tracking-wide text-slate-900 break-all dark:border-indigo-800 dark:bg-slate-900 dark:text-slate-100">
              {generatedRecoveryKey}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyRecovery}
                className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                {copiedKey ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>कॉपी हुआ</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Key कॉपी करें</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadRecoveryTxt}
                className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:bg-slate-900 dark:text-indigo-300"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Key सेव (.txt)</span>
              </button>
            </div>
          </div>
        )}

        {feedback && (
          <p
            className={`mt-3 text-xs font-semibold ${
              feedback.type === 'ok'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {feedback.msg}
          </p>
        )}

        {/* Quick Actions when already encrypted */}
        {isEncrypted && (
          <div className="mt-3 space-y-2.5">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  Auto-Lock (टैब बदलने पर लॉक)
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  ऐप से बाहर जाते ही डेटा फिर से सील हो जाएगा
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoLock}
                onChange={(e) => handleToggleAutoLock(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLockNow(account.id);
                }}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>अभी लॉक करें</span>
              </button>

              <button
                type="button"
                disabled={busy || !masterKeyBytes}
                onClick={handleRotateRecovery}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>नई Recovery Key</span>
              </button>
            </div>
          </div>
        )}

        {/* Set / Change Passcode Form */}
        <form
          onSubmit={handleEnableOrUpdateEncryption}
          className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800"
        >
          <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
            {isEncrypted
              ? 'नया Passcode बदलें (नई Encryption Key के साथ)'
              : 'Encryption Passcode / PIN सेट करें'}
          </div>

          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              autoComplete="new-password"
              maxLength={24}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="नया Passcode / PIN (कम से कम 4 अंक या शब्द)"
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label="Passcode दिखाएं/छुपाएं"
              className="absolute top-1/2 right-2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              {showPass ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <input
            type={showPass ? 'text' : 'password'}
            autoComplete="new-password"
            maxLength={24}
            value={confirmPasscode}
            onChange={(e) => setConfirmPasscode(e.target.value)}
            placeholder="Passcode दोबारा डालें"
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />

          <button
            type="submit"
            disabled={busy}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>
              {busy
                ? 'Encrypt हो रहा है…'
                : isEncrypted
                  ? 'Passcode व Encryption अपडेट करें'
                  : 'Encryption Lock चालू करें'}
            </span>
          </button>
        </form>

        {/* Disable E2EE Section */}
        {isEncrypted && (
          <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            {!showDisableBox ? (
              <button
                type="button"
                onClick={() => setShowDisableBox(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
              >
                <Unlock className="h-3.5 w-3.5" />
                <span>Passcode Lock हटाएं</span>
              </button>
            ) : (
              <form onSubmit={handleDisableEncryption} className="space-y-2">
                <input
                  type="password"
                  value={disablePasscode}
                  onChange={(e) => setDisablePasscode(e.target.value)}
                  placeholder="Lock हटाने के लिए मौजूदा Passcode डालें"
                  className="min-h-[40px] w-full rounded-xl border border-red-200 bg-red-50/40 px-3 py-2 text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-red-900 dark:bg-red-950/30 dark:text-slate-100"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDisableBox(false)}
                    className="min-h-[38px] flex-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    रद्द करें
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[38px] flex-1 rounded-lg bg-red-600 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    Lock हटाएं
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
