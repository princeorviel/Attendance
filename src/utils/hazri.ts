import {
  Account,
  AttendanceStatus,
  ManagerPermissions,
  RootState,
  ShopRole,
} from '../types';
import {
  sealRootForStorage,
  stripPrivateFields,
  unsealRootFromStorage,
} from './cryptoVault';

export const STORAGE_KEY = 'meri_hazri_v1';
export const THEME_KEY = 'meri_hazri_theme';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MONTH_NAMES_HI = [
  'जनवरी',
  'फ़रवरी',
  'मार्च',
  'अप्रैल',
  'मई',
  'जून',
  'जुलाई',
  'अगस्त',
  'सितंबर',
  'अक्टूबर',
  'नवंबर',
  'दिसंबर',
];

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const STATUS_META: Record<
  Exclude<AttendanceStatus, ''>,
  { label: string; short: string; hi: string }
> = {
  P: { label: 'Present', short: 'P', hi: 'हाज़िर' },
  A: { label: 'Absent', short: 'A', hi: 'ग़ैरहाज़िर' },
  L: { label: 'Leave', short: 'L', hi: 'छुट्टी (Leave)' },
  H: { label: 'Half', short: 'H', hi: 'आधा दिन' },
  O: { label: 'छुट्टी', short: 'छु', hi: 'सरकारी/रविवार छुट्टी' },
};

export const FIXED_HOLIDAYS: Record<string, string> = {
  '01-26': 'गणतंत्र दिवस',
  '08-15': 'स्वतंत्रता दिवस',
  '10-02': 'गांधी जयंती',
  '12-25': 'क्रिसमस',
};

export const VARIABLE_HOLIDAYS: Record<string, string> = {
  '2026-03-04': 'होली',
  '2026-11-08': 'दिवाली',
  '2027-03-10': 'ईद-उल-फ़ित्र',
  '2027-03-23': 'होली',
  '2027-03-26': 'गुड फ़्राइडे',
  '2027-10-29': 'दिवाली',
};

export const EMOJI_PRESETS = ['😀', '😎', '👨', '👩', '🧔', '👳', '🧕', '🐯'];

export const STORY_COLORS = [
  'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
  'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
  'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
  'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #dc2626 0%, #db2777 100%)',
  '#111827',
];

export const STORY_STICKERS = [
  '',
  '🔥 आज काम पर',
  '☕ चाय ब्रेक',
  '🎉 छुट्टी मूड',
  '💪 फुल जोश',
  '📍 साइट पर',
];

export const STORY_REACTIONS = ['❤️', '🔥', '👏', '😂', '😮'];

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function makeDateKey(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

export function makeYearMonthKey(year: number, monthIndex: number): string {
  return `${year}-${pad2(monthIndex + 1)}`;
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.split('-').reverse().join('/');
}

export function formatRs(n: number): string {
  const rounded = Math.round(n);
  const abs = Math.abs(rounded).toLocaleString('en-IN');
  return rounded < 0 ? `-₹${abs}` : `₹${abs}`;
}

export function getHolidayName(dateStr: string): string {
  return VARIABLE_HOLIDAYS[dateStr] || FIXED_HOLIDAYS[dateStr.slice(5)] || '';
}

export function getEffectiveStatus(
  account: Account,
  dateStr: string,
  dayOfWeek: number
): AttendanceStatus {
  const entry = account.days[dateStr];
  if (entry && entry.s) return entry.s;
  return dayOfWeek === 0 || getHolidayName(dateStr) ? 'O' : '';
}

export function hashPin(raw: string): string {
  const normalized = String(raw)
    .trim()
    .replace(/[\u0966-\u096f]/g, (d) => String(d.charCodeAt(0) - 2406));
  let h = 5381;
  for (let i = 0; i < normalized.length; i++) {
    h = ((h << 5) + h + normalized.charCodeAt(i)) | 0;
  }
  return String(h);
}

export function normalizeAccount(acct: Partial<Account>, fallbackId = 'a1'): Account {
  const base: Account = {
    id: acct.id || fallbackId,
    name: (acct.name || '').trim() || 'Staff',
    ph: acct.ph || '',
    em: acct.em || '',
    photo: acct.photo || '',
    emo: acct.emo || '',
    pin: acct.pin || '',
    e2ee: acct.e2ee?.enabled ? acct.e2ee : undefined,
    days: acct.days || {},
    money: Array.isArray(acct.money) ? acct.money : [],
    sal: acct.sal || {},
    stories: Array.isArray(acct.stories) ? acct.stories : [],
  };
  return base.e2ee?.enabled ? stripPrivateFields(base) : base;
}

export function getFallbackRoot(): RootState {
  return {
    cur: 'a1',
    accts: [
      {
        id: 'a1',
        name: 'Prince Orviel',
        days: {},
        money: [],
        sal: {},
        stories: [],
      },
    ],
  };
}

export function parseRootObject(parsed: unknown): RootState {
  const fallback = getFallbackRoot();
  if (!parsed || typeof parsed !== 'object') return fallback;
  const obj = parsed as Record<string, unknown>;
  if (Array.isArray(obj.accts) && obj.accts.length > 0) {
    const accts = obj.accts.map((a, i) =>
      normalizeAccount((a || {}) as Partial<Account>, `a${i + 1}`)
    );
    const curExists = accts.some((a) => a.id === obj.cur);
    return {
      cur: curExists ? String(obj.cur) : accts[0].id,
      accts,
    };
  }
  if (obj.days && typeof obj.days === 'object') {
    return {
      cur: 'a1',
      accts: [
        normalizeAccount({
          id: 'a1',
          name: 'Prince Orviel',
          days: obj.days as Account['days'],
          money: Array.isArray(obj.money) ? (obj.money as Account['money']) : [],
          sal: (obj.sal || {}) as Account['sal'],
        }),
      ],
    };
  }
  return fallback;
}

export function loadRoot(): RootState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getFallbackRoot();
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === 'E2EE_STORE_V1') {
      return getFallbackRoot();
    }
    return parseRootObject(parsed);
  } catch {
    return getFallbackRoot();
  }
}

