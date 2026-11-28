import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  CalendarDays,
  ChevronDown,
  Clapperboard,
  Eye,
  ImagePlus,
  IndianRupee,
  Lock,
  Moon,
  Send,
  ShieldCheck,
  Store,
  Sun,
  Type,
  UserCircle2,
  UserPlus,
} from 'lucide-react';
import { auth, googleProvider } from './firebase';
import { AccountModal } from './components/AccountModal';
import { AdBanner, initAdSense } from './components/AdBanner';
import { Avatar } from './components/Avatar';
import { BackupCard } from './components/BackupCard';
import { CalendarCard } from './components/CalendarCard';
import { DaySheetModal } from './components/DaySheetModal';
import { HisabCard } from './components/HisabCard';
import { LedgerCard } from './components/LedgerCard';
import {
  InAppShareRecipient,
  LedgerShareModal,
} from './components/LedgerShareModal';
import { LegalInfoModal, LegalTab } from './components/LegalInfoModal';
import {
  AppShareDownloadButton,
  OfflineIndicator,
  PWAInstallBanner,
  PWAUpdateToast,
} from './components/PWAComponents';
import { PinLockScreen } from './components/PinLockScreen';
import { SecurityModal } from './components/SecurityModal';
import { ShopTeamModal } from './components/ShopTeamModal';
import { StaffSelfServiceCard } from './components/StaffSelfServiceCard';
import { StoryComposerModal } from './components/StoryComposerModal';
import { StoryViewerModal } from './components/StoryViewerModal';
import {
  Account,
  AttendanceStatus,
  MoneyEntry,
  RootState,
  ShopDoc,
  ShopMemberDoc,
  ShopRequestDoc,
  ShopRole,
  ShopShareDoc,
  StaffDirectoryCard,
  Story,
  StoryMediaType,
  ThemeMode,
  UserShopSummary,
} from './types';
import {
  reencryptAccountVault,
  sealAccountWithNewPasscode,
  stripPrivateFields,
} from './utils/cryptoVault';
import {
  THEME_KEY,
  buildLedgerStatementText,
  calculateMonthSummary,
  formatTimeShort,
  getFallbackRoot,
  getLiveStories,
  loadRootAsync,
  makeDateKey,
  resolveEffectivePermissions,
  saveRootAsync,
} from './utils/hazri';
import { deleteMediaBlob } from './utils/mediaStore';
import {
  addShopStaff,
  createShopWorkspace,
  deleteInAppShare,
  deleteShopRequest,
  deleteShopStaff,
  deleteShopWorkspace,
  deleteShopkeeperData,
  ensureUserDoc,
  joinShopByCode,
  leaveShopWorkspace,
  loadActiveShopContext,
  loadUserShops,
  regenerateShopJoinCode,
  renameShopBranch,
  reviewShopRequest,
  saveOwnerStaffPatch,
  saveStaffDirectoryProfile,
  saveStaffSelfAttendance,
  sendInAppShare,
  setMemberRole,
  submitShopRequest,
  subscribeShopWorkspace,
  switchActiveShop,
  toggleFollowTeammate,
  updateManagerPermissions,
  updatePendingPunchOut,
} from './utils/shopService';

type MobileTab = 'calendar' | 'hisab' | 'backup';

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore
  }
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

