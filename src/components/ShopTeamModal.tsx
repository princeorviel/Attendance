import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  Check,
  Copy,
  Crown,
  ExternalLink,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Store,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  Account,
  ManagerPermissions,
  ShopDoc,
  ShopMemberDoc,
  ShopShareDoc,
  StaffDirectoryCard,
  UserShopSummary,
} from '../types';
import {
  DEFAULT_MANAGER_PERMISSIONS,
  getAccountColorHue,
} from '../utils/hazri';

interface ShopTeamModalProps {
  isOpen: boolean;
  initialTab?: 'team' | 'share';
  firebaseUser: User | null;
  authLoading: boolean;
  shop: ShopDoc | null;
  member: ShopMemberDoc | null;
  userShops: UserShopSummary[];
  accounts?: Account[];
  effectivePermissions: ManagerPermissions;
  directory: StaffDirectoryCard[];
  followedStaffIds: Set<string>;
  shares: ShopShareDoc[];
  members: ShopMemberDoc[];
  currentAccount: Account;
  defaultShareTitle: string;
  defaultShareText: string;
  onClose: () => void;
  onGoogleLogin: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  onCreateShop: (shopName: string, syncLocal: boolean) => Promise<void>;
  onJoinShop: (code: string) => Promise<void>;
  onSwitchShop: (shopId: string) => Promise<void>;
  onRenameShop: (nextName: string) => Promise<void>;
  onRegenerateJoinCode: () => Promise<void>;
  onLeaveShopView: () => Promise<void>;
  onDeleteShop: (shop: ShopDoc) => Promise<void>;
  onDeleteShopkeeperAccount: () => Promise<void>;
  onToggleFollow: (card: StaffDirectoryCard) => Promise<void>;
  onSendShare: (
    recipientUid: string,
    recipientName: string,
    title: string,
    summaryText: string,
    options?: {
      recipientEmail?: string;
      recipientStaffId?: string;
    }
  ) => Promise<void>;
  onDeleteShare: (shareId: string) => Promise<void>;
  onOpenAddStaff: () => void;
  onDeleteStaff: (staffId: string) => Promise<void>;
  onToggleManagerRole: (
    targetMember: ShopMemberDoc,
    nextRole: 'manager' | 'staff'
  ) => Promise<void>;
  onUpdateManagerPermissions: (
    targetMember: ShopMemberDoc,
    permissions: ManagerPermissions
  ) => Promise<void>;
  onOpenStoryViewer: (accountId: string) => void;
}