export async function loadRootAsync(): Promise<RootState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getFallbackRoot();
    const parsed = await unsealRootFromStorage(raw);
    return parseRootObject(parsed);
  } catch {
    return getFallbackRoot();
  }
}

export function saveRoot(root: RootState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch {
    // Storage quota exceeded or restricted
  }
}

export async function saveRootAsync(
  root: RootState,
  sessionMasterKeys: Record<string, Uint8Array>
): Promise<void> {
  try {
    const sealed = await sealRootForStorage(root, sessionMasterKeys);
    localStorage.setItem(STORAGE_KEY, sealed);
  } catch {
    // Storage quota exceeded or restricted
  }
}

export function getLiveStories(account: Account) {
  const now = Date.now();
  return (account.stories || []).filter((s) => now - s.ts < 86400000);
}

export function getRelativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'अभी';
  if (mins < 60) return `${mins} मिनट पहले`;
  return `${Math.floor(mins / 60)} घंटे पहले`;
}

export function getAccountColorHue(index: number): number {
  return (index * 70 + 245) % 360;
}

export function getMoneySumForDate(
  account: Account,
  dateStr: string,
  type: 'adv' | 'pay'
): number {
  return account.money
    .filter((m) => m.d === dateStr && m.t === type)
    .reduce((sum, m) => sum + m.a, 0);
}

export function hasMoneyOnDate(account: Account, dateStr: string): boolean {
  return account.money.some((m) => m.d === dateStr);
}

export interface MonthCalculation {
  counts: Record<Exclude<AttendanceStatus, ''>, number>;
  totalWorkingDays: number;
  workingDaysUpToDate: number;
  unmarkedDays: number;
  payableDays: number;
  salary: number;
  perDayRate: number;
  grossEarned: number;
  totalAdvance: number;
  totalPayment: number;
  openingBalance: number;
  monthNet: number;
  netBalance: number;
  lastKnownSalary: number;
  monthMoney: Account['money'];
}