export default function App() {
  const [root, setRoot] = useState<RootState>(() => getFallbackRoot());
  const [hydrated, setHydrated] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [mobileTab, setMobileTab] = useState<MobileTab>('calendar');

  const now = useMemo(() => new Date(), []);
  const todayKey = makeDateKey(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const [year, setYear] = useState<number>(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState<number>(now.getMonth());
  const [upToDate, setUpToDate] = useState<string>(todayKey);

  const [unlockedIds, setUnlockedIds] = useState<Record<string, boolean>>({});
  const [sessionMasterKeys, setSessionMasterKeys] = useState<
    Record<string, Uint8Array>
  >({});
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [accountModal, setAccountModal] = useState<{
    open: boolean;
    mode: 'list' | 'add' | 'edit';
  }>({ open: false, mode: 'list' });
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [storyComposerMode, setStoryComposerMode] =
    useState<StoryMediaType>('photo');
  const [storyViewerAccountId, setStoryViewerAccountId] = useState<
    string | null
  >(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [ledgerShareOpen, setLedgerShareOpen] = useState(false);
  const [shopTeamOpen, setShopTeamOpen] = useState(false);
  const [shopTeamInitialTab, setShopTeamInitialTab] = useState<
    'team' | 'share'
  >('team');
  const [recoveryNotice, setRecoveryNotice] = useState<{
    accountName: string;
    key: string;
  } | null>(null);
  const [, setViewedStoryIds] = useState<Record<string, boolean>>({});

  // Multi-user Shop Cloud State (Firebase Auth + Firestore RBAC)
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [shop, setShop] = useState<ShopDoc | null>(null);
  const [member, setMember] = useState<ShopMemberDoc | null>(null);
  const [userShops, setUserShops] = useState<UserShopSummary[]>([]);
  const [shopDirectory, setShopDirectory] = useState<StaffDirectoryCard[]>([]);
  const [shopAccounts, setShopAccounts] = useState<Account[]>([]);
  const [followedStaffIds, setFollowedStaffIds] = useState<Set<string>>(
    () => new Set()
  );
  const [shopShares, setShopShares] = useState<ShopShareDoc[]>([]);
  const [shopMembers, setShopMembers] = useState<ShopMemberDoc[]>([]);
  const [shopRequests, setShopRequests] = useState<ShopRequestDoc[]>([]);
  const [selectedCloudStaffId, setSelectedCloudStaffId] = useState<string>('');
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);

  const openShopTeam = (tab: 'team' | 'share' = 'team') => {
    setShopTeamInitialTab(tab);
    setShopTeamOpen(true);
  };

  const lastTapRef = useRef<number>(0);
  const workspaceUnsubRef = useRef<(() => void) | null>(null);

  // Sync theme with <html> class and mobile status-bar theme-color
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'dark') {
      el.classList.add('dark');
    } else {
      el.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute(
        'content',
        theme === 'dark' ? '#0f172a' : '#4338ca'
      );
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Handle PWA Home Screen App Shortcuts (?tab=calendar|hisab|backup, ?open=shop, ?page=privacy|terms|about|contact)
  useEffect(() => {
    initAdSense();
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (
        tabParam === 'calendar' ||
        tabParam === 'hisab' ||
        tabParam === 'backup'
      ) {
        setMobileTab(tabParam);
      }
      if (params.get('open') === 'shop') {
        openShopTeam('team');
      }
      const pageParam = params.get('page');
      if (
        pageParam === 'about' ||
        pageParam === 'privacy' ||
        pageParam === 'terms' ||
        pageParam === 'contact'
      ) {
        setLegalTab(pageParam);
      }
    } catch {
      // ignore
    }
  }, []);

  // Initial E2EE storage unseal
  useEffect(() => {
    let active = true;
    void loadRootAsync().then((loaded) => {
      if (!active) return;
      setRoot(loaded);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Persist encrypted root state to localStorage
  useEffect(() => {
    if (!hydrated) return;
    void saveRootAsync(root, sessionMasterKeys);
  }, [root, hydrated, sessionMasterKeys]);

  // Auto-lock E2EE accounts with autoLock enabled when leaving tab/app
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) return;
      const autoLockIds = root.accts
        .filter((a) => a.e2ee?.enabled && a.e2ee.autoLock && unlockedIds[a.id])
        .map((a) => a.id);
      if (autoLockIds.length === 0) return;

      void (async () => {
        const updatedAccts = await Promise.all(
          root.accts.map(async (a) => {
            if (!autoLockIds.includes(a.id)) return a;
            const mk = sessionMasterKeys[a.id];
            const reenc = mk ? await reencryptAccountVault(a, mk) : a;
            return stripPrivateFields(reenc);
          })
        );
        setRoot((prev) => ({ ...prev, accts: updatedAccts }));
        setSessionMasterKeys((prev) => {
          const next = { ...prev };
          autoLockIds.forEach((id) => delete next[id]);
          return next;
        });
        setUnlockedIds((prev) => {
          const next = { ...prev };
          autoLockIds.forEach((id) => delete next[id]);
          return next;
        });
      })();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [root.accts, unlockedIds, sessionMasterKeys]);

  // Firebase Auth listener + load active shop workspace (strictly clears prior user state on switch)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
      setShop(null);
      setMember(null);
      setUserShops([]);
      setShopDirectory([]);
      setShopAccounts([]);
      setFollowedStaffIds(new Set());
      setShopShares([]);
      setShopMembers([]);
      setShopRequests([]);
      setSelectedCloudStaffId('');
      setSelectedDateKey(null);
      setLedgerShareOpen(false);
      setStoryViewerAccountId(null);
      if (!user) {
        return;
      }

      void (async () => {
        try {
          const { activeShopId, shopIds } = await ensureUserDoc(user);
          const shopsList = await loadUserShops(user, shopIds);
          setUserShops(shopsList);
          if (activeShopId) {
            const ctx = await loadActiveShopContext(user, activeShopId);
            if (ctx) {
              setShop(ctx.shop);
              setMember(ctx.member);
              setSelectedCloudStaffId(ctx.member.staffId || '');
            }
          }
        } catch (err) {
          console.error('Failed loading user shop context:', err);
        }
      })();
    });
    return () => unsub();
  }, []);

  // Subscribe to active Shop Workspace (Directory, isolated Private Staff, Follows, Shares, Requests, Live Permissions)
  useEffect(() => {
    if (!firebaseUser || !shop || !member || member.shopId !== shop.shopId) {
      return;
    }
    const unsub = subscribeShopWorkspace(shop, firebaseUser, member.role, {
      onDirectory: setShopDirectory,
      onPrivateAccounts: (accts) => {
        setShopAccounts(accts);
        if (accts.length > 0) {
          setSelectedCloudStaffId((prev) =>
            prev && accts.some((a) => a.id === prev) ? prev : accts[0].id
          );
        }
      },
      onFollows: setFollowedStaffIds,
      onShares: setShopShares,
      onMembers: setShopMembers,
      onRequests: setShopRequests,
      onMemberChange: (updated) => {
        setMember((prev) =>
          prev &&
          prev.role === updated.role &&
          prev.staffId === updated.staffId &&
          JSON.stringify(prev.permissions || null) ===
            JSON.stringify(updated.permissions || null)
            ? prev
            : updated
        );
      },
      onMembershipRevoked: () => {
        setShop(null);
        setMember(null);
        setShopDirectory([]);
        setShopAccounts([]);
        setFollowedStaffIds(new Set());
        setShopShares([]);
        setShopMembers([]);
        setShopRequests([]);
        setSelectedCloudStaffId('');
      },
    });
    workspaceUnsubRef.current = unsub;
    return () => {
      if (workspaceUnsubRef.current === unsub) {
        workspaceUnsubRef.current = null;
      }
      unsub();
    };
  }, [firebaseUser, shop?.shopId, member?.shopId, member?.role]);

  const isCloudActive = Boolean(firebaseUser && shop && member);
  const cloudRole: ShopRole | null =
    isCloudActive && member ? member.role : null;
  const isCloudStaff = cloudRole === 'staff';
  const isCloudOwnerOrManager =
    cloudRole === 'owner' || cloudRole === 'manager';
  const effectivePermissions = useMemo(
    () => resolveEffectivePermissions(cloudRole, member?.permissions),
    [cloudRole, member?.permissions]
  );

  const activeAccounts = useMemo<Account[]>(() => {
    if (!isCloudActive) return root.accts;
    if (shopAccounts.length > 0) return shopAccounts;
    return [
      {
        id: member?.staffId || 'cloud_loading',
        name: member?.displayName || firebaseUser?.displayName || 'Staff',
        days: {},
        selfDays: {},
        money: [],
        sal: {},
        stories: [],
      },
    ];
  }, [isCloudActive, root.accts, shopAccounts, member, firebaseUser]);

  const currentAccount = useMemo(() => {
    if (isCloudActive) {
      return (
        activeAccounts.find((a) => a.id === selectedCloudStaffId) ||
        activeAccounts[0]
      );
    }
    return root.accts.find((a) => a.id === root.cur) || root.accts[0];
  }, [isCloudActive, activeAccounts, selectedCloudStaffId, root]);

  const currentAccountIndex = useMemo(() => {
    const idx = activeAccounts.findIndex((a) => a.id === currentAccount.id);
    return idx >= 0 ? idx : 0;
  }, [activeAccounts, currentAccount.id]);

  // Month boundaries and clamped upToDate
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const monthStart = makeDateKey(year, monthIndex, 1);
  const monthEnd = makeDateKey(year, monthIndex, daysInMonth);

  useEffect(() => {
    if (upToDate < monthStart || upToDate > monthEnd) {
      const nextDefault =
        todayKey >= monthStart && todayKey <= monthEnd ? todayKey : monthEnd;
      setUpToDate(nextDefault);
    }
  }, [year, monthIndex, monthStart, monthEnd, todayKey, upToDate]);

  const effectiveUpToDate =
    upToDate >= monthStart && upToDate <= monthEnd
      ? upToDate
      : todayKey >= monthStart && todayKey <= monthEnd
        ? todayKey
        : monthEnd;

  const calculation = useMemo(
    () =>
      calculateMonthSummary(
        currentAccount,
        year,
        monthIndex,
        effectiveUpToDate,
        todayKey
      ),
    [currentAccount, year, monthIndex, effectiveUpToDate, todayKey]
  );

  const isLocked =
    !isCloudActive &&
    Boolean(
      (currentAccount.e2ee?.enabled || currentAccount.pin) &&
        !unlockedIds[currentAccount.id]
    );

  const updateCurrentAccount = (updater: (acct: Account) => Account) => {
    setRoot((prev) => ({
      ...prev,
      accts: prev.accts.map((a) =>
        a.id === currentAccount.id ? updater(a) : a
      ),
    }));
  };

  const applyMoneyForDate = (
    money: MoneyEntry[],
    dateKey: string,
    advance: number,
    payment: number
  ): MoneyEntry[] => {
    const filtered = money.filter((m) => m.d !== dateKey);
    const nowTs = Date.now();
    if (advance > 0) {
      filtered.push({ id: nowTs + 1, t: 'adv', a: advance, d: dateKey, n: '' });
    }
    if (payment > 0) {
      filtered.push({ id: nowTs + 2, t: 'pay', a: payment, d: dateKey, n: '' });
    }
    return filtered;
  };

  const handleSaveDayStatus = (
    dateKey: string,
    status: AttendanceStatus,
    note: string,
    advance: number,
    payment: number
  ) => {
    if (isCloudActive && shop) {
      if (isCloudStaff) {
        const prevSelf = currentAccount.selfDays?.[dateKey];
        const nextSelfDays = {
          ...(currentAccount.selfDays || {}),
          [dateKey]: {
            ...prevSelf,
            s: status,
            n: note,
          },
        };
        void saveStaffSelfAttendance(
          shop.shopId,
          currentAccount.id,
          nextSelfDays
        );
      } else {
        if (!effectivePermissions.canMarkAttendance) return;
        const prevDay = currentAccount.days[dateKey];
        const nextDays = {
          ...currentAccount.days,
          [dateKey]: {
            ...prevDay,
            s: status,
            n: note,
          },
        };
        const patch: {
          days: typeof nextDays;
          money?: MoneyEntry[];
        } = { days: nextDays };
        if (effectivePermissions.canManageMoney) {
          patch.money = applyMoneyForDate(
            currentAccount.money,
            dateKey,
            advance,
            payment
          );
        }
        void saveOwnerStaffPatch(shop.shopId, currentAccount.id, patch);
      }
      setSelectedDateKey(null);
      return;
    }

    updateCurrentAccount((acct) => ({
      ...acct,
      days: {
        ...acct.days,
        [dateKey]: { ...acct.days[dateKey], s: status, n: note },
      },
      money: applyMoneyForDate(acct.money, dateKey, advance, payment),
    }));
    setSelectedDateKey(null);
  };

  const handleSaveNoteAndMoneyOnly = (
    dateKey: string,
    note: string,
    advance: number,
    payment: number
  ) => {
    if (isCloudActive && shop) {
      if (isCloudStaff) return;
      if (
        !effectivePermissions.canManageMoney &&
        !effectivePermissions.canMarkAttendance
      ) {
        return;
      }
      const existing = currentAccount.days[dateKey];
      const nextDays = { ...currentAccount.days };
      if (existing?.s || note) {
        nextDays[dateKey] = { ...existing, s: existing?.s || '', n: note };
      }
      const patch: {
        days: typeof nextDays;
        money?: MoneyEntry[];
      } = { days: nextDays };
      if (effectivePermissions.canManageMoney) {
        patch.money = applyMoneyForDate(
          currentAccount.money,
          dateKey,
          advance,
          payment
        );
      }
      void saveOwnerStaffPatch(shop.shopId, currentAccount.id, patch);
      setSelectedDateKey(null);
      return;
    }

    updateCurrentAccount((acct) => {
      const existing = acct.days[dateKey];
      const nextDays = { ...acct.days };
      if (existing?.s || note) {
        nextDays[dateKey] = { ...existing, s: existing?.s || '', n: note };
      }
      return {
        ...acct,
        days: nextDays,
        money: applyMoneyForDate(acct.money, dateKey, advance, payment),
      };
    });
    setSelectedDateKey(null);
  };

  const handleClearDayMoney = (dateKey: string) => {
    if (isCloudActive && shop) {
      if (isCloudStaff || !effectivePermissions.canManageMoney) return;
      const nextMoney = currentAccount.money.filter((m) => m.d !== dateKey);
      void saveOwnerStaffPatch(shop.shopId, currentAccount.id, {
        money: nextMoney,
      });
      setSelectedDateKey(null);
      return;
    }

    updateCurrentAccount((acct) => ({
      ...acct,
      money: acct.money.filter((m) => m.d !== dateKey),
    }));
    setSelectedDateKey(null);
  };

  const handleClearDayStatus = (dateKey: string) => {
    if (isCloudActive && shop) {
      if (isCloudStaff) {
        const nextSelf = { ...(currentAccount.selfDays || {}) };
        delete nextSelf[dateKey];
        void saveStaffSelfAttendance(shop.shopId, currentAccount.id, nextSelf);
      } else {
        if (!effectivePermissions.canMarkAttendance) return;
        const nextDays = { ...currentAccount.days };
        delete nextDays[dateKey];
        void saveOwnerStaffPatch(shop.shopId, currentAccount.id, {
          days: nextDays,
        });
      }
      setSelectedDateKey(null);
      return;
    }

    updateCurrentAccount((acct) => {
      const nextDays = { ...acct.days };
      delete nextDays[dateKey];
      return {
        ...acct,
        days: nextDays,
      };
    });
    setSelectedDateKey(null);
  };

  const handleMarkTodayPresent = () => {
    if (isCloudActive && shop) {
      if (isCloudStaff) {
        const nowTime = formatTimeShort();
        const prevSelf = currentAccount.selfDays?.[todayKey];
        const nextSelfDays = {
          ...(currentAccount.selfDays || {}),
          [todayKey]: {
            ...prevSelf,
            s: 'P' as AttendanceStatus,
            n: prevSelf?.n || '',
            inTime: prevSelf?.inTime || nowTime,
          },
        };
        void saveStaffSelfAttendance(
          shop.shopId,
          currentAccount.id,
          nextSelfDays
        );
        const hasTodayPunch = shopRequests.some(
          (r) =>
            r.type === 'punch' &&
            r.fromDate === todayKey &&
            r.staffId === currentAccount.id
        );
        if (!hasTodayPunch && firebaseUser) {
          void submitShopRequest(shop, {
            staffId: currentAccount.id,
            staffUid: firebaseUser.uid,
            staffName: currentAccount.name || firebaseUser.displayName || 'Staff',
            type: 'punch',
            requestedStatus: 'P',
            fromDate: todayKey,
            toDate: todayKey,
            inTime: nowTime,
          });
        }
      } else {
        if (!effectivePermissions.canMarkAttendance) return;
        const nextDays = {
          ...currentAccount.days,
          [todayKey]: {
            ...currentAccount.days[todayKey],
            s: 'P' as AttendanceStatus,
            n: currentAccount.days[todayKey]?.n || '',
          },
        };
        void saveOwnerStaffPatch(shop.shopId, currentAccount.id, {
          days: nextDays,
        });
      }
      setYear(now.getFullYear());
      setMonthIndex(now.getMonth());
      setUpToDate(todayKey);
      return;
    }

    updateCurrentAccount((acct) => ({
      ...acct,
      days: {
        ...acct.days,
        [todayKey]: {
          ...acct.days[todayKey],
          s: 'P',
          n: acct.days[todayKey]?.n || '',
        },
      },
    }));
    setYear(now.getFullYear());
    setMonthIndex(now.getMonth());
    setUpToDate(todayKey);
  };

  const handleChangeSalary = (amount: number) => {
    if (isCloudStaff || (isCloudActive && !effectivePermissions.canEditSalary)) {
      return;
    }
    const ymKey = `${year}-${monthIndex + 1 < 10 ? '0' : ''}${monthIndex + 1}`;
    if (isCloudActive && shop) {
      const nextSal = { ...currentAccount.sal, [ymKey]: amount };
      void saveOwnerStaffPatch(shop.shopId, currentAccount.id, {
        sal: nextSal,
      });
      return;
    }
    updateCurrentAccount((acct) => ({
      ...acct,
      sal: {
        ...acct.sal,
        [ymKey]: amount,
      },
    }));
  };

  const handleAddLedgerEntry = (entry: Omit<MoneyEntry, 'id'>) => {
    if (isCloudStaff || (isCloudActive && !effectivePermissions.canManageMoney)) {
      return;
    }
    if (isCloudActive && shop) {
      const nextMoney = [...currentAccount.money, { ...entry, id: Date.now() }];
      void saveOwnerStaffPatch(shop.shopId, currentAccount.id, {
        money: nextMoney,
      });
      return;
    }
    updateCurrentAccount((acct) => ({
      ...acct,
      money: [...acct.money, { ...entry, id: Date.now() }],
    }));
  };

  const handleDeleteLedgerEntry = (id: number) => {
    if (isCloudStaff || (isCloudActive && !effectivePermissions.canManageMoney)) {
      return;
    }
    if (isCloudActive && shop) {
      const nextMoney = currentAccount.money.filter((m) => m.id !== id);
      void saveOwnerStaffPatch(shop.shopId, currentAccount.id, {
        money: nextMoney,
      });
      return;
    }
    updateCurrentAccount((acct) => ({
      ...acct,
      money: acct.money.filter((m) => m.id !== id),
    }));
  };

  const handleSelectAccount = (id: string) => {
    if (isCloudActive) {
      setSelectedCloudStaffId(id);
      setUpToDate(todayKey);
      return;
    }
    if (id === root.cur) return;
    setRoot((prev) => ({ ...prev, cur: id }));
    setUpToDate(todayKey);
  };

  const handleLockAccountNow = async (accountId: string) => {
    if (isCloudActive) return;
    const target = root.accts.find((a) => a.id === accountId);
    if (!target || (!target.e2ee?.enabled && !target.pin)) return;
    const mk = sessionMasterKeys[accountId];
    const reencrypted =
      target.e2ee?.enabled && mk
        ? await reencryptAccountVault(target, mk)
        : target;
    setRoot((prev) => ({
      ...prev,
      accts: prev.accts.map((a) =>
        a.id === accountId ? stripPrivateFields(reencrypted) : a
      ),
    }));
    setSessionMasterKeys((prev) => {
      const next = { ...prev };
      delete next[accountId];
      return next;
    });
    setUnlockedIds((prev) => {
      const next = { ...prev };
      delete next[accountId];
      return next;
    });
  };

  const handleSaveAccount = async (
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
  ) => {
    if (isCloudActive && shop) {
      if (mode === 'add') {
        if (isCloudStaff || !effectivePermissions.canManageStaff) return;
        const createdId = await addShopStaff(shop, payload);
        setSelectedCloudStaffId(createdId);
        setUpToDate(todayKey);
        return;
      }
      if (mode === 'edit' && payload.id) {
        if (isCloudStaff) {
          await saveStaffDirectoryProfile(shop.shopId, payload.id, {
            photo: payload.photo,
            emo: payload.emo,
          });
        } else {
          await saveOwnerStaffPatch(
            shop.shopId,
            payload.id,
            { name: payload.name, ph: payload.ph, em: payload.em },
            { name: payload.name, photo: payload.photo, emo: payload.emo }
          );
        }
        return;
      }
      return;
    }

    if (mode === 'add') {
      const newId = `a${Date.now()}`;
      const baseAcct: Account = {
        id: newId,
        name: payload.name,
        ph: payload.ph,
        em: payload.em,
        photo: payload.photo,
        emo: payload.emo,
        pin: '',
        days: {},
        money: [],
        sal: {},
        stories: [],
      };

      if (payload.passcode) {
        try {
          const {
            sealedAccount,
            masterKeyBytes,
            recoveryKeyFormatted,
          } = await sealAccountWithNewPasscode(
            baseAcct,
            payload.passcode,
            false
          );
          setSessionMasterKeys((prev) => ({
            ...prev,
            [newId]: masterKeyBytes,
          }));
          setUnlockedIds((prev) => ({ ...prev, [newId]: true }));
          setRoot((prev) => ({
            cur: newId,
            accts: [...prev.accts, sealedAccount],
          }));
          setRecoveryNotice({
            accountName: payload.name,
            key: recoveryKeyFormatted,
          });
          setUpToDate(todayKey);
          return;
        } catch {
          // fallback if WebCrypto fails
        }
      }

      setRoot((prev) => ({
        cur: newId,
        accts: [...prev.accts, baseAcct],
      }));
      setUnlockedIds((prev) => ({ ...prev, [newId]: true }));
      setUpToDate(todayKey);
    } else if (payload.id) {
      const target = root.accts.find((a) => a.id === payload.id);
      if (target && (target.e2ee?.enabled || target.pin) && !unlockedIds[target.id]) {
        return; // Cannot edit a locked account
      }
      setRoot((prev) => ({
        ...prev,
        accts: prev.accts.map((a) => {
          if (a.id !== payload.id) return a;
          return {
            ...a,
            name: payload.name,
            ph: payload.ph,
            em: payload.em,
            photo: payload.photo,
            emo: payload.emo,
          };
        }),
      }));
    }
  };

  const handleDeleteAccount = (id: string) => {
    if (isCloudActive && shop) {
      if (
        isCloudStaff ||
        !effectivePermissions.canManageStaff ||
        activeAccounts.length < 2
      ) {
        return;
      }
      const targetDir = shopDirectory.find((d) => d.staffId === id);
      const targetAcct = shopAccounts.find((a) => a.id === id);
      const linkedUid = targetDir?.linkedUid || targetAcct?.linkedUid || '';
      void deleteShopStaff(shop.shopId, id, {
        linkedUid,
        ownerUid: shop.ownerUid,
        isOwner: cloudRole === 'owner',
        managerUids: shop.managerUids,
      });
      return;
    }

    if (root.accts.length < 2) return;
    const target = root.accts.find((a) => a.id === id);
    if ((target?.e2ee?.enabled || target?.pin) && !unlockedIds[id]) {
      setRoot((prev) => ({ ...prev, cur: id }));
      setAccountModal({ open: false, mode: 'list' });
      return;
    }
    target?.stories?.forEach((s) => {
      if (s.mediaId) void deleteMediaBlob(s.mediaId);
    });
    setSessionMasterKeys((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setUnlockedIds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setRoot((prev) => {
      const remaining = prev.accts.filter((a) => a.id !== id);
      return {
        cur: prev.cur === id ? remaining[0].id : prev.cur,
        accts: remaining,
      };
    });
  };

  const openStoryComposer = (mode: StoryMediaType = 'photo') => {
    setStoryComposerMode(mode);
    setStoryComposerOpen(true);
  };

  const handlePostStory = (
    story: Omit<Story, 'id' | 'ts'> & { id?: string }
  ) => {
    const newStory: Story = {
      ...story,
      id: story.id || `s${Date.now()}`,
      ts: Date.now(),
    };
    if (isCloudActive && shop) {
      const targetDir = shopDirectory.find(
        (d) => d.staffId === currentAccount.id
      );
      const existing = targetDir?.stories || currentAccount.stories || [];
      const kept = [...existing, newStory].slice(-8);
      void saveStaffDirectoryProfile(shop.shopId, currentAccount.id, {
        stories: kept,
      });
      return;
    }

    updateCurrentAccount((acct) => {
      const existing = acct.stories || [];
      const combined = [...existing, newStory];
      const kept = combined.slice(-12);
      const removed = combined.slice(0, Math.max(0, combined.length - 12));
      removed.forEach((s) => {
        if (s.mediaId) void deleteMediaBlob(s.mediaId);
      });
      return {
        ...acct,
        stories: kept,
      };
    });
  };

  const handleDeleteStory = (accountId: string, storyId: string) => {
    if (isCloudActive && shop) {
      if (!isCloudOwnerOrManager && accountId !== currentAccount.id) return;
      const targetDir = shopDirectory.find((d) => d.staffId === accountId);
      const nextStories = (targetDir?.stories || []).filter(
        (s) => s.id !== storyId
      );
      void saveStaffDirectoryProfile(shop.shopId, accountId, {
        stories: nextStories,
      });
      return;
    }

    const acct = root.accts.find((a) => a.id === accountId);
    const target = acct?.stories?.find((s) => s.id === storyId);
    if (target?.mediaId) {
      void deleteMediaBlob(target.mediaId);
    }
    setRoot((prev) => ({
      ...prev,
      accts: prev.accts.map((a) =>
        a.id === accountId
          ? {
              ...a,
              stories: (a.stories || []).filter((s) => s.id !== storyId),
            }
          : a
      ),
    }));
  };

  const handleReactStory = (
    accountId: string,
    storyId: string,
    emoji: string
  ) => {
    if (isCloudActive && shop) {
      if (!isCloudOwnerOrManager && accountId !== currentAccount.id) return;
      const targetDir = shopDirectory.find((d) => d.staffId === accountId);
      if (!targetDir) return;
      const nextStories = targetDir.stories.map((s) =>
        s.id === storyId
          ? {
              ...s,
              reactions: {
                ...(s.reactions || {}),
                [emoji]: ((s.reactions || {})[emoji] || 0) + 1,
              },
            }
          : s
      );
      void saveStaffDirectoryProfile(shop.shopId, accountId, {
        stories: nextStories,
      });
      return;
    }

    setRoot((prev) => ({
      ...prev,
      accts: prev.accts.map((a) =>
        a.id === accountId
          ? {
              ...a,
              stories: (a.stories || []).map((s) =>
                s.id === storyId
                  ? {
                      ...s,
                      reactions: {
                        ...(s.reactions || {}),
                        [emoji]: ((s.reactions || {})[emoji] || 0) + 1,
                      },
                    }
                  : s
              ),
            }
          : a
      ),
    }));
  };

  const handleMarkStoryViewed = (accountId: string, storyId: string) => {
    setViewedStoryIds((prev) => {
      if (prev[storyId]) return prev;
      if (isCloudActive && shop) {
        if (isCloudOwnerOrManager || accountId === currentAccount.id) {
          const targetDir = shopDirectory.find((d) => d.staffId === accountId);
          if (targetDir) {
            const nextStories = targetDir.stories.map((s) =>
              s.id === storyId ? { ...s, views: (s.views || 0) + 1 } : s
            );
            void saveStaffDirectoryProfile(shop.shopId, accountId, {
              stories: nextStories,
            });
          }
        }
        return { ...prev, [storyId]: true };
      }

      setRoot((r) => ({
        ...r,
        accts: r.accts.map((a) =>
          a.id === accountId
            ? {
                ...a,
                stories: (a.stories || []).map((s) =>
                  s.id === storyId
                    ? { ...s, views: (s.views || 0) + 1 }
                    : s
                ),
              }
            : a
        ),
      }));
      return { ...prev, [storyId]: true };
    });
  };

  const handleAccountNameClick = () => {
    const nowMs = Date.now();
    if (
      nowMs - lastTapRef.current < 450 &&
      !isCloudStaff &&
      effectivePermissions.canManageStaff
    ) {
      lastTapRef.current = 0;
      setAccountModal({ open: true, mode: 'add' });
      return;
    }
    lastTapRef.current = nowMs;
    setAccountModal({ open: true, mode: 'list' });
  };

  const handleSwitchShopWorkspace = async (targetShopId: string) => {
    if (!firebaseUser || !targetShopId || targetShopId === shop?.shopId) return;
    const ctx = await switchActiveShop(firebaseUser, targetShopId);
    if (ctx) {
      setShopDirectory([]);
      setShopAccounts([]);
      setFollowedStaffIds(new Set());
      setShopShares([]);
      setShopMembers([]);
      setShopRequests([]);
      setShop(ctx.shop);
      setMember(ctx.member);
      setSelectedCloudStaffId(ctx.member.staffId || '');
    }
  };

  const selectedDaySelfRequest = useMemo(() => {
    if (!selectedDateKey || !isCloudActive) return undefined;
    return shopRequests.find(
      (r) =>
        r.staffId === currentAccount.id &&
        r.fromDate <= selectedDateKey &&
        r.toDate >= selectedDateKey
    );
  }, [selectedDateKey, isCloudActive, shopRequests, currentAccount.id]);

  const storyViewerAccounts = useMemo<Account[]>(() => {
    if (isCloudActive && shopDirectory.length > 0) {
      return shopDirectory.map((d) => ({
        id: d.staffId,
        name: d.name,
        photo: d.photo,
        emo: d.emo,
        days: {},
        money: [],
        sal: {},
        stories: d.stories || [],
      }));
    }
    return root.accts.filter(
      (a) => !(a.e2ee?.enabled || a.pin) || unlockedIds[a.id]
    );
  }, [isCloudActive, shopDirectory, root.accts, unlockedIds]);

  const defaultCloudShareText = useMemo(
    () =>
      buildLedgerStatementText(
        currentAccount,
        year,
        monthIndex,
        effectiveUpToDate,
        todayKey,
        'month'
      ),
    [currentAccount, year, monthIndex, effectiveUpToDate, todayKey]
  );

  const inAppShareRecipients = useMemo<InAppShareRecipient[]>(() => {
    if (!isCloudActive || !firebaseUser) return [];
    const emailByStaffId = new Map<string, string>();
    shopAccounts.forEach((a) => {
      const email = (a.linkedEmail || a.em || '').trim().toLowerCase();
      if (email) emailByStaffId.set(a.id, email);
    });
    return shopDirectory
      .filter((d) => {
        const isSelf =
          (d.linkedUid && d.linkedUid === firebaseUser.uid) ||
          d.staffId === member?.staffId;
        if (isSelf) return false;
        const email = emailByStaffId.get(d.staffId) || '';
        return Boolean(d.linkedUid || email);
      })
      .map((d) => ({
        staffId: d.staffId,
        name: d.name,
        roleLabel: d.roleLabel,
        uid: d.linkedUid || '',
        email: emailByStaffId.get(d.staffId) || '',
      }));
  }, [isCloudActive, firebaseUser, shopDirectory, shopAccounts, member?.staffId]);

  const receivedSharesCount = useMemo(() => {
    if (!firebaseUser) return 0;
    const myEmail = (firebaseUser.email || '').trim().toLowerCase();
    return shopShares.filter(
      (s) =>
        s.recipientUid === firebaseUser.uid ||
        (Boolean(myEmail) && (s.recipientEmail || '').toLowerCase() === myEmail)
    ).length;
  }, [shopShares, firebaseUser]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Encrypted Vault खुल रहा है…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top Bar (3-zone contract on desktop, compact non-sticky on mobile to keep mobile sticky height well under 15%) */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:sticky md:top-0 md:z-30">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:px-6 md:gap-8">
          {/* Zone 1: Brand Wordmark */}
          <span className="whitespace-nowrap shrink-0 text-base font-bold tracking-tight text-slate-900 sm:text-lg dark:text-white">
            Attendance
          </span>

          {/* Zone 2: Clean Desktop Section Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#calendar-section"
              className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 dark:hover:text-white"
            >
              हाज़िरी कैलेंडर
            </a>
            <a
              href="#hisab-section"
              className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 dark:hover:text-white"
            >
              सैलरी हिसाब
            </a>
            <a
              href="#ledger-section"
              className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 dark:hover:text-white"
            >
              लेन-देन
            </a>
            <a
              href="#backup-section"
              className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 dark:hover:text-white"
            >
              Backup
            </a>
          </nav>

          {/* Zone 3: Top-Right Account Pill, Add Staff, Share/Download & Day/Night */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className="relative flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-1 py-0.5 sm:px-1.5 sm:py-1 dark:border-slate-700 dark:bg-slate-800">
              <Avatar
                account={currentAccount}
                index={currentAccountIndex}
                size="sm"
                showAddBadge
                onClick={() => setProfileMenuOpen((v) => !v)}
              />
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  handleAccountNameClick();
                }}
                className="inline-flex min-h-[30px] max-w-[68px] items-center gap-0.5 whitespace-nowrap rounded-lg px-1 py-1 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-200/60 sm:min-h-[32px] sm:max-w-[140px] sm:gap-1 sm:px-1.5 sm:text-sm dark:text-slate-100 dark:hover:bg-slate-700/60"
              >
                <span className="truncate">{currentAccount.name}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </button>

            {profileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute top-12 right-0 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                >
                  {getLiveStories(currentAccount).length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setStoryViewerAccountId(currentAccount.id);
                      }}
                      className="mb-1 flex min-h-[44px] w-full items-center gap-3 rounded-xl bg-indigo-50 px-3 py-2 text-left text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-950"
                    >
                      <Eye className="h-4 w-4 shrink-0" />
                      <span className="flex-1">Status / Reels देखें</span>
                      <span className="font-mono-num text-xs">
                        {getLiveStories(currentAccount).length}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      openStoryComposer('photo');
                    }}
                    className="flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <ImagePlus className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>फोटो Status लगाएं</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      openStoryComposer('reel');
                    }}
                    className="flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <Clapperboard className="h-4 w-4 shrink-0 text-pink-600 dark:text-pink-400" />
                    <span>वीडियो / Reel लगाएं</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      openStoryComposer('text');
                    }}
                    className="flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <Type className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    <span>टेक्स्ट Status लगाएं</span>
                  </button>

                  <div className="mt-1.5 border-t border-slate-100 pt-1.5 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        openShopTeam('team');
                      }}
                      className="flex min-h-[42px] w-full items-center gap-3 rounded-xl bg-indigo-50/70 px-3 py-2 text-left text-sm font-semibold text-indigo-800 transition-colors hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-950"
                    >
                      <Store className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">
                        {isCloudActive && shop
                          ? `${shop.name} (${cloudRole})`
                          : 'Shop टीम / Follow / Privacy'}
                      </span>
                    </button>

                    {!isCloudActive && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            setSecurityModalOpen(true);
                          }}
                          className="mt-1 flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
                        >
                          <ShieldCheck className="h-4 w-4 shrink-0" />
                          <span className="flex-1">
                            {currentAccount.e2ee?.enabled
                              ? 'E2EE Encryption चालू है'
                              : 'Encryption Lock लगाएं'}
                          </span>
                        </button>

                        {(currentAccount.e2ee?.enabled ||
                          currentAccount.pin) && (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              void handleLockAccountNow(currentAccount.id);
                            }}
                            className="flex min-h-[40px] w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Lock className="h-3.5 w-3.5 shrink-0" />
                            <span>अभी Account लॉक करें</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {storyViewerAccounts.some(
                    (a) =>
                      a.id !== currentAccount.id &&
                      getLiveStories(a).length > 0
                  ) && (
                    <div className="mt-1.5 border-t border-slate-100 pt-2 dark:border-slate-800">
                      <div className="px-3 pb-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        अन्य Staff के Status
                      </div>
                      <div className="flex flex-wrap gap-2 px-2 pb-1">
                        {storyViewerAccounts.map((acct, idx) => {
                          if (
                            acct.id === currentAccount.id ||
                            getLiveStories(acct).length === 0
                          ) {
                            return null;
                          }
                          return (
                            <button
                              key={acct.id}
                              type="button"
                              onClick={() => {
                                setProfileMenuOpen(false);
                                setStoryViewerAccountId(acct.id);
                              }}
                              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Avatar account={acct} index={idx} size="sm" />
                              <span className="max-w-[80px] truncate">
                                {acct.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            </div>

            {!isCloudActive && (
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  openShopTeam('team');
                }}
                aria-label="अपनी Shop बनाएं या जुड़ें"
                title="Shop लॉगिन / बनाएं / जुड़ें"
                className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 text-indigo-700 transition-colors hover:bg-indigo-100 sm:h-10 sm:px-3 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200 dark:hover:bg-indigo-950"
              >
                <Store className="h-4 w-4 shrink-0" />
                <span className="text-xs font-semibold">
                  {firebaseUser ? 'मेरी Shop' : 'Shop लॉगिन'}
                </span>
              </button>
            )}

            {isCloudStaff || (isCloudActive && !effectivePermissions.canManageStaff) ? (
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  openShopTeam('team');
                }}
                aria-label="Shop टीम, Follow व Data Share"
                title="Shop टीम / Follow / Share"
                className="inline-flex h-9 w-9 items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 transition-colors hover:bg-indigo-100 sm:h-10 sm:w-auto sm:px-3 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200 dark:hover:bg-indigo-950"
              >
                <Store className="h-4 w-4" />
                <span className="hidden sm:inline text-xs font-semibold">
                  टीम / Share
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setAccountModal({ open: true, mode: 'add' });
                }}
                aria-label="नया Staff / Account जोड़ें"
                title="नया Staff जोड़ें"
                className="inline-flex h-9 w-9 items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 sm:h-10 sm:w-auto sm:px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline text-xs font-semibold">
                  Staff जोड़ें
                </span>
              </button>
            )}

            <AppShareDownloadButton />

            <button
              type="button"
              onClick={() =>
                setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
              }
              aria-label={
                theme === 'dark' ? 'लाइट मोड चालू करें' : 'डार्क मोड चालू करें'
              }
              title={theme === 'dark' ? 'Day Mode' : 'Night Mode'}
              className="inline-flex h-9 w-9 items-center justify-center shrink-0 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 sm:h-10 sm:w-10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-600" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 pt-4 pb-24 sm:px-6 md:py-6">
        <PWAInstallBanner />
        {!isCloudActive && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-900 dark:text-white">
                  100% प्राइवेट Shop अकाउंट — हर दुकान का डेटा अलग व सुरक्षित
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  किसी अन्य शॉपकीपर या स्टाफ़ को आपकी Shop का नाम या डेटा कभी नहीं दिखता।
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openShopTeam('team')}
              className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              <Store className="h-3.5 w-3.5" />
              <span>
                {firebaseUser ? 'अपनी Shop खोलें' : 'Shop बनाएं / Staff जुड़ें'}
              </span>
            </button>
          </div>
        )}
        {/* Cloud Shop Banner (only when inside a multi-user Shop) */}
        {isCloudActive && shop && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-2.5 text-xs dark:border-indigo-900 dark:bg-indigo-950/40">
            <div className="flex flex-wrap items-center gap-2">
              <Store className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              {userShops.length > 1 ? (
                <select
                  aria-label="Branch / Shop चुनें"
                  value={shop.shopId}
                  onChange={(e) => {
                    void handleSwitchShopWorkspace(e.target.value);
                  }}
                  className="max-w-[200px] rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-800 dark:bg-slate-900 dark:text-white"
                >
                  {userShops.map((item) => (
                    <option key={item.shop.shopId} value={item.shop.shopId}>
                      {item.shop.name} ({item.role})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-bold text-slate-900 dark:text-white">
                  {shop.name}
                </span>
              )}
              <span className="rounded bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700 dark:bg-slate-900 dark:text-indigo-300">
                {cloudRole}
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                {isCloudStaff
                  ? '· केवल आपका निजी डेटा (बाकी साथी सुरक्षित)'
                  : `· ${activeAccounts.length} स्टाफ़ अकाउंट सक्रिय`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openShopTeam('team')}
                className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300"
              >
                <Store className="h-3.5 w-3.5" />
                <span>
                  {userShops.length > 1
                    ? `Shops (${userShops.length})`
                    : 'Shop / टीम'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => openShopTeam('share')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <Send className="h-3.5 w-3.5" />
                <span>
                  App में भेजें
                  {receivedSharesCount > 0 ? ` (${receivedSharesCount})` : ''}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Staff Self-Service Hub (for Staff) & Approval Queue (for Owner / Manager) */}
        {isCloudActive && shop && member && cloudRole && firebaseUser && (
          <StaffSelfServiceCard
            role={cloudRole}
            permissions={effectivePermissions}
            account={currentAccount}
            calculation={calculation}
            todayKey={todayKey}
            requests={shopRequests}
            onPunchIn={async ({
              requestedStatus,
              inTime,
              gps,
              selfie,
              reason,
            }) => {
              await submitShopRequest(shop, {
                staffId: currentAccount.id,
                staffUid: firebaseUser.uid,
                staffName:
                  currentAccount.name || firebaseUser.displayName || 'Staff',
                type: 'punch',
                requestedStatus,
                fromDate: todayKey,
                toDate: todayKey,
                reason,
                inTime,
                gps,
                selfie,
              });
              const nextSelfDays = {
                ...(currentAccount.selfDays || {}),
                [todayKey]: {
                  ...(currentAccount.selfDays?.[todayKey] || {}),
                  s: requestedStatus as AttendanceStatus,
                  n: reason,
                  inTime,
                  ...(gps ? { gps } : {}),
                },
              };
              await saveStaffSelfAttendance(
                shop.shopId,
                currentAccount.id,
                nextSelfDays
              );
            }}
            onPunchOut={async (requestId, outTime, gps) => {
              await updatePendingPunchOut(shop.shopId, requestId, outTime, gps);
              const prevSelf = currentAccount.selfDays?.[todayKey];
              const nextSelfDays = {
                ...(currentAccount.selfDays || {}),
                [todayKey]: {
                  s: prevSelf?.s || ('P' as AttendanceStatus),
                  n: prevSelf?.n || '',
                  ...(prevSelf?.inTime ? { inTime: prevSelf.inTime } : {}),
                  outTime,
                  ...(gps
                    ? { gps }
                    : prevSelf?.gps
                      ? { gps: prevSelf.gps }
                      : {}),
                },
              };
              await saveStaffSelfAttendance(
                shop.shopId,
                currentAccount.id,
                nextSelfDays
              );
            }}
            onSubmitLeave={async ({
              fromDate,
              toDate,
              requestedStatus,
              reason,
            }) => {
              await submitShopRequest(shop, {
                staffId: currentAccount.id,
                staffUid: firebaseUser.uid,
                staffName:
                  currentAccount.name || firebaseUser.displayName || 'Staff',
                type: 'leave',
                requestedStatus,
                fromDate,
                toDate,
                reason,
              });
            }}
            onReviewRequest={async (req, decision, reviewNote) => {
              if (!effectivePermissions.canApproveRequests) return;
              const targetAcct = shopAccounts.find((a) => a.id === req.staffId);
              await reviewShopRequest(
                shop,
                req,
                targetAcct?.days || {},
                decision,
                firebaseUser.uid,
                member.displayName || firebaseUser.displayName || 'Owner',
                reviewNote
              );
            }}
            onDeleteRequest={async (requestId) => {
              await deleteShopRequest(shop.shopId, requestId);
            }}
            onShareLedger={() => setLedgerShareOpen(true)}
          />
        )}

        {/* Desktop 2-Column Workspace / Mobile Tabbed Workspace */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
          {/* Left Column: Attendance Calendar */}
          <div
            id="calendar-section"
            className={`lg:col-span-7 ${
              mobileTab === 'calendar' ? 'block' : 'hidden lg:block'
            }`}
          >
            <CalendarCard
              account={currentAccount}
              year={year}
              monthIndex={monthIndex}
              todayKey={todayKey}
              cloudRole={cloudRole}
              readOnlyAttendance={
                isCloudActive && !isCloudStaff && !effectivePermissions.canMarkAttendance
              }
              onPrevMonth={() => {
                if (monthIndex === 0) {
                  setMonthIndex(11);
                  setYear((y) => y - 1);
                } else {
                  setMonthIndex((m) => m - 1);
                }
              }}
              onNextMonth={() => {
                if (monthIndex === 11) {
                  setMonthIndex(0);
                  setYear((y) => y + 1);
                } else {
                  setMonthIndex((m) => m + 1);
                }
              }}
              onSelectDate={(k) => setSelectedDateKey(k)}
              onMarkTodayPresent={handleMarkTodayPresent}
            />
          </div>

          {/* Right Column: Hisab, Ledger, Backup */}
          <div className="space-y-5 lg:col-span-5">
            <div
              id="hisab-section"
              className={mobileTab === 'hisab' ? 'block' : 'hidden lg:block'}
            >
              <HisabCard
                account={currentAccount}
                upToDate={effectiveUpToDate}
                monthStart={monthStart}
                monthEnd={monthEnd}
                calculation={calculation}
                readOnlyFinance={
                  isCloudStaff ||
                  (isCloudActive && !effectivePermissions.canEditSalary)
                }
                readOnlyHint={
                  cloudRole === 'manager'
                    ? 'Manager अधिकार सीमित — Owner से अनुमति लें'
                    : undefined
                }
                onChangeUpToDate={setUpToDate}
                onChangeSalary={handleChangeSalary}
                onShareLedger={() => setLedgerShareOpen(true)}
              />
            </div>

            <div
              id="ledger-section"
              className={mobileTab === 'hisab' ? 'block' : 'hidden lg:block'}
            >
              <LedgerCard
                entries={calculation.monthMoney}
                defaultDate={effectiveUpToDate}
                readOnlyFinance={
                  isCloudStaff ||
                  (isCloudActive && !effectivePermissions.canManageMoney)
                }
                readOnlyHint={
                  cloudRole === 'manager'
                    ? 'Advance व Payment का अधिकार इस Manager के लिए बंद है — Owner से अनुमति लें।'
                    : undefined
                }
                onAddEntry={handleAddLedgerEntry}
                onDeleteEntry={handleDeleteLedgerEntry}
                onShareLedger={() => setLedgerShareOpen(true)}
              />
            </div>

            <div
              id="backup-section"
              className={mobileTab === 'backup' ? 'block' : 'hidden lg:block'}
            >
              <BackupCard
                rootState={root}
                sessionMasterKeys={sessionMasterKeys}
                onRestore={(restored) => {
                  setRoot(restored);
                  setUnlockedIds({});
                  setSessionMasterKeys({});
                  setUpToDate(todayKey);
                }}
              />
            </div>
          </div>
        </div>

        {/* Policy-compliant Google AdSense slot (renders only when VITE_ADSENSE_* env vars are set) */}
        <AdBanner />

        {/* Quiet Footer with About, Privacy Policy, Terms & Contact links */}
        <footer className="mt-6 border-t border-slate-200/80 pt-4 pb-2 text-center text-xs text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
            <button
              type="button"
              onClick={() => setLegalTab('about')}
              className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
            >
              ऐप के बारे में
            </button>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            <button
              type="button"
              onClick={() => setLegalTab('privacy')}
              className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
            >
              प्राइवेसी पॉलिसी
            </button>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            <button
              type="button"
              onClick={() => setLegalTab('terms')}
              className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
            >
              नियम व शर्तें
            </button>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            <button
              type="button"
              onClick={() => setLegalTab('contact')}
              className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
            >
              संपर्क
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            Attendance — हाज़िरी व सैलरी हिसाब
          </p>
        </footer>
      </main>

      {/* Mobile Bottom Navigation Bar (56px height, <15% viewport cap) */}
      <nav
        aria-label="मुख्य नेविगेशन"
        className="fixed inset-x-0 bottom-0 z-30 select-none border-t border-slate-200 bg-white/95 backdrop-blur-md pb-safe lg:hidden dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="grid h-14 grid-cols-4">
          <button
            type="button"
            onClick={() => setMobileTab('calendar')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
              mobileTab === 'calendar'
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <CalendarDays className="h-5 w-5" />
            <span>हाज़िरी</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('hisab')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
              mobileTab === 'hisab'
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <IndianRupee className="h-5 w-5" />
            <span>हिसाब</span>
          </button>

          <button
            type="button"
            onClick={() => openShopTeam('team')}
            className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
              shopTeamOpen
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Store className="h-5 w-5" />
            <span>{isCloudActive ? 'Shop / टीम' : 'Shop'}</span>
            {receivedSharesCount > 0 && (
              <span className="absolute top-1.5 right-4 h-2 w-2 rounded-full bg-indigo-600" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('backup')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
              mobileTab === 'backup'
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <UserCircle2 className="h-5 w-5" />
            <span>Backup</span>
          </button>
        </div>
      </nav>

      {/* Modals & Overlays */}
      <DaySheetModal
        dateKey={selectedDateKey}
        account={currentAccount}
        cloudRole={cloudRole}
        canMarkAttendance={effectivePermissions.canMarkAttendance}
        canManageMoney={effectivePermissions.canManageMoney}
        daySelfRequest={selectedDaySelfRequest}
        onClose={() => setSelectedDateKey(null)}
        onSaveStatus={handleSaveDayStatus}
        onSaveNoteAndMoneyOnly={handleSaveNoteAndMoneyOnly}
        onClearMoney={handleClearDayMoney}
        onClearStatus={handleClearDayStatus}
      />

      <LedgerShareModal
        isOpen={ledgerShareOpen}
        account={currentAccount}
        year={year}
        monthIndex={monthIndex}
        upToDate={effectiveUpToDate}
        todayKey={todayKey}
        inAppShareContext={{
          isCloudActive,
          recipients: inAppShareRecipients,
          onSendToStaff: async (recipient, title, summaryText) => {
            if (!firebaseUser || !shop) return;
            await sendInAppShare(
              shop,
              firebaseUser.uid,
              currentAccount.name || firebaseUser.displayName || 'Staff',
              recipient.uid,
              recipient.name,
              title,
              summaryText,
              {
                recipientEmail: recipient.email,
                recipientStaffId: recipient.staffId,
              }
            );
          },
          onOpenShopTeam: () => {
            openShopTeam(isCloudActive ? 'share' : 'team');
          },
        }}
        onClose={() => setLedgerShareOpen(false)}
      />

      <AccountModal
        isOpen={accountModal.open}
        initialMode={accountModal.mode}
        accounts={activeAccounts}
        currentAccount={currentAccount}
        unlockedIds={unlockedIds}
        cloudRole={cloudRole}
        canManageStaff={effectivePermissions.canManageStaff}
        onClose={() => setAccountModal((s) => ({ ...s, open: false }))}
        onSelectAccount={handleSelectAccount}
        onSaveAccount={handleSaveAccount}
        onDeleteAccount={handleDeleteAccount}
        onOpenStoryComposer={() => setStoryComposerOpen(true)}
        onOpenStoryViewer={(accountId) => {
          const acct = storyViewerAccounts.find((a) => a.id === accountId);
          if (acct && getLiveStories(acct).length > 0) {
            setAccountModal((s) => ({ ...s, open: false }));
            setStoryViewerAccountId(accountId);
          } else if (accountId === currentAccount.id) {
            setAccountModal((s) => ({ ...s, open: false }));
            setStoryComposerOpen(true);
          }
        }}
        onOpenSecurity={() => setSecurityModalOpen(true)}
        onOpenShopTeam={() => openShopTeam('team')}
      />

      <ShopTeamModal
        isOpen={shopTeamOpen}
        initialTab={shopTeamInitialTab}
        firebaseUser={firebaseUser}
        authLoading={authLoading}
        shop={shop}
        member={member}
        userShops={userShops}
        accounts={activeAccounts}
        effectivePermissions={effectivePermissions}
        directory={shopDirectory}
        followedStaffIds={followedStaffIds}
        shares={shopShares}
        members={shopMembers}
        currentAccount={currentAccount}
        defaultShareTitle={`${currentAccount.name} — Attendance & Ledger Report`}
        defaultShareText={defaultCloudShareText}
        onClose={() => setShopTeamOpen(false)}
        onGoogleLogin={async () => {
          await signInWithPopup(auth, googleProvider);
        }}
        onGoogleLogout={async () => {
          await signOut(auth);
        }}
        onCreateShop={async (shopName, syncLocal) => {
          if (!firebaseUser) return;
          const ownerSeed: Account = {
            id: 'a1',
            name:
              firebaseUser.displayName || root.accts[0]?.name || 'Shop Owner',
            ph: root.accts[0]?.ph || '',
            em: firebaseUser.email || '',
            photo: root.accts[0]?.photo || '',
            emo: root.accts[0]?.emo || '',
            days: {},
            money: [],
            sal: {},
            stories: [],
          };
          const seedList = syncLocal ? root.accts : [ownerSeed];
          const res = await createShopWorkspace(
            firebaseUser,
            shopName,
            seedList
          );
          setShopDirectory([]);
          setShopAccounts([]);
          setFollowedStaffIds(new Set());
          setShopShares([]);
          setShopMembers([]);
          setShopRequests([]);
          setShop(res.shop);
          setMember(res.member);
          setSelectedCloudStaffId(res.member.staffId || '');
          const { shopIds } = await ensureUserDoc(firebaseUser);
          const refreshedShops = await loadUserShops(firebaseUser, shopIds);
          setUserShops(refreshedShops);
        }}
        onJoinShop={async (code) => {
          if (!firebaseUser) return;
          const res = await joinShopByCode(firebaseUser, code);
          setShopDirectory([]);
          setShopAccounts([]);
          setFollowedStaffIds(new Set());
          setShopShares([]);
          setShopMembers([]);
          setShopRequests([]);
          setShop(res.shop);
          setMember(res.member);
          setSelectedCloudStaffId(res.member.staffId || '');
          const { shopIds } = await ensureUserDoc(firebaseUser);
          const refreshedShops = await loadUserShops(firebaseUser, shopIds);
          setUserShops(refreshedShops);
        }}
        onSwitchShop={handleSwitchShopWorkspace}
        onRenameShop={async (nextName) => {
          if (!shop) return;
          const cleanName = await renameShopBranch(shop.shopId, nextName);
          setShop((prev) => (prev ? { ...prev, name: cleanName } : prev));
          setUserShops((prev) =>
            prev.map((item) =>
              item.shop.shopId === shop.shopId
                ? { ...item, shop: { ...item.shop, name: cleanName } }
                : item
            )
          );
        }}
        onRegenerateJoinCode={async () => {
          if (!shop) return;
          const nextCode = await regenerateShopJoinCode(shop);
          setShop((prev) => (prev ? { ...prev, joinCode: nextCode } : prev));
          setUserShops((prev) =>
            prev.map((item) =>
              item.shop.shopId === shop.shopId
                ? { ...item, shop: { ...item.shop, joinCode: nextCode } }
                : item
            )
          );
        }}
        onLeaveShopView={async () => {
          if (!firebaseUser) return;
          await leaveShopWorkspace(firebaseUser);
          setShop(null);
          setMember(null);
          setShopDirectory([]);
          setShopAccounts([]);
          setFollowedStaffIds(new Set());
          setShopShares([]);
          setShopMembers([]);
          setShopRequests([]);
          setSelectedCloudStaffId('');
        }}
        onDeleteShop={async (targetShop) => {
          if (!firebaseUser) return;
          // Detach live workspace listeners before deleting parent shop doc
          workspaceUnsubRef.current?.();
          workspaceUnsubRef.current = null;
          setShop(null);
          setMember(null);
          setShopDirectory([]);
          setShopAccounts([]);
          setFollowedStaffIds(new Set());
          setShopShares([]);
          setShopMembers([]);
          setShopRequests([]);
          setSelectedCloudStaffId('');
          setSelectedDateKey(null);
          setLedgerShareOpen(false);
          setStoryViewerAccountId(null);

          await deleteShopWorkspace(firebaseUser, targetShop);

          const { activeShopId, shopIds } = await ensureUserDoc(firebaseUser);
          const refreshedShops = await loadUserShops(firebaseUser, shopIds);
          setUserShops(refreshedShops);
          if (activeShopId) {
            const nextCtx = await loadActiveShopContext(
              firebaseUser,
              activeShopId
            );
            if (nextCtx) {
              setShop(nextCtx.shop);
              setMember(nextCtx.member);
              setSelectedCloudStaffId(nextCtx.member.staffId || '');
            }
          }
        }}
        onDeleteShopkeeperAccount={async () => {
          if (!firebaseUser) return;
          // Detach live workspace listeners first so no PERMISSION_DENIED fires mid-delete
          workspaceUnsubRef.current?.();
          workspaceUnsubRef.current = null;
          setShop(null);
          setMember(null);
          setUserShops([]);
          setShopDirectory([]);
          setShopAccounts([]);
          setFollowedStaffIds(new Set());
          setShopShares([]);
          setShopMembers([]);
          setShopRequests([]);
          setSelectedCloudStaffId('');
          setSelectedDateKey(null);
          setLedgerShareOpen(false);
          setStoryViewerAccountId(null);

          await deleteShopkeeperData(firebaseUser);

          try {
            await deleteUser(firebaseUser);
          } catch (authErr) {
            const code = (authErr as { code?: string })?.code;
            if (code === 'auth/requires-recent-login') {
              try {
                await reauthenticateWithPopup(firebaseUser, googleProvider);
                await deleteUser(firebaseUser);
              } catch {
                await signOut(auth);
              }
            } else {
              await signOut(auth);
            }
          }
          setShopTeamOpen(false);
        }}
        onToggleFollow={async (card) => {
          if (!firebaseUser || !shop) return;
          const currentlyFollowing = followedStaffIds.has(card.staffId);
          await toggleFollowTeammate(
            shop,
            firebaseUser.uid,
            card,
            currentlyFollowing
          );
        }}
        onSendShare={async (
          recipientUid,
          recipientName,
          title,
          summaryText,
          options
        ) => {
          if (!firebaseUser || !shop) return;
          await sendInAppShare(
            shop,
            firebaseUser.uid,
            currentAccount.name || firebaseUser.displayName || 'Staff',
            recipientUid,
            recipientName,
            title,
            summaryText,
            options
          );
        }}
        onDeleteShare={async (shareId) => {
          if (!shop) return;
          await deleteInAppShare(shop.shopId, shareId);
        }}
        onOpenAddStaff={() => setAccountModal({ open: true, mode: 'add' })}
        onDeleteStaff={async (staffId) => {
          if (!shop || !effectivePermissions.canManageStaff) return;
          const targetDir = shopDirectory.find((d) => d.staffId === staffId);
          const targetAcct = shopAccounts.find((a) => a.id === staffId);
          const linkedUid = targetDir?.linkedUid || targetAcct?.linkedUid || '';
          await deleteShopStaff(shop.shopId, staffId, {
            linkedUid,
            ownerUid: shop.ownerUid,
            isOwner: cloudRole === 'owner',
            managerUids: shop.managerUids,
          });
        }}
        onToggleManagerRole={async (targetMember, nextRole) => {
          if (!shop || !firebaseUser) return;
          await setMemberRole(shop, targetMember, nextRole);
          const refreshed = await loadActiveShopContext(
            firebaseUser,
            shop.shopId
          );
          if (refreshed) {
            setShop(refreshed.shop);
          }
        }}
        onUpdateManagerPermissions={async (targetMember, permissions) => {
          if (!shop) return;
          await updateManagerPermissions(
            shop.shopId,
            targetMember.uid,
            permissions
          );
        }}
        onOpenStoryViewer={(accountId) => setStoryViewerAccountId(accountId)}
      />

      <SecurityModal
        isOpen={securityModalOpen}
        account={currentAccount}
        masterKeyBytes={sessionMasterKeys[currentAccount.id]}
        onClose={() => setSecurityModalOpen(false)}
        onUpdateSealedAccount={(updatedAcct, newMk) => {
          setRoot((prev) => ({
            ...prev,
            accts: prev.accts.map((a) =>
              a.id === updatedAcct.id ? updatedAcct : a
            ),
          }));
          if (newMk) {
            setSessionMasterKeys((prev) => ({
              ...prev,
              [updatedAcct.id]: newMk,
            }));
            setUnlockedIds((prev) => ({ ...prev, [updatedAcct.id]: true }));
          } else {
            setSessionMasterKeys((prev) => {
              const next = { ...prev };
              delete next[updatedAcct.id];
              return next;
            });
          }
        }}
        onLockNow={(id) => {
          void handleLockAccountNow(id);
        }}
      />

      {recoveryNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setRecoveryNotice(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
              <h3 className="text-base font-bold">
                {recoveryNotice.accountName} — Encryption चालू है
              </h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              यह आपकी <strong>64-अंकों की Recovery Key</strong> है। Passcode भूलने पर केवल इसी से डेटा खुलेगा, इसे कहीं सुरक्षित लिख या कॉपी कर लें:
            </p>
            <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 font-mono text-xs font-semibold text-indigo-950 break-all dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-100">
              {recoveryNotice.key}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(recoveryNotice.key)
                    .catch(() => {});
                }}
                className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                Key कॉपी करें
              </button>
              <button
                type="button"
                onClick={() => setRecoveryNotice(null)}
                className="min-h-[42px] rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                मैंने सेव कर ली
              </button>
            </div>
          </div>
        </div>
      )}

      <StoryComposerModal
        isOpen={storyComposerOpen}
        initialMode={storyComposerMode}
        onClose={() => setStoryComposerOpen(false)}
        onPost={handlePostStory}
      />

      <StoryViewerModal
        accounts={storyViewerAccounts}
        initialAccountId={storyViewerAccountId}
        currentAccountId={currentAccount.id}
        onClose={() => setStoryViewerAccountId(null)}
        onDeleteStory={handleDeleteStory}
        onReactStory={handleReactStory}
        onMarkViewed={handleMarkStoryViewed}
        onAddMore={openStoryComposer}
      />

      {hydrated && isLocked && (
        <PinLockScreen
          accounts={root.accts}
          currentAccount={currentAccount}
          onUnlock={(id, decryptedAcct, mk, upgradedRecoveryKey) => {
            setRoot((prev) => ({
              ...prev,
              accts: prev.accts.map((a) => (a.id === id ? decryptedAcct : a)),
            }));
            if (mk) {
              setSessionMasterKeys((prev) => ({ ...prev, [id]: mk }));
            }
            setUnlockedIds((prev) => ({ ...prev, [id]: true }));
            if (upgradedRecoveryKey) {
              setRecoveryNotice({
                accountName: decryptedAcct.name,
                key: upgradedRecoveryKey,
              });
            }
          }}
          onSwitchAccount={handleSelectAccount}
          onCreateNewAccount={() =>
            setAccountModal({ open: true, mode: 'add' })
          }
        />
      )}

      <LegalInfoModal
        activeTab={legalTab}
        onChangeTab={setLegalTab}
        onClose={() => setLegalTab(null)}
      />

      <OfflineIndicator />
      <PWAUpdateToast />
    </div>
  );
}
