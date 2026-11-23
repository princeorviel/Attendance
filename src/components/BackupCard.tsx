import React, { useRef, useState } from 'react';
import {
  ClipboardPaste,
  Copy,
  Download,
  Lock,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { RootState } from '../types';
import {
  decryptBackupPayload,
  encryptBackupPayload,
  isEncryptedBackupString,
} from '../utils/cryptoVault';
import { normalizeAccount } from '../utils/hazri';

interface BackupCardProps {
  rootState: RootState;
  sessionMasterKeys: Record<string, Uint8Array>;
  onRestore: (newState: RootState) => void;
}

export const BackupCard: React.FC<BackupCardProps> = ({
  rootState,
  sessionMasterKeys,
  onRestore,
}) => {
  const [text, setText] = useState('');
  const [backupPassword, setBackupPassword] = useState('');
  const [pendingEncryptedRaw, setPendingEncryptedRaw] = useState<string | null>(
    null
  );
  const [decryptPass, setDecryptPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showFeedback = (type: 'ok' | 'err', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const buildEncryptedOrFail = async (): Promise<string | null> => {
    if (backupPassword.trim().length < 4) {
      showFeedback(
        'err',
        'Encrypted Backup के लिए कम से कम 4 अंक/अक्षर का पासवर्ड डालें'
      );
      return null;
    }
    return encryptBackupPayload(rootState, backupPassword, sessionMasterKeys);
  };

  const handleMakeBackup = async () => {
    setBusy(true);
    try {
      const payload = await buildEncryptedOrFail();
      if (!payload) return;
      setText(payload);
      try {
        await navigator.clipboard.writeText(payload);
        showFeedback('ok', 'AES-256 Encrypted Backup बन गया और कॉपी भी हो गया');
      } catch {
        showFeedback('ok', 'Encrypted Backup नीचे तैयार है — सुरक्षित कॉपी कर लें');
      }
    } catch (err) {
      showFeedback('err', (err as Error)?.message || 'Backup नहीं बन सका');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadBackup = async () => {
    setBusy(true);
    try {
      const payload = await buildEncryptedOrFail();
      if (!payload) return;
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `attendance-e2ee-backup-${stamp}.mhenc`;
      a.click();
      URL.revokeObjectURL(url);
      showFeedback('ok', 'Encrypted Backup फ़ाइल (.mhenc) डाउनलोड हो गई');
    } catch (err) {
      showFeedback('err', (err as Error)?.message || 'Backup फ़ाइल नहीं बन सकी');
    } finally {
      setBusy(false);
    }
  };

  const finishRestoreParsed = (parsed: RootState) => {
    const normalizedAccts = parsed.accts.map((a, i) =>
      normalizeAccount(a, `a${i + 1}`)
    );
    const curExists = normalizedAccts.some((a) => a.id === parsed.cur);
    onRestore({
      cur: curExists ? parsed.cur : normalizedAccts[0].id,
      accts: normalizedAccts,
    });
    setText('');
    setPendingEncryptedRaw(null);
    setDecryptPass('');
    showFeedback('ok', 'सारा डेटा सफलतापूर्वक Restore हो गया');
  };

  const tryRestore = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      showFeedback('err', 'कृपया पहले Backup डेटा या फ़ाइल चुनें');
      return;
    }

    if (isEncryptedBackupString(trimmed)) {
      const candidatePass = decryptPass.trim() || backupPassword.trim();
      if (!candidatePass) {
        setPendingEncryptedRaw(trimmed);
        showFeedback(
          'err',
          'यह Encrypted Backup है — अनलॉक करने के लिए पासवर्ड डालें'
        );
        return;
      }
      setBusy(true);
      try {
        const decrypted = await decryptBackupPayload(trimmed, candidatePass);
        finishRestoreParsed(decrypted);
      } catch {
        setPendingEncryptedRaw(trimmed);
        showFeedback('err', 'Backup पासवर्ड गलत है — Decrypt नहीं हो सका');
      } finally {
        setBusy(false);
      }
      return;
    }

    // Backward-compatible legacy unencrypted JSON backup restore
    try {
      const parsed = JSON.parse(trimmed) as RootState;
      if (!parsed || !Array.isArray(parsed.accts) || parsed.accts.length === 0) {
        throw new Error('Invalid');
      }
      finishRestoreParsed(parsed);
    } catch {
      setText('');
      showFeedback('err', 'Backup सही नहीं है, कृपया सही डेटा पेस्ट करें');
    }
  };

  const handleDecryptPending = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingEncryptedRaw) return;
    setBusy(true);
    try {
      const decrypted = await decryptBackupPayload(
        pendingEncryptedRaw,
        decryptPass
      );
      finishRestoreParsed(decrypted);
    } catch {
      showFeedback('err', 'Backup पासवर्ड गलत है');
    } finally {
      setBusy(false);
    }
  };

  const handleClipboardRestore = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) {
        showFeedback('err', 'क्लिपबोर्ड खाली है — पहले Backup कॉपी करें');
        return;
      }
      setText(clip);
      await tryRestore(clip);
    } catch {
      showFeedback(
        'err',
        'बॉक्स में लंबा दबाकर Paste करें, फिर Restore दबाएं'
      );
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        void tryRestore(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Encrypted Backup व Restore
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={handleDownloadBackup}
            title="Encrypted Backup फ़ाइल (.mhenc) डाउनलोड करें"
            className="inline-flex min-h-[36px] items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            <span>फ़ाइल</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            title="Backup फ़ाइल (.mhenc / .json) से Restore करें"
            className="inline-flex min-h-[36px] items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>लोड</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mhenc,.json,application/json"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        WhatsApp E2EE जैसा पासवर्ड-लॉक्ड बैकअप — बिना पासवर्ड के कोई आपकी फ़ाइल पढ़ नहीं सकता।
      </p>

      <div className="mt-2.5 relative">
        <Lock className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="password"
          value={backupPassword}
          onChange={(e) => setBackupPassword(e.target.value)}
          placeholder="Backup पासवर्ड डालें (कम से कम 4 अंक/अक्षर)"
          className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      {pendingEncryptedRaw && (
        <form
          onSubmit={handleDecryptPending}
          className="mt-2.5 space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 dark:border-indigo-800 dark:bg-indigo-950/40"
        >
          <div className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
            🔒 Encrypted Backup अनलॉक करें
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={decryptPass}
              onChange={(e) => setDecryptPass(e.target.value)}
              placeholder="Backup का पासवर्ड डालें"
              autoFocus
              className="min-h-[38px] flex-1 rounded-lg border border-indigo-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-[38px] rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Restore
            </button>
          </div>
        </form>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Encrypted Backup यहाँ आएगा / Restore के लिए यहाँ paste करें"
        rows={3}
        className="mt-2.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />

      {feedback && (
        <p
          className={`mt-2 text-xs font-medium ${
            feedback.type === 'ok'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {feedback.msg}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleMakeBackup}
          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <Copy className="h-3.5 w-3.5" />
          <span>Encrypted बनाओ</span>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => void tryRestore(text)}
          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Restore करो</span>
        </button>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleClipboardRestore()}
        className="mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
      >
        <ClipboardPaste className="h-4 w-4" />
        <span>कॉपी किया Backup सीधे Restore करो</span>
      </button>
    </section>
  );
};