function calculateSingleMonthRaw(
  account: Account,
  year: number,
  monthIndex: number,
  upToDate: string
) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const ymKey = makeYearMonthKey(year, monthIndex);
  const counts: Record<Exclude<AttendanceStatus, ''>, number> = {
    P: 0,
    A: 0,
    L: 0,
    H: 0,
    O: 0,
  };

  let totalWorkingDays = 0;
  let workingDaysUpToDate = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const k = makeDateKey(year, monthIndex, d);
    const dw = new Date(year, monthIndex, d).getDay();
    const s = getEffectiveStatus(account, k, dw);
    if (dw !== 0) {
      totalWorkingDays++;
      if (k <= upToDate) {
        workingDaysUpToDate++;
        if (s) counts[s]++;
      }
    }
  }

  const monthMoney = account.money
    .filter((x) => x.d.slice(0, 7) === ymKey)
    .sort((a, b) => (a.d < b.d ? 1 : -1));

  let totalAdvance = 0;
  let totalPayment = 0;
  for (const m of monthMoney) {
    if (m.d > upToDate) continue;
    if (m.t === 'adv') totalAdvance += m.a;
    else totalPayment += m.a;
  }

  const salary = account.sal[ymKey] || 0;
  const perDayRate = salary && totalWorkingDays ? salary / totalWorkingDays : 0;
  const payableDays = counts.P + counts.O + counts.H * 0.5;
  const unmarkedDays = Math.max(
    0,
    workingDaysUpToDate - counts.P - counts.A - counts.L - counts.H - counts.O
  );
  const grossEarned = perDayRate * payableDays;
  const monthNet = grossEarned - totalAdvance - totalPayment;

  return {
    counts,
    totalWorkingDays,
    workingDaysUpToDate,
    unmarkedDays,
    payableDays,
    salary,
    perDayRate,
    grossEarned,
    totalAdvance,
    totalPayment,
    monthNet,
    monthMoney,
  };
}

export function calculateMonthSummary(
  account: Account,
  year: number,
  monthIndex: number,
  upToDate: string,
  todayKey?: string
): MonthCalculation {
  const targetYM = makeYearMonthKey(year, monthIndex);
  const effectiveToday =
    todayKey ||
    (() => {
      const n = new Date();
      return makeDateKey(n.getFullYear(), n.getMonth(), n.getDate());
    })();

  const activePriorYMSet = new Set<string>();
  for (const k of Object.keys(account.days)) {
    const ym = k.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(ym) && ym < targetYM) activePriorYMSet.add(ym);
  }
  for (const m of account.money) {
    const ym = m.d.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(ym) && ym < targetYM) activePriorYMSet.add(ym);
  }
  for (const [ym, val] of Object.entries(account.sal)) {
    if (/^\d{4}-\d{2}$/.test(ym) && ym < targetYM && val > 0) {
      activePriorYMSet.add(ym);
    }
  }

  const priorYMs = Array.from(activePriorYMSet).sort();
  let openingBalance = 0;
  let lastKnownSalary = 0;

  for (const ym of priorYMs) {
    const [pyStr, pmStr] = ym.split('-');
    const py = Number(pyStr);
    const pm = Number(pmStr) - 1;
    if (!Number.isFinite(py) || !Number.isFinite(pm)) continue;

    const prevDays = new Date(py, pm + 1, 0).getDate();
    const prevStart = makeDateKey(py, pm, 1);
    const prevEnd = makeDateKey(py, pm, prevDays);
    const prevUpTo =
      prevEnd <= effectiveToday
        ? prevEnd
        : prevStart <= effectiveToday
          ? effectiveToday
          : prevEnd;

    const rawPrev = calculateSingleMonthRaw(account, py, pm, prevUpTo);
    openingBalance += rawPrev.monthNet;
    if (rawPrev.salary > 0) lastKnownSalary = rawPrev.salary;
  }

  const current = calculateSingleMonthRaw(account, year, monthIndex, upToDate);
  const netBalance = openingBalance + current.monthNet;

  return {
    ...current,
    openingBalance,
    netBalance,
    lastKnownSalary,
  };
}

