export type AttendanceStatus = 'P' | 'A' | 'L' | 'H' | 'O' | '';

export interface DayEntry {
  s: AttendanceStatus;
  n?: string;
  inTime?: string;
  outTime?: string;
  gps?: string;
}

export interface MoneyEntry {
  id: number;
  t: 'adv' | 'pay';
  a: number;
  d: string; // YYYY-MM-DD
  n?: string;
}

export type StoryMediaType = 'text' | 'photo' | 'video' | 'reel';

export interface Story {
  id: string;
  type?: StoryMediaType;
  txt: string;
  bg: string;
  img: string;
  mediaId?: string;
  duration?: number;
  muted?: boolean;
  fontStyle?: 'sans' | 'serif' | 'mono';
  sticker?: string;
  reactions?: Record<string, number>;
  views?: number;
  ts: number;
}

export interface AccountE2EEVault {
  enabled: boolean;
  version: number;
  iterations: number;
  salt: string;
  passIv: string;
  wrappedKeyByPass: string;
  recIv: string;
  wrappedKeyByRecovery: string;
  vaultIv: string;
  sealedVault: string;
  fingerprint: string;
  autoLock?: boolean;
}

export type ShopRole = 'owner' | 'manager' | 'staff';

export interface Account {
  id: string;
  name: string;
  ph?: string;
  em?: string;
  photo?: string;
  emo?: string;
  pin?: string;
  e2ee?: AccountE2EEVault;
  days: Record<string, DayEntry>;
  selfDays?: Record<string, DayEntry>;
  money: MoneyEntry[];
  sal: Record<string, number>;
  stories?: Story[];
  linkedUid?: string;
  linkedEmail?: string;
  roleLabel?: ShopRole;
}

export interface RootState {
  cur: string;
  accts: Account[];
}

export interface ShopDoc {
  shopId: string;
  name: string;
  ownerUid: string;
  ownerEmail: string;
  joinCode: string;
  managerUids: string[];
}

export interface UserShopSummary {
  shop: ShopDoc;
  role: ShopRole;
  staffId?: string;
}

export interface ManagerPermissions {
  canMarkAttendance: boolean;
  canApproveRequests: boolean;
  canManageMoney: boolean;
  canEditSalary: boolean;
  canManageStaff: boolean;
}

export interface ShopMemberDoc {
  uid: string;
  shopId: string;
  ownerUid: string;
  email: string;
  displayName: string;
  role: ShopRole;
  staffId?: string;
  permissions?: ManagerPermissions;
}

export interface StaffDirectoryCard {
  staffId: string;
  shopId: string;
  ownerUid: string;
  managerUids: string[];
  linkedUid?: string;
  name: string;
  photo?: string;
  emo?: string;
  roleLabel: ShopRole;
  followersCount: number;
  stories: Story[];
}

export interface ShopShareDoc {
  shareId: string;
  shopId: string;
  ownerUid: string;
  senderUid: string;
  senderName: string;
  recipientUid: string;
  recipientEmail?: string;
  recipientStaffId?: string;
  recipientName: string;
  title: string;
  summaryText: string;
  createdAt?: unknown;
}

export type ShopRequestType = 'punch' | 'leave';
export type ShopRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ShopRequestDoc {
  requestId: string;
  shopId: string;
  ownerUid: string;
  managerUids: string[];
  staffId: string;
  staffUid: string;
  staffName: string;
  type: ShopRequestType;
  requestedStatus: 'P' | 'H' | 'L';
  fromDate: string;
  toDate: string;
  reason?: string;
  inTime?: string;
  outTime?: string;
  gps?: string;
  selfie?: string;
  status: ShopRequestStatus;
  reviewNote?: string;
  reviewedByUid?: string;
  reviewedByName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ThemeMode = 'light' | 'dark';