export const ShopTeamModal: React.FC<ShopTeamModalProps> = ({
  isOpen,
  initialTab = 'team',
  firebaseUser,
  authLoading,
  shop,
  member,
  userShops,
  accounts = [],
  effectivePermissions,
  directory,
  followedStaffIds,
  shares,
  members,
  currentAccount,
  defaultShareTitle,
  defaultShareText,
  onClose,
  onGoogleLogin,
  onGoogleLogout,
  onCreateShop,
  onJoinShop,
  onSwitchShop,
  onRenameShop,
  onRegenerateJoinCode,
  onLeaveShopView,
  onDeleteShop,
  onDeleteShopkeeperAccount,
  onToggleFollow,
  onSendShare,
  onDeleteShare,
  onOpenAddStaff,
  onDeleteStaff,
  onToggleManagerRole,
  onUpdateManagerPermissions,
  onOpenStoryViewer,
}) => {
  const [tab, setTab] = useState<'team' | 'share'>(initialTab);
  const [showCreateJoin, setShowCreateJoin] = useState(false);
  const [editingBranchName, setEditingBranchName] = useState(false);
  const [branchNameDraft, setBranchNameDraft] = useState('');
  const [expandedPermUid, setExpandedPermUid] = useState('');
  const [shopNameInput, setShopNameInput] = useState('');
  const [syncLocal, setSyncLocal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [confirmDeleteMode, setConfirmDeleteMode] = useState<
    null | 'shop' | 'account'
  >(null);
  const confirmBannerRef = useRef<HTMLDivElement | null>(null);

  // Share form state (keyed by staffId so both linkedUid and email-invited staff work)
  const [recipientStaffId, setRecipientStaffId] = useState('');
  const [shareTitle, setShareTitle] = useState(defaultShareTitle);
  const [shareBody, setShareBody] = useState(defaultShareText);

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab);
    setShowCreateJoin(false);
    setEditingBranchName(false);
    setExpandedPermUid('');
    setConfirmDeleteMode(null);
    setErrorMsg('');
    setStatusMsg('');
    setShareTitle(defaultShareTitle);
    setShareBody(defaultShareText);
  }, [isOpen, initialTab, defaultShareTitle, defaultShareText]);

  useEffect(() => {
    if (confirmDeleteMode && confirmBannerRef.current) {
      confirmBannerRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [confirmDeleteMode]);

  if (!isOpen) return null;

  const isOwner = member?.role === 'owner';
  const isOwnerOrManager =
    member?.role === 'owner' || member?.role === 'manager';

  const accountEmailByStaffId = new Map<string, string>();
  accounts.forEach((a) => {
    const email = (a.linkedEmail || a.em || '').trim().toLowerCase();
    if (email) accountEmailByStaffId.set(a.id, email);
  });

  const shareRecipients = directory
    .filter((d) => {
      const isSelf =
        (d.linkedUid && d.linkedUid === firebaseUser?.uid) ||
        d.staffId === member?.staffId;
      if (isSelf) return false;
      const email = accountEmailByStaffId.get(d.staffId) || '';
      return Boolean(d.linkedUid || email);
    })
    .map((d) => ({
      ...d,
      email: accountEmailByStaffId.get(d.staffId) || '',
    }));

  const effectiveRecipientStaffId =
    recipientStaffId &&
    shareRecipients.some((r) => r.staffId === recipientStaffId)
      ? recipientStaffId
      : shareRecipients[0]?.staffId || '';

  const showTempMsg = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3200);
  };

  const handleCopyCode = async () => {
    if (!shop?.joinCode) return;
    try {
      await navigator.clipboard.writeText(shop.joinCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopNameInput.trim()) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await onCreateShop(shopNameInput.trim(), syncLocal);
      setShopNameInput('');
      setShowCreateJoin(false);
      showTempMsg('नई Shop बन गई! आपकी पुरानी Shops भी सुरक्षित हैं ✓');
    } catch (err) {
      setErrorMsg((err as Error)?.message || 'Shop नहीं बन सकी');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await onJoinShop(joinCodeInput.trim());
      setJoinCodeInput('');
      setShowCreateJoin(false);
      showTempMsg('आप सफलतापूर्वक Shop से जुड़ गए हैं ✓');
    } catch (err) {
      setErrorMsg((err as Error)?.message || 'Shop से जुड़ने में समस्या आई');
    } finally {
      setBusy(false);
    }
  };

  const handleSwitch = async (targetShopId: string) => {
    if (targetShopId === shop?.shopId) {
      setShowCreateJoin(false);
      setConfirmDeleteMode(null);
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      await onSwitchShop(targetShopId);
      setShowCreateJoin(false);
      setConfirmDeleteMode(null);
      showTempMsg('Shop बदल दी गई ✓');
    } catch (err) {
      setErrorMsg((err as Error)?.message || 'Shop नहीं खुल सकी');
    } finally {
      setBusy(false);
    }
  };

  const ownedShopsCount = userShops.filter(
    (item) => item.role === 'owner'
  ).length;

  const handleConfirmDeleteShop = async () => {
    if (!shop || !isOwner) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await onDeleteShop(shop);
      setConfirmDeleteMode(null);
      showTempMsg('Shop और उसका सारा डेटा हमेशा के लिए डिलीट हो गया ✓');
    } catch (err) {
      setErrorMsg((err as Error)?.message || 'Shop डिलीट नहीं हो सकी');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (!firebaseUser) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await onDeleteShopkeeperAccount();
      setConfirmDeleteMode(null);
    } catch (err) {
      setErrorMsg(
        (err as Error)?.message || 'Shopkeeper ID डिलीट नहीं हो सकी'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSendShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = shareRecipients.find(
      (r) => r.staffId === effectiveRecipientStaffId
    );
    if (!target || (!target.linkedUid && !target.email)) {
      setErrorMsg('कोई जुड़ा हुआ साथी या Gmail वाला Staff चुनें');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      await onSendShare(
        target.linkedUid || '',
        target.name,
        shareTitle.trim() || `${currentAccount.name} Report`,
        shareBody.trim(),
        {
          recipientEmail: target.email,
          recipientStaffId: target.staffId,
        }
      );
      showTempMsg(`${target.name} को इसी App में डेटा भेज दिया गया ✓`);
    } catch (err) {
      setErrorMsg((err as Error)?.message || 'डेटा नहीं भेजा जा सका');
    } finally {
      setBusy(false);
    }
  };

  const inviteText = shop
    ? `हमारी शॉप "${shop.name}" के Attendance ऐप से जुड़ने के लिए ऐप खोलकर Google Login करें और यह Shop Code डालें:\n\nShop Code: ${shop.joinCode}\nलिंक: ${window.location.origin}`
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shop Team व Multi-User Privacy"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 pb-safe shadow-2xl sm:rounded-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Shop टीम, Follow व प्राइवेसी
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

        {/* Step 1: Google Sign-In Gate */}
        {!firebaseUser ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-xs leading-relaxed text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100">
              <div className="flex items-center gap-1.5 font-bold text-indigo-800 dark:text-indigo-300">
                <ShieldCheck className="h-4 w-4" />
                <span>WhatsApp / Signal जैसी प्राइवेसी + Owner नियंत्रण</span>
              </div>
              <ul className="mt-2 space-y-1">
                <li>
                  • <strong>100% अलग Shop Isolation:</strong> हर Shopkeeper का नाम, स्टाफ़ और डेटा पूरी तरह अलग रहता है — दूसरी Shop के मालिक या स्टाफ़ को कुछ भी नहीं दिखता।
                </li>
                <li>
                  • हर Staff सिर्फ़ अपना खुद का हिसाब देख सकेगा और अपनी हाज़िरी लगा पाएगा।
                </li>
                <li>
                  • शॉप का <strong>Owner / Manager</strong> अपने स्टाफ़ जोड़/हटा सकते हैं और अधिकार तय कर सकते हैं।
                </li>
              </ul>
            </div>

            <button
              type="button"
              disabled={authLoading || busy}
              onClick={async () => {
                setBusy(true);
                setErrorMsg('');
                try {
                  await onGoogleLogin();
                } catch (err) {
                  setErrorMsg(
                    (err as Error)?.message || 'Google लॉगिन रद्द या विफल हुआ'
                  );
                } finally {
                  setBusy(false);
                }
              }}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              <span>
                {busy || authLoading
                  ? 'लॉगिन हो रहा है…'
                  : 'Google से साइन इन करें'}
              </span>
            </button>

            {errorMsg && (
              <p className="text-center text-xs font-medium text-red-600 dark:text-red-400">
                {errorMsg}
              </p>
            )}
          </div>
        ) : !shop || !member || showCreateJoin ? (
          /* Step 2: Saved Shops Switcher + Create Shop (Owner) OR Join Shop (Staff) */
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/60">
              <div className="truncate">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {firebaseUser.displayName || 'User'}
                </span>
                <span className="ml-1.5 text-slate-500 dark:text-slate-400">
                  ({firebaseUser.email})
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {shop && member && showCreateJoin && (
                  <button
                    type="button"
                    onClick={() => setShowCreateJoin(false)}
                    className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    ← वापस
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void onGoogleLogout()}
                  className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline dark:text-red-400"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>लॉगआउट</span>
                </button>
              </div>
            </div>

            {userShops.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-2 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  आपकी सभी Shops ({userShops.length}) — चुनकर खोलें
                </div>
                <div className="space-y-1.5">
                  {userShops.map((item) => {
                    const isActive = item.shop.shopId === shop?.shopId;
                    return (
                      <button
                        key={item.shop.shopId}
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSwitch(item.shop.shopId)}
                        className={`flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                          isActive
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-950 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-100'
                            : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-bold">
                            {item.shop.name}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                            Code: {item.shop.joinCode} · {item.role}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                            isActive
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white text-indigo-700 border border-indigo-200 dark:bg-slate-900 dark:text-indigo-300 dark:border-indigo-800'
                          }`}
                        >
                          {isActive ? 'सक्रिय ✓' : 'खोलें'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Option A: Create Shop as Owner */}
            <form
              onSubmit={handleCreate}
              className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2.5 dark:border-indigo-900 dark:bg-indigo-950/30"
            >
              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                <Crown className="h-4 w-4 text-amber-500" />
                <span>नई Shop बनाएं (Owner / Manager बनने के लिए)</span>
              </div>
              <input
                type="text"
                value={shopNameInput}
                onChange={(e) => setShopNameInput(e.target.value)}
                placeholder="Shop का नाम (जैसे: Sharma Textiles)"
                required
                className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={syncLocal}
                  onChange={(e) => setSyncLocal(e.target.checked)}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span>इस फ़ोन के पुराने Local Offline अकाउंट भी नई Shop में कॉपी करें (वैकल्पिक)</span>
              </label>
              <button
                type="submit"
                disabled={busy}
                className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                <span>{busy ? 'बन रही है…' : 'नई Shop बनाएं व Code पाएं'}</span>
              </button>
            </form>

            {/* Option B: Join Shop as Staff */}
            <form
              onSubmit={handleJoin}
              className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Staff के रूप में Shop से जुड़ें</span>
              </div>
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="Owner से मिला Shop Code डालें (जैसे: SHOP-4K8P2A)"
                required
                className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm uppercase tracking-wider text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="submit"
                disabled={busy}
                className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <UserCheck className="h-4 w-4" />
                <span>{busy ? 'जुड़ रहे हैं…' : 'Shop से जुड़ें'}</span>
              </button>
            </form>

            {/* Danger Zone: Permanently Delete Shopkeeper ID */}
            <div className="rounded-2xl border border-red-200 bg-red-50/60 p-3.5 space-y-2.5 dark:border-red-900/70 dark:bg-red-950/25">
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Shopkeeper ID डिलीट करें (Permanent)</span>
              </div>
              {confirmDeleteMode === 'account' ? (
                <div className="space-y-2">
                  <p className="text-[11px] leading-relaxed text-red-800 dark:text-red-200">
                    सावधान! <strong>{firebaseUser.email}</strong> की पूरी
                    Shopkeeper ID, आपकी सभी बनाई गई Shops ({ownedShopsCount}) और
                    उनके अंदर का सारा Staff व हाज़िरी डेटा हमेशा के लिए मिट
                    जाएगा। इसे वापस नहीं लाया जा सकता।
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleConfirmDeleteAccount()}
                      className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>
                        {busy
                          ? 'डिलीट हो रही है…'
                          : 'हाँ, मेरी ID हमेशा के लिए डिलीट करें'}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmDeleteMode(null)}
                      className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      रद्द करें
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-red-700/90 dark:text-red-300/90">
                    अपनी पूरी Shopkeeper ID और सभी Shops को हमेशा के लिए हटाएं।
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmDeleteMode('account')}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Shopkeeper ID डिलीट करें</span>
                  </button>
                </div>
              )}
            </div>

            {errorMsg && (
              <p className="text-center text-xs font-medium text-red-600 dark:text-red-400">
                {errorMsg}
              </p>
            )}
          </div>
        ) : (
          /* Step 3: Active Cloud Shop Workspace */
          <div className="mt-4 space-y-3">
            {/* Multi-Shop Switcher Strip */}
            {userShops.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {userShops.map((item) => {
                  const isActive = item.shop.shopId === shop.shopId;
                  return (
                    <button
                      key={item.shop.shopId}
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSwitch(item.shop.shopId)}
                      className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-semibold transition-colors ${
                        isActive
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <Store className="h-3.5 w-3.5 shrink-0" />
                      <span className="max-w-[130px] truncate">
                        {item.shop.name}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowCreateJoin(true)}
                  className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/70 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>नई Shop / Join</span>
                </button>
              </div>
            )}

            {/* Shop Banner */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {editingBranchName && isOwner ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!branchNameDraft.trim()) return;
                        setBusy(true);
                        try {
                          await onRenameShop(branchNameDraft.trim());
                          setEditingBranchName(false);
                          showTempMsg('Shop / Branch का नाम अपडेट हो गया ✓');
                        } catch (err) {
                          setErrorMsg(
                            (err as Error)?.message || 'नाम नहीं बदला जा सका'
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        value={branchNameDraft}
                        onChange={(e) => setBranchNameDraft(e.target.value)}
                        required
                        autoFocus
                        className="min-h-[34px] flex-1 rounded-lg border border-indigo-300 bg-white px-2.5 text-xs font-semibold text-slate-900 dark:border-indigo-700 dark:bg-slate-900 dark:text-white"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                      >
                        सेव
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingBranchName(false)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      >
                        रद्द
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                        {shop.name}
                      </span>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => {
                            setBranchNameDraft(shop.name);
                            setEditingBranchName(true);
                          }}
                          aria-label="Shop / Branch नाम बदलें"
                          title="Shop / Branch नाम बदलें"
                          className="rounded p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-700"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          member.role === 'owner'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                            : member.role === 'manager'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                        }`}
                      >
                        {member.role === 'owner'
                          ? 'Owner'
                          : member.role === 'manager'
                            ? 'Manager'
                            : 'Staff'}
                      </span>
                    </div>
                  )}
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {firebaseUser.email}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {userShops.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCreateJoin(true)}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
                    >
                      + नई Shop
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void onLeaveShopView()}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    Local Mode
                  </button>
                  {isOwner && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setConfirmDeleteMode((prev) =>
                          prev === 'shop' ? null : 'shop'
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Shop डिलीट</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void onGoogleLogout()}
                    className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                  >
                    लॉगआउट
                  </button>
                </div>
              </div>

              {member.role === 'manager' && (
                <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <strong>आपके Manager अधिकार:</strong>{' '}
                  {[
                    effectivePermissions.canMarkAttendance && 'हाज़िरी',
                    effectivePermissions.canApproveRequests && 'अनुरोध मंज़ूरी',
                    effectivePermissions.canManageMoney && 'Advance/Payment',
                    effectivePermissions.canEditSalary && 'सैलरी बदलाव',
                    effectivePermissions.canManageStaff && 'Staff जोड़/हटाएं',
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'केवल देखना (Read-Only)'}
                </div>
              )}

              {isOwnerOrManager && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2.5 dark:border-slate-700">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Staff Join Code:{' '}
                    </span>
                    <strong className="font-mono text-indigo-700 dark:text-indigo-300">
                      {shop.joinCode}
                    </strong>
                    {isOwner && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await onRegenerateJoinCode();
                            showTempMsg('नया Join Code बन गया ✓');
                          } catch (err) {
                            setErrorMsg(
                              (err as Error)?.message || 'Code नहीं बदल सका'
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                        title="नया Join Code बनाएं"
                        aria-label="नया Join Code बनाएं"
                        className="rounded p-1 text-slate-400 hover:bg-slate-200/70 hover:text-indigo-600 dark:hover:bg-slate-700"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleCopyCode()}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>कॉपी</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Code कॉपी</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('share')}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700"
                    >
                      <Send className="h-3 w-3" />
                      <span>App में Staff को भेजें</span>
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(inviteText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="WhatsApp से Join Code भेजें"
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>WA Invite</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Inline Delete Confirmation Banner (Shop or Entire Shopkeeper ID) */}
            {confirmDeleteMode === 'shop' && isOwner && (
              <div
                ref={confirmBannerRef}
                className="rounded-2xl border border-red-300 bg-red-50 p-3.5 space-y-2.5 dark:border-red-800 dark:bg-red-950/40"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-800 dark:text-red-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>क्या आप "{shop.name}" को हमेशा के लिए डिलीट करना चाहते हैं?</span>
                </div>
                <p className="text-[11px] leading-relaxed text-red-700 dark:text-red-300">
                  इस Shop का Join Code ({shop.joinCode}), सभी Staff रिकॉर्ड्स,
                  हाज़िरी, एडवांस/हिसाब और अनुरोध हमेशा के लिए डिलीट हो जाएंगे।
                  आपकी बाकी Shops व Account सुरक्षित रहेंगे।
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleConfirmDeleteShop()}
                    className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>
                      {busy ? 'डिलीट हो रही है…' : 'हाँ, यह Shop डिलीट करें'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmDeleteMode(null)}
                    className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    रद्द करें
                  </button>
                </div>
              </div>
            )}

            {confirmDeleteMode === 'account' && (
              <div
                ref={confirmBannerRef}
                className="rounded-2xl border border-red-300 bg-red-50 p-3.5 space-y-2.5 dark:border-red-800 dark:bg-red-950/40"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-800 dark:text-red-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>पूरी Shopkeeper ID हमेशा के लिए डिलीट करें?</span>
                </div>
                <p className="text-[11px] leading-relaxed text-red-700 dark:text-red-300">
                  <strong>{firebaseUser.email}</strong> का Account, आपकी सभी{' '}
                  <strong>{ownedShopsCount}</strong> Owned Shops और उनका पूरा
                  स्टाफ़/हाज़िरी डेटा हमेशा के लिए मिट जाएगा। यह क्रिया वापस नहीं
                  हो सकती।
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleConfirmDeleteAccount()}
                    className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>
                      {busy
                        ? 'ID डिलीट हो रही है…'
                        : 'हाँ, मेरी ID हमेशा के लिए डिलीट करें'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmDeleteMode(null)}
                    className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    रद्द करें
                  </button>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setTab('team')}
                className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === 'team'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                सहकर्मी व Follow ({directory.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('share')}
                className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === 'share'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                App में भेजें / Inbox ({shares.length})
              </button>
            </div>

            {statusMsg && (
              <p className="text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {statusMsg}
              </p>
            )}
            {errorMsg && (
              <p className="text-center text-xs font-semibold text-red-600 dark:text-red-400">
                {errorMsg}
              </p>
            )}

            {tab === 'team' ? (
              <div className="space-y-2.5">
                {!isOwnerOrManager && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-[11px] leading-relaxed text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                    🔒 <strong>Strict Privacy:</strong> आप केवल अपनी हाज़िरी और हिसाब देख सकते हैं। बाकी सहकर्मियों का डेटा पूरी तरह सुरक्षित व छुपा है — आप उन्हें <strong>Follow</strong> और अपना डेटा <strong>Share</strong> कर सकते हैं।
                  </div>
                )}

                {effectivePermissions.canManageStaff && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAddStaff();
                    }}
                    className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>नया Staff अकाउंट जोड़ें (Unlimited)</span>
                  </button>
                )}

                <div className="space-y-2">
                  {directory.map((card, idx) => {
                    const isSelf =
                      card.linkedUid === firebaseUser.uid ||
                      card.staffId === member.staffId;
                    const isFollowing = followedStaffIds.has(card.staffId);
                    const hue = getAccountColorHue(idx);
                    const hasStories = (card.stories || []).some(
                      (s) => Date.now() - s.ts < 86400000
                    );
                    const matchedMember = isOwner
                      ? members.find(
                          (m) =>
                            m.uid === card.linkedUid && m.uid !== shop.ownerUid
                        )
                      : undefined;

                    return (
                      <div
                        key={card.staffId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-800"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (hasStories) {
                                onClose();
                                onOpenStoryViewer(card.staffId);
                              }
                            }}
                            style={
                              card.photo
                                ? undefined
                                : { backgroundColor: `hsl(${hue}, 56%, 46%)` }
                            }
                            className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ${
                              hasStories
                                ? 'ring-2 ring-pink-500 ring-offset-2 dark:ring-offset-slate-900'
                                : ''
                            }`}
                          >
                            {card.photo ? (
                              <img
                                src={card.photo}
                                alt={card.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span>
                                {card.emo || card.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                {card.name}
                              </span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {card.roleLabel}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                  (आप)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="font-mono-num">
                                {card.followersCount}
                              </span>{' '}
                              Followers
                              {card.linkedUid ? ' · लॉगिन जुड़ा' : ' · लॉगिन बाकी'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => void onToggleFollow(card)}
                              className={`min-h-[34px] rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                                isFollowing
                                  ? 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              {isFollowing ? 'Following ✓' : '+ Follow'}
                            </button>
                          )}

                          {!isSelf &&
                            (card.linkedUid ||
                              accountEmailByStaffId.get(card.staffId)) && (
                              <button
                                type="button"
                                title="इसी App में डेटा इन्हें भेजें"
                                onClick={() => {
                                  setRecipientStaffId(card.staffId);
                                  setTab('share');
                                }}
                                className="inline-flex h-8.5 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
                              >
                                <Send className="h-3 w-3" />
                                <span>भेजें</span>
                              </button>
                            )}

                          {isOwner && matchedMember && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void onToggleManagerRole(
                                    matchedMember,
                                    matchedMember.role === 'manager'
                                      ? 'staff'
                                      : 'manager'
                                  )
                                }
                                className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                              >
                                {matchedMember.role === 'manager'
                                  ? 'Manager हटाएं'
                                  : 'Manager बनाएं'}
                              </button>
                              {matchedMember.role === 'manager' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedPermUid((prev) =>
                                      prev === matchedMember.uid
                                        ? ''
                                        : matchedMember.uid
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                  अधिकार तय करें
                                </button>
                              )}
                            </>
                          )}

                          {effectivePermissions.canManageStaff &&
                            card.linkedUid !== shop.ownerUid &&
                            directory.length > 1 && (
                              <button
                                type="button"
                                aria-label={`${card.name} हटाएं`}
                                onClick={() => void onDeleteStaff(card.staffId)}
                                className="inline-flex h-8.5 w-8.5 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                        </div>

                        {isOwner &&
                          matchedMember &&
                          matchedMember.role === 'manager' &&
                          expandedPermUid === matchedMember.uid && (
                            <div className="mt-2 w-full border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800">
                              <div className="mb-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                {matchedMember.displayName} के सीमित Manager अधिकार:
                              </div>
                              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                {(
                                  [
                                    {
                                      key: 'canMarkAttendance',
                                      label: 'स्टाफ़ की हाज़िरी लगाएं',
                                    },
                                    {
                                      key: 'canApproveRequests',
                                      label: 'Self-Punch / छुट्टी मंज़ूर करें',
                                    },
                                    {
                                      key: 'canManageMoney',
                                      label: 'Advance / Payment जोड़ें',
                                    },
                                    {
                                      key: 'canEditSalary',
                                      label: 'महीने की सैलरी बदलें',
                                    },
                                    {
                                      key: 'canManageStaff',
                                      label: 'नया Staff जोड़ें / हटाएं',
                                    },
                                  ] as Array<{
                                    key: keyof ManagerPermissions;
                                    label: string;
                                  }>
                                ).map((permItem) => {
                                  const currentPerms: ManagerPermissions = {
                                    ...DEFAULT_MANAGER_PERMISSIONS,
                                    ...(matchedMember.permissions || {}),
                                  };
                                  const checked = currentPerms[permItem.key];
                                  return (
                                    <label
                                      key={permItem.key}
                                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          const nextPerms: ManagerPermissions =
                                            {
                                              ...currentPerms,
                                              [permItem.key]: !checked,
                                            };
                                          void onUpdateManagerPermissions(
                                            matchedMember,
                                            nextPerms
                                          );
                                        }}
                                        className="h-3.5 w-3.5 accent-indigo-600"
                                      />
                                      <span>{permItem.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* In-App Share Tab */
              <div className="space-y-4">
                <form
                  onSubmit={handleSendShareSubmit}
                  className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50"
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    इसी App में Staff / Owner को डेटा भेजें (In-App Send)
                  </div>

                  {shareRecipients.length === 0 ? (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      सीधे App में भेजने के लिए Staff का Gmail जोड़ें या उन्हें Shop Join Code से जोड़ें।
                    </p>
                  ) : (
                    <>
                      <select
                        value={effectiveRecipientStaffId}
                        onChange={(e) => setRecipientStaffId(e.target.value)}
                        className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      >
                        {shareRecipients.map((r) => (
                          <option key={r.staffId} value={r.staffId}>
                            {r.name} ({r.roleLabel})
                            {r.linkedUid ? ' · ऐप से जुड़ा है' : ` · ${r.email}`}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={shareTitle}
                        onChange={(e) => setShareTitle(e.target.value)}
                        placeholder="शीर्षक"
                        required
                        className="min-h-[38px] w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />

                      <textarea
                        rows={4}
                        value={shareBody}
                        onChange={(e) => setShareBody(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-[11px] text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />

                      <button
                        type="submit"
                        disabled={busy}
                        className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{busy ? 'भेज रहे हैं…' : 'इसी App में भेजें'}</span>
                      </button>
                    </>
                  )}
                </form>

                {/* Shared Messages Inbox */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    शेयर किया गया डेटा (Inbox & Sent)
                  </div>
                  {shares.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      अभी कोई इन-ऐप शेयर डेटा नहीं है।
                    </p>
                  ) : (
                    shares.map((sh) => {
                      const isSentByMe = sh.senderUid === firebaseUser.uid;
                      return (
                        <div
                          key={sh.shareId}
                          className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {sh.title}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {isSentByMe
                                  ? `आपने भेजा → ${sh.recipientName}`
                                  : `${sh.senderName} ने भेजा → आपको`}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void onDeleteShare(sh.shareId)}
                              aria-label="हटाएं"
                              className="p-1 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <pre className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {sh.summaryText}
                          </pre>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Bottom Danger Zone for Active Shop Workspace */}
            <div className="mt-4 rounded-2xl border border-red-200/80 bg-red-50/40 p-3.5 dark:border-red-900/60 dark:bg-red-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Danger Zone — डिलीट विकल्प</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-red-700/80 dark:text-red-300/80">
                    {isOwner
                      ? 'सिर्फ़ यह Shop हटाएं या अपनी पूरी Shopkeeper ID हमेशा के लिए डिलीट करें।'
                      : 'अपनी पूरी Cloud ID हमेशा के लिए डिलीट करें।'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {isOwner && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmDeleteMode('shop')}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-red-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-slate-900 dark:text-red-300"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>यह Shop डिलीट</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmDeleteMode('account')}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Shopkeeper ID डिलीट</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
