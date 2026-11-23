import React, { useEffect, useState } from 'react';
import {
  Camera,
  ImagePlus,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { Account, ShopRole } from '../types';
import {
  EMOJI_PRESETS,
  getAccountColorHue,
  resizeSquareAvatar,
} from '../utils/hazri';
import { Avatar } from './Avatar';

interface AccountModalProps {
  isOpen: boolean;
  initialMode: 'list' | 'add' | 'edit';
  accounts: Account[];
  currentAccount: Account;
  unlockedIds: Record<string, boolean>;
  cloudRole?: ShopRole | null;
  canManageStaff?: boolean;
  onClose: () => void;
  onSelectAccount: (id: string) => void;
  onSaveAccount: (
    mode: 'add' | 'edit',
    payload: {
      id?: string;
      name: string;
      ph: string;
      em: string;
      photo: string;
      emo: string;
      passcode?: string;
    }
  ) => void;
  onDeleteAccount: (id: string) => void;
  onOpenStoryComposer: () => void;
  onOpenStoryViewer: (accountId: string) => void;
  onOpenSecurity: () => void;
  onOpenShopTeam?: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  initialMode,
  accounts,
  currentAccount,
  unlockedIds,
  cloudRole,
  canManageStaff,
  onClose,
  onSelectAccount,
  onSaveAccount,
  onDeleteAccount,
  onOpenStoryComposer,
  onOpenStoryViewer,
  onOpenSecurity,
  onOpenShopTeam,
}) => {
  const isCloudStaff = cloudRole === 'staff';
  const isCloudMode = Boolean(cloudRole);
  const allowManageStaff = !isCloudStaff && (canManageStaff ?? true);
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>(initialMode);
  const [editId, setEditId] = useState<string>(currentAccount.id);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [photo, setPhoto] = useState('');
  const [emo, setEmo] = useState('');
  const [photoHint, setPhotoHint] = useState(
    'फोटो न खुले तो नीचे से कोई निशान चुन लें'
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const populateForm = (acct: Account | null) => {
    setPin('');
    setPhotoHint('फोटो न खुले तो नीचे से कोई निशान चुन लें');
    if (acct) {
      setEditId(acct.id);
      setName(acct.name);
      setPhone(acct.ph || '');
      setEmail(acct.em || '');
      setPhoto(acct.photo || '');
      setEmo(acct.emo || '');
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setPhoto('');
      setEmo('');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const effectiveMode =
      !allowManageStaff && initialMode === 'add' ? 'list' : initialMode;
    setMode(effectiveMode);
    setConfirmDeleteId(null);
    if (effectiveMode === 'edit') {
      populateForm(currentAccount);
    } else if (effectiveMode === 'add') {
      populateForm(null);
    }
  }, [isOpen, initialMode, currentAccount, allowManageStaff]);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const t = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmDeleteId]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoHint('फोटो पढ़ रहे हैं…');
    try {
      const dataUrl = await resizeSquareAvatar(file);
      setPhoto(dataUrl);
      setEmo('');
      setPhotoHint('✔ फोटो मिल गई, अब सेव दबाएं');
    } catch {
      setPhotoHint('✖ यह फोटो नहीं खुली, दूसरी चुनें');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const trimmedPass = pin.trim();
    onSaveAccount(mode === 'add' ? 'add' : 'edit', {
      id: mode === 'edit' ? editId : undefined,
      name: trimmed,
      ph: phone.trim(),
      em: email.trim(),
      photo,
      emo,
      passcode: trimmedPass.length >= 4 ? trimmedPass : undefined,
    });
    setMode('list');
  };

  const editingTarget =
    mode === 'edit'
      ? accounts.find((a) => a.id === editId) || currentAccount
      : null;

  const previewInitial = (name.trim().charAt(0) || '+').toUpperCase();
  const previewHue =
    mode === 'edit'
      ? getAccountColorHue(
          Math.max(
            0,
            accounts.findIndex((a) => a.id === editId)
          )
        )
      : 245;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 pb-safe shadow-2xl sm:rounded-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" />

        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {mode === 'add'
              ? 'नया Account जोड़ें'
              : mode === 'edit'
                ? 'प्रोफ़ाइल बदलें'
                : 'Accounts व प्रोफ़ाइल'}
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

        {/* Account List */}
        {mode === 'list' && (
          <div className="mt-4 space-y-2.5">
            {accounts.map((acct, idx) => {
              const isCurrent = acct.id === currentAccount.id;
              const hasLock = Boolean(acct.e2ee?.enabled || acct.pin);
              const isLockedAcct = hasLock && !unlockedIds[acct.id];
              const showContact = (acct.ph || acct.em) && !isLockedAcct;
              const isConfirming = confirmDeleteId === acct.id;

              return (
                <div
                  key={acct.id}
                  className={`flex items-center gap-2 rounded-xl border p-1.5 ${
                    isCurrent
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="pl-1.5">
                    <Avatar
                      account={acct}
                      index={idx}
                      size="sm"
                      onClick={() => {
                        if (!isLockedAcct) {
                          onOpenStoryViewer(acct.id);
                        } else {
                          onSelectAccount(acct.id);
                          onClose();
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectAccount(acct.id);
                      onClose();
                    }}
                    className={`flex min-w-0 flex-1 items-center rounded-lg px-2 py-2 text-left transition-colors ${
                      isCurrent
                        ? 'text-white'
                        : 'text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">
                          {acct.name}
                        </span>
                        {hasLock && (
                          <ShieldCheck
                            className={`h-3.5 w-3.5 shrink-0 ${
                              isCurrent
                                ? 'text-emerald-200'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          />
                        )}
                      </div>
                      {isLockedAcct ? (
                        <div
                          className={`truncate text-[11px] ${
                            isCurrent
                              ? 'text-indigo-100'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          🔒 Encrypted — खोलने के लिए पासकोड डालें
                        </div>
                      ) : (
                        showContact && (
                          <div
                            className={`truncate text-xs ${
                              isCurrent
                                ? 'text-indigo-100'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {acct.ph || ''}
                            {acct.ph && acct.em ? ' · ' : ''}
                            {acct.em || ''}
                          </div>
                        )
                      )}
                    </div>
                  </button>

                  {!isLockedAcct ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isCurrent) onSelectAccount(acct.id);
                          populateForm(acct);
                          setMode('edit');
                        }}
                        aria-label={`${acct.name} संपादित करें`}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          isCurrent
                            ? 'text-white/90 hover:bg-white/15'
                            : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      {allowManageStaff && accounts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isConfirming) {
                              onDeleteAccount(acct.id);
                              setConfirmDeleteId(null);
                            } else {
                              setConfirmDeleteId(acct.id);
                            }
                          }}
                          aria-label={`${acct.name} हटाएं`}
                          className={`flex h-10 shrink-0 items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                            isConfirming
                              ? 'bg-red-600 text-white'
                              : isCurrent
                                ? 'text-white/90 hover:bg-white/15'
                                : 'text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-800'
                          }`}
                        >
                          {isConfirming ? 'पक्का?' : <Trash2 className="h-4 w-4" />}
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectAccount(acct.id);
                        onClose();
                      }}
                      aria-label={`${acct.name} लॉक है — खोलें`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Lock className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}

            <div className="grid grid-cols-2 gap-2 pt-2">
              {allowManageStaff ? (
                <button
                  type="button"
                  onClick={() => {
                    populateForm(null);
                    setMode('add');
                  }}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  <span>नया Staff / Account</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenShopTeam?.();
                  }}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <Store className="h-4 w-4" />
                  <span>Shop टीम / Follow</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSecurity();
                }}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>E2EE सुरक्षा</span>
              </button>
            </div>

            {onOpenShopTeam && allowManageStaff && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenShopTeam();
                }}
                className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200"
              >
                <Store className="h-4 w-4" />
                <span>Shop Multi-User Team / Follow / Share खोलें</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenStoryComposer();
              }}
              className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <Sparkles className="h-4 w-4" />
              <span>Status / Reel लगाएं</span>
            </button>
          </div>
        )}

        {/* Add / Edit Form */}
        {(mode === 'add' || mode === 'edit') && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {/* Avatar & Upload Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div
                style={
                  photo
                    ? undefined
                    : { backgroundColor: `hsl(${previewHue}, 56%, 46%)` }
                }
                className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-bold text-white"
              >
                {photo ? (
                  <img
                    src={photo}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{emo || previewInitial}</span>
                )}
              </div>

              <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <ImagePlus className="h-4 w-4" />
                <span>फोटो चुनें</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>

              <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Camera className="h-4 w-4" />
                <span>कैमरा</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>

              {photo && (
                <button
                  type="button"
                  onClick={() => setPhoto('')}
                  className="min-h-[40px] rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  हटाएं
                </button>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {photoHint}
            </p>

            {/* Emoji Selector */}
            <div className="flex flex-wrap gap-2">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    setEmo((prev) => (prev === e ? '' : e));
                    setPhoto('');
                  }}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border text-xl transition-transform active:scale-95 ${
                    emo === e
                      ? 'border-indigo-600 ring-2 ring-indigo-600 dark:border-indigo-400 dark:ring-indigo-400'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="नाम"
              required
              autoFocus
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />

            {(!isCloudMode || !isCloudStaff) && (
              <>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="मोबाइल नंबर (optional)"
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />

                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Gmail / Email (optional)"
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {isCloudMode && (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Staff इस Gmail से साइन-इन करके अपना डेटा खुद देख सकेगा।
                    </p>
                  )}
                </div>
              </>
            )}

            {!isCloudMode &&
              (mode === 'add' ? (
                <input
                  type="password"
                  autoComplete="new-password"
                  maxLength={24}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Encryption Passcode (कम से कम 4 अंक/अक्षर — E2EE लॉक)"
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSecurity();
                  }}
                  className="flex min-h-[42px] w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    <span>
                      {editingTarget?.e2ee?.enabled
                        ? 'AES-256 E2EE Lock चालू है — बदलें'
                        : 'Encryption Passcode / E2EE Lock लगाएं'}
                    </span>
                  </span>
                  <span>खोलें →</span>
                </button>
              ))}

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMode('list')}
                className="min-h-[46px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                वापस
              </button>
              <button
                type="submit"
                className="min-h-[46px] rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                सेव करें
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