export function resizeSquareAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const m = Math.min(img.width, img.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(
          img,
          (img.width - m) / 2,
          (img.height - m) / 2,
          m,
          m,
          0,
          0,
          size,
          size
        );
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function resizeStoryImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const w = Math.min(360, img.width);
        const h = Math.round((img.height * w) / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function resizeStoryPhotoBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const w = Math.min(1080, img.width);
        const h = Math.round((img.height * w) / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Blob creation failed'));
          },
          'image/jpeg',
          0.85
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function buildLedgerStatementText(
  account: Account,
  year: number,
  monthIndex: number,
  upToDate: string,
  todayKey: string,
  scope: 'month' | 'all'
): string {
  const lines: string[] = [];
  lines.push(`*${account.name} — अकाउंट लेजर व हिसाब*`);
  if (account.ph) lines.push(`मोबाइल: ${account.ph}`);

  if (scope === 'month') {
    const calc = calculateMonthSummary(
      account,
      year,
      monthIndex,
      upToDate,
      todayKey
    );
    lines.push(
      `महीना: ${MONTH_NAMES[monthIndex]} ${year} (${formatDisplayDate(upToDate)} तक)`
    );
    lines.push('------------------------');
    lines.push(
      `हाज़िरी: Present ${calc.counts.P} | Absent ${calc.counts.A} | Leave ${calc.counts.L} | Half ${calc.counts.H} | छुट्टी ${calc.counts.O}`
    );

    if (Math.round(calc.openingBalance) !== 0) {
      lines.push(
        `पिछला हिसाब (Carry Forward): ${
          calc.openingBalance > 0
            ? `+ ${formatRs(calc.openingBalance)}`
            : `− ${formatRs(Math.abs(calc.openingBalance))}`
        }`
      );
    }

    if (calc.salary > 0) {
      lines.push(`महीने की सैलरी: ${formatRs(calc.salary)}`);
      lines.push(
        `कमाई (${calc.payableDays} दिन): ${formatRs(calc.grossEarned)}`
      );
    }

    lines.push(`Advance लिया: − ${formatRs(calc.totalAdvance)}`);
    lines.push(`Payment मिली: − ${formatRs(calc.totalPayment)}`);
    lines.push(`*कुल बाकी: ${formatRs(calc.netBalance)}*`);

    const visibleMoney = calc.monthMoney
      .filter((m) => m.d <= upToDate)
      .sort((a, b) => (a.d > b.d ? 1 : -1));

    lines.push('');
    lines.push('*Advance / Payment सूची:*');
    if (visibleMoney.length === 0) {
      lines.push('• इस महीने कोई लेन-देन एंट्री नहीं');
    } else {
      visibleMoney.forEach((m) => {
        const label = m.t === 'adv' ? 'Advance' : 'Payment';
        lines.push(
          `• ${formatDisplayDate(m.d)} — ${label} ${formatRs(m.a)}${
            m.n ? ` (${m.n})` : ''
          }`
        );
      });
    }
    return lines.join('\n');
  }

  // Full all-months ledger
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

  const sortedYMs = Array.from(ymSet).sort();
  lines.push(`पूरा लेजर (${formatDisplayDate(todayKey)} तक)`);
  lines.push('------------------------');

  let running = 0;
  for (const ym of sortedYMs) {
    const [yStr, mStr] = ym.split('-');
    const y = Number(yStr);
    const m = Number(mStr) - 1;
    const dim = new Date(y, m + 1, 0).getDate();
    const mStart = makeDateKey(y, m, 1);
    const mEnd = makeDateKey(y, m, dim);
    const mUpTo =
      mEnd <= todayKey ? mEnd : mStart <= todayKey ? todayKey : mEnd;
    const raw = calculateSingleMonthRaw(account, y, m, mUpTo);
    running += raw.monthNet;
    lines.push(
      `• ${MONTH_NAMES[m]} ${y}: P:${raw.counts.P} A:${raw.counts.A} L:${raw.counts.L} H:${raw.counts.H} | कमाई ${formatRs(raw.grossEarned)} | Adv ${formatRs(raw.totalAdvance)} | Pay ${formatRs(raw.totalPayment)} | कुल ${formatRs(running)}`
    );
  }

  lines.push('------------------------');
  lines.push(`*मौजूदा कुल बाकी: ${formatRs(running)}*`);

  const allMoney = [...account.money].sort((a, b) => (a.d > b.d ? 1 : -1));
  lines.push('');
  lines.push('*सभी Advance / Payment एंट्री:*');
  if (allMoney.length === 0) {
    lines.push('• कोई लेन-देन एंट्री नहीं');
  } else {
    allMoney.forEach((m) => {
      const label = m.t === 'adv' ? 'Advance' : 'Payment';
      lines.push(
        `• ${formatDisplayDate(m.d)} — ${label} ${formatRs(m.a)}${
          m.n ? ` (${m.n})` : ''
        }`
      );
    });
  }

  return lines.join('\n');
}

function escapeCsvCell(val: string | number): string {
  const s = String(val ?? '');
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildAccountLedgerCsv(
  account: Account,
  year: number,
  monthIndex: number,
  upToDate: string,
  todayKey: string,
  scope: 'month' | 'all'
): string {
  const rows: string[] = [];
  rows.push(['Account', 'Date', 'Type', 'Amount', 'Note'].join(','));

  if (scope === 'month') {
    const calc = calculateMonthSummary(
      account,
      year,
      monthIndex,
      upToDate,
      todayKey
    );
    const list = calc.monthMoney
      .filter((m) => m.d <= upToDate)
      .sort((a, b) => (a.d > b.d ? 1 : -1));
    list.forEach((m) => {
      rows.push(
        [
          escapeCsvCell(account.name),
          escapeCsvCell(formatDisplayDate(m.d)),
          escapeCsvCell(m.t === 'adv' ? 'Advance' : 'Payment'),
          escapeCsvCell(m.a),
          escapeCsvCell(m.n || ''),
        ].join(',')
      );
    });
    rows.push('');
    rows.push(['Summary', 'Value', '', '', ''].join(','));
    rows.push(
      ['Carry Forward', Math.round(calc.openingBalance), '', '', ''].join(',')
    );
    rows.push(['Monthly Salary', Math.round(calc.salary), '', '', ''].join(','));
    rows.push(
      ['Month Earnings', Math.round(calc.grossEarned), '', '', ''].join(',')
    );
    rows.push(
      ['Total Advance', Math.round(calc.totalAdvance), '', '', ''].join(',')
    );
    rows.push(
      ['Total Payment', Math.round(calc.totalPayment), '', '', ''].join(',')
    );
    rows.push(
      ['Net Balance', Math.round(calc.netBalance), '', '', ''].join(',')
    );
    return `\uFEFF${rows.join('\n')}`;
  }

  const allMoney = [...account.money].sort((a, b) => (a.d > b.d ? 1 : -1));
  allMoney.forEach((m) => {
    rows.push(
      [
        escapeCsvCell(account.name),
        escapeCsvCell(formatDisplayDate(m.d)),
        escapeCsvCell(m.t === 'adv' ? 'Advance' : 'Payment'),
        escapeCsvCell(m.a),
        escapeCsvCell(m.n || ''),
      ].join(',')
    );
  });
  return `\uFEFF${rows.join('\n')}`;
}

export const FULL_OWNER_PERMISSIONS: ManagerPermissions = {
  canMarkAttendance: true,
  canApproveRequests: true,
  canManageMoney: true,
  canEditSalary: true,
  canManageStaff: true,
};

export const DEFAULT_MANAGER_PERMISSIONS: ManagerPermissions = {
  canMarkAttendance: true,
  canApproveRequests: true,
  canManageMoney: true,
  canEditSalary: false,
  canManageStaff: false,
};

export function resolveEffectivePermissions(
  role: ShopRole | null | undefined,
  custom?: Partial<ManagerPermissions>
): ManagerPermissions {
  if (!role || role === 'owner') return { ...FULL_OWNER_PERMISSIONS };
  if (role === 'staff') {
    return {
      canMarkAttendance: false,
      canApproveRequests: false,
      canManageMoney: false,
      canEditSalary: false,
      canManageStaff: false,
    };
  }
  return {
    ...DEFAULT_MANAGER_PERMISSIONS,
    ...(custom || {}),
  };
}

export function formatTimeShort(date: Date = new Date()): string {
  const h24 = date.getHours();
  const mins = pad2(date.getMinutes());
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${mins} ${suffix}`;
}

export function expandDateRange(fromDate: string, toDate: string): string[] {
  if (!fromDate) return [];
  const endStr = toDate && toDate >= fromDate ? toDate : fromDate;
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [fromDate];
  }
  const out: string[] = [];
  const cur = new Date(start);
  let guard = 0;
  while (cur <= end && guard < 31) {
    out.push(makeDateKey(cur.getFullYear(), cur.getMonth(), cur.getDate()));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return out.length > 0 ? out : [fromDate];
}

export function resizePunchSelfie(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read selfie'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid selfie image'));
      img.onload = () => {
        const size = 120;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const m = Math.min(img.width, img.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(
          img,
          (img.width - m) / 2,
          (img.height - m) / 2,
          m,
          m,
          0,
          0,
          size,
          size
        );
        resolve(canvas.toDataURL('image/jpeg', 0.55));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

