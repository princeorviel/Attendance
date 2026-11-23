import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  KeyRound,
  LockOpen,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { Account } from '../types';
import {
  sealAccountWithNewPasscode,
  unlockAccountWithPasscode,
  unlockAndResetPasscodeWithRecoveryKey,
} from '../utils/cryptoVault';
import { hashPin } from '../utils/hazri';
import { Avatar } from './Avatar';

interface PinLockScreenProps {
  accounts: Account[];
  currentAccount: Account;
  onUnlock: (
    accountId: string,
    decryptedAccount: Account,
    masterKeyBytes?: Uint8Array,
    upgradedRecoveryKey?: string
  ) => void;
  onSwitchAccount: (accountId: string) => void;
  onCreateNewAccount: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  accounts,
  currentAccount,
  onUnlock,
  onSwitchAccount,
  onCreateNewAccount,
}) => {
  const [passcodeInput, setPasscodeInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [newPasscode, setNewPasscode] = useState('');

  const currentIndex = Math.max(
    0,
    accounts.findIndex((a) => a.id === currentAccount.id)
  );
  const isE2EE = Boolean(currentAccount.e2ee?.enabled);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = passcodeInput.trim();
    if (!trimmed) {
      setError('कृपया Passcode / PIN डालें');
      return;
    }

    setBusy(true);
    setError('');
    try {
      if (isE2EE) {
        const { unlockedAccount, masterKeyBytes } =
          await unlockAccountWithPasscode(currentAccount, trimmed);
        setPasscodeInput('');
        onUnlock(currentAccount.id, unlockedAccount, masterKeyBytes);
      } else if (
        currentAccount.pin &&
        hashPin(trimmed) === currentAccount.pin
      ) {
        // Automatically upgrade legacy PIN account to AES-256-GCM E2EE vault
        try {
          const {
            sealedAccount,
            masterKeyBytes,
            recoveryKeyFormatted,
          } = await sealAccountWithNewPasscode(currentAccount, trimmed, false);
          setPasscodeInput('');
          onUnlock(
            currentAccount.id,
            sealedAccount,
            masterKeyBytes,
            recoveryKeyFormatted
          );
        } catch {
          setPasscodeInput('');
          onUnlock(currentAccount.id, currentAccount);
        }
      } else {
        setError('Passcode / PIN गलत है');
        setPasscodeInput('');
      }
    } catch {
      setError('Passcode गलत है — डेटा Decrypt नहीं हो सका');
      setPasscodeInput('');
    } finally {
      setBusy(false);
    }
  };

  const handleRecoveryUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isE2EE) {
      setError('इस पुराने खाते में Recovery Key सेट नहीं थी');
      return;
    }
    if (newPasscode.trim().length < 4) {
      setError('नया Passcode कम से कम 4 अक्षर/अंक का रखें');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const { updatedAccount, masterKeyBytes } =
        await unlockAndResetPasscodeWithRecoveryKey(
          currentAccount,
          recoveryKeyInput,
          newPasscode
        );
      setRecoveryKeyInput('');
      setNewPasscode('');
      setShowRecovery(false);
      onUnlock(currentAccount.id, updatedAccount, masterKeyBytes);
    } catch {
      setError('64-अंकों की Recovery Key गलत है');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex overflow-y-auto bg-slate-50 p-5 dark:bg-slate-950">
      <div className="m-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex justify-center">
          <Avatar account={currentAccount} index={currentIndex} size="lg" />
        </div>

        <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
          {currentAccount.name}
        </h2>

        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>
            {isE2EE
              ? 'End-to-End Encrypted (AES-256-GCM)'
              : 'Private Vault Locked'}
          </span>
        </div>

        {isE2EE && currentAccount.e2ee?.fingerprint && (
          <p className="mt-1 font-mono text-[10px] text-slate-400 dark:text-slate-500">
            Code: {currentAccount.e2ee.fingerprint.slice(0, 23)}…
          </p>
        )}

        <form onSubmit={handleUnlock} className="mt-4">
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              maxLength={24}
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              placeholder="Passcode / PIN डालो"
              autoFocus
              className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-10 text-center font-mono text-lg tracking-widest text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label="Passcode दिखाएं/छुपाएं"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              {showPass ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="min-h-[24px] py-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <LockOpen className="h-4 w-4" />
            <span>{busy ? 'Decrypt हो रहा है…' : 'डेटा खोलो'}</span>
          </button>
        </form>

        {isE2EE && (
          <button
            type="button"
            onClick={() => {
              setError('');
              setShowRecovery((v) => !v);
            }}
            className="mt-3 inline-flex min-h-[38px] items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Passcode भूल गए? Recovery Key इस्तेमाल करें</span>
          </button>
        )}

        {showRecovery && isE2EE && (
          <form
            onSubmit={handleRecoveryUnlock}
            className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left dark:border-slate-700 dark:bg-slate-800/70"
          >
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              अपनी 64-अंकों की Recovery Key पेस्ट करें और नया Passcode चुनें। बिना Recovery Key के डेटा अनलॉक नहीं हो सकता।
            </p>
            <textarea
              rows={2}
              value={recoveryKeyInput}
              onChange={(e) => setRecoveryKeyInput(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-..."
              required
              className="w-full rounded-lg border border-slate-200 bg-white p-2 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <input
              type="password"
              maxLength={24}
              value={newPasscode}
              onChange={(e) => setNewPasscode(e.target.value)}
              placeholder="नया Passcode (कम से कम 4 अक्षर/अंक)"
              required
              className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-[40px] w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Recovery Key से अनलॉक करें
            </button>
          </form>
        )}

        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          {accounts.length > 1 && (
            <>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                दूसरा account खोलो
              </p>
              <div className="mb-3 flex flex-wrap justify-center gap-2">
                {accounts
                  .filter((a) => a.id !== currentAccount.id)
                  .map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setError('');
                        setPasscodeInput('');
                        setShowRecovery(false);
                        onSwitchAccount(a.id);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {(a.e2ee?.enabled || a.pin) && (
                        <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span>{a.name}</span>
                    </button>
                  ))}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={onCreateNewAccount}
            className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-400"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>नया अलग Account बनाएं</span>
          </button>
        </div>
      </div>
    </div>
  );
};
