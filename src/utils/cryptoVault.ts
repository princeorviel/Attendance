import { Account, AccountE2EEVault, RootState } from '../types';

const KEYSTORE_DB = 'meri_hazri_keystore_v1';
const KEYSTORE_STORE = 'keys';
const DEVICE_KEY_ID = 'device_master_aes_gcm';
const PBKDF2_ITERATIONS = 150000;

interface AccountPrivatePayload {
  ph: string;
  em: string;
  days: Account['days'];
  money: Account['money'];
  sal: Account['sal'];
  stories: Account['stories'];
}

export interface EncryptedStoreEnvelope {
  v: 'E2EE_STORE_V1';
  iv: string;
  data: string;
}

export interface EncryptedBackupEnvelope {
  format: 'ATTENDANCE_E2EE_BACKUP_V1';
  cipher: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  data: string;
  createdAt: string;
}

function toAB(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(
    u8.byteOffset,
    u8.byteOffset + u8.byteLength
  ) as ArrayBuffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (clean.length !== 64) {
    throw new Error('Invalid recovery key length');
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function formatRecoveryKey(rawHex: string): string {
  const clean = rawHex.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  const groups: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    groups.push(clean.slice(i, i + 4));
  }
  return groups.join('-');
}

export function normalizePasscode(raw: string): string {
  return String(raw)
    .trim()
    .replace(/[\u0966-\u096f]/g, (d) => String(d.charCodeAt(0) - 2406));
}

export function isWebCryptoAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.subtle !== 'undefined'
  );
}

async function computeFingerprint(rawMasterBytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', toAB(rawMasterBytes))
  );
  // Build Signal/WhatsApp-style 12-block 5-digit safety number
  const blocks: string[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = (i * 2) % (digest.length - 2);
    const val =
      ((digest[idx] << 16) | (digest[idx + 1] << 8) | digest[idx + 2]) %
      100000;
    blocks.push(String(val).padStart(5, '0'));
  }
  return blocks.join(' ');
}

async function deriveKeyFromPasscode(
  passcode: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const normalized = normalizePasscode(passcode);
  const enc = new TextEncoder().encode(normalized);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    toAB(enc),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toAB(salt),
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function deriveKeyFromRecoveryHex(
  recoveryKeyInput: string
): Promise<CryptoKey> {
  const rawBytes = hexToBytes(recoveryKeyInput);
  const hashed = await crypto.subtle.digest('SHA-256', toAB(rawBytes));
  return crypto.subtle.importKey(
    'raw',
    hashed,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function importAesKeyFromRaw(rawBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    toAB(rawBytes),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptBytesWithKey(
  key: CryptoKey,
  plaintextBytes: Uint8Array
): Promise<{ iv: string; cipher: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toAB(iv) },
      key,
      toAB(plaintextBytes)
    )
  );
  return {
    iv: bytesToBase64(iv),
    cipher: bytesToBase64(encrypted),
  };
}

async function decryptBytesWithKey(
  key: CryptoKey,
  ivB64: string,
  cipherB64: string
): Promise<Uint8Array> {
  const iv = base64ToBytes(ivB64);
  const cipher = base64ToBytes(cipherB64);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toAB(iv) },
    key,
    toAB(cipher)
  );
  return new Uint8Array(decrypted);
}

function extractPrivatePayload(account: Account): AccountPrivatePayload {
  return {
    ph: account.ph || '',
    em: account.em || '',
    days: account.days || {},
    money: Array.isArray(account.money) ? account.money : [],
    sal: account.sal || {},
    stories: Array.isArray(account.stories) ? account.stories : [],
  };
}

export function stripPrivateFields(account: Account): Account {
  return {
    id: account.id,
    name: account.name,
    photo: account.photo || '',
    emo: account.emo || '',
    pin: account.pin || '',
    e2ee: account.e2ee,
    ph: '',
    em: '',
    days: {},
    money: [],
    sal: {},
    stories: [],
  };
}

export async function sealAccountWithNewPasscode(
  account: Account,
  passcode: string,
  autoLock = false
): Promise<{
  sealedAccount: Account;
  masterKeyBytes: Uint8Array;
  recoveryKeyFormatted: string;
}> {
  if (!isWebCryptoAvailable()) {
    throw new Error('Web Crypto API उपलब्ध नहीं है');
  }
  const normalized = normalizePasscode(passcode);
  if (normalized.length < 4) {
    throw new Error('Passcode कम से कम 4 अक्षर/अंक का रखें');
  }

  const masterBytes = crypto.getRandomValues(new Uint8Array(32));
  const recoveryBytes = crypto.getRandomValues(new Uint8Array(32));
  const recoveryHex = bytesToHex(recoveryBytes);
  const recoveryFormatted = formatRecoveryKey(recoveryHex);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const passKek = await deriveKeyFromPasscode(
    normalized,
    salt,
    PBKDF2_ITERATIONS
  );
  const recKek = await deriveKeyFromRecoveryHex(recoveryHex);
  const masterKey = await importAesKeyFromRaw(masterBytes);

  const wrappedPass = await encryptBytesWithKey(passKek, masterBytes);
  const wrappedRec = await encryptBytesWithKey(recKek, masterBytes);

  const payloadJson = JSON.stringify(extractPrivatePayload(account));
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const sealed = await encryptBytesWithKey(masterKey, payloadBytes);
  const fingerprint = await computeFingerprint(masterBytes);

  const e2ee: AccountE2EEVault = {
    enabled: true,
    version: 1,
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    passIv: wrappedPass.iv,
    wrappedKeyByPass: wrappedPass.cipher,
    recIv: wrappedRec.iv,
    wrappedKeyByRecovery: wrappedRec.cipher,
    vaultIv: sealed.iv,
    sealedVault: sealed.cipher,
    fingerprint,
    autoLock,
  };

  return {
    sealedAccount: {
      ...account,
      pin: '',
      e2ee,
    },
    masterKeyBytes: masterBytes,
    recoveryKeyFormatted: recoveryFormatted,
  };
}

export async function reencryptAccountVault(
  account: Account,
  masterKeyBytes: Uint8Array
): Promise<Account> {
  if (!account.e2ee?.enabled) return account;
  const masterKey = await importAesKeyFromRaw(masterKeyBytes);
  const payloadBytes = new TextEncoder().encode(
    JSON.stringify(extractPrivatePayload(account))
  );
  const sealed = await encryptBytesWithKey(masterKey, payloadBytes);
  return {
    ...account,
    e2ee: {
      ...account.e2ee,
      vaultIv: sealed.iv,
      sealedVault: sealed.cipher,
    },
  };
}

export async function unlockAccountWithPasscode(
  account: Account,
  passcode: string
): Promise<{
  unlockedAccount: Account;
  masterKeyBytes: Uint8Array;
}> {
  const vault = account.e2ee;
  if (!vault || !vault.enabled) {
    throw new Error('Account encrypted नहीं है');
  }
  const salt = base64ToBytes(vault.salt);
  const passKek = await deriveKeyFromPasscode(
    passcode,
    salt,
    vault.iterations || PBKDF2_ITERATIONS
  );
  const masterKeyBytes = await decryptBytesWithKey(
    passKek,
    vault.passIv,
    vault.wrappedKeyByPass
  );
  const masterKey = await importAesKeyFromRaw(masterKeyBytes);
  const plainBytes = await decryptBytesWithKey(
    masterKey,
    vault.vaultIv,
    vault.sealedVault
  );
  const payload = JSON.parse(
    new TextDecoder().decode(plainBytes)
  ) as AccountPrivatePayload;

  return {
    unlockedAccount: {
      ...account,
      ph: payload.ph || '',
      em: payload.em || '',
      days: payload.days || {},
      money: Array.isArray(payload.money) ? payload.money : [],
      sal: payload.sal || {},
      stories: Array.isArray(payload.stories) ? payload.stories : [],
    },
    masterKeyBytes,
  };
}

export async function unlockAndResetPasscodeWithRecoveryKey(
  account: Account,
  recoveryKeyInput: string,
  newPasscode: string
): Promise<{
  updatedAccount: Account;
  masterKeyBytes: Uint8Array;
}> {
  const vault = account.e2ee;
  if (!vault || !vault.enabled) {
    throw new Error('Account encrypted नहीं है');
  }
  const normalizedNew = normalizePasscode(newPasscode);
  if (normalizedNew.length < 4) {
    throw new Error('नया Passcode कम से कम 4 अक्षर/अंक का होना चाहिए');
  }

  const recKek = await deriveKeyFromRecoveryHex(recoveryKeyInput);
  const masterKeyBytes = await decryptBytesWithKey(
    recKek,
    vault.recIv,
    vault.wrappedKeyByRecovery
  );
  const masterKey = await importAesKeyFromRaw(masterKeyBytes);
  const plainBytes = await decryptBytesWithKey(
    masterKey,
    vault.vaultIv,
    vault.sealedVault
  );
  const payload = JSON.parse(
    new TextDecoder().decode(plainBytes)
  ) as AccountPrivatePayload;

  // Re-wrap master key with the new passcode
  const newSalt = crypto.getRandomValues(new Uint8Array(16));
  const newPassKek = await deriveKeyFromPasscode(
    normalizedNew,
    newSalt,
    PBKDF2_ITERATIONS
  );
  const wrappedPass = await encryptBytesWithKey(newPassKek, masterKeyBytes);

  return {
    updatedAccount: {
      ...account,
      ph: payload.ph || '',
      em: payload.em || '',
      days: payload.days || {},
      money: Array.isArray(payload.money) ? payload.money : [],
      sal: payload.sal || {},
      stories: Array.isArray(payload.stories) ? payload.stories : [],
      e2ee: {
        ...vault,
        iterations: PBKDF2_ITERATIONS,
        salt: bytesToBase64(newSalt),
        passIv: wrappedPass.iv,
        wrappedKeyByPass: wrappedPass.cipher,
      },
    },
    masterKeyBytes,
  };
}

export async function getRecoveryKeyForUnlockedVault(
  _account: Account,
  _masterKeyBytes: Uint8Array
): Promise<string | null> {
  // Note: Recovery key is never stored; only revealed at setup/regeneration.
  return null;
}

export async function rotateRecoveryKeyForAccount(
  account: Account,
  masterKeyBytes: Uint8Array
): Promise<{ updatedAccount: Account; recoveryKeyFormatted: string }> {
  if (!account.e2ee?.enabled) {
    throw new Error('पहले E2EE Lock चालू करें');
  }
  const recoveryBytes = crypto.getRandomValues(new Uint8Array(32));
  const recoveryHex = bytesToHex(recoveryBytes);
  const recKek = await deriveKeyFromRecoveryHex(recoveryHex);
  const wrappedRec = await encryptBytesWithKey(recKek, masterKeyBytes);

  return {
    updatedAccount: {
      ...account,
      e2ee: {
        ...account.e2ee,
        recIv: wrappedRec.iv,
        wrappedKeyByRecovery: wrappedRec.cipher,
      },
    },
    recoveryKeyFormatted: formatRecoveryKey(recoveryHex),
  };
}

export async function disableEncryptionWithPasscode(
  account: Account,
  passcode: string
): Promise<Account> {
  const { unlockedAccount } = await unlockAccountWithPasscode(
    account,
    passcode
  );
  const next: Account = { ...unlockedAccount };
  delete next.e2ee;
  next.pin = '';
  return next;
}

// ============================================================
// Layer 1: Non-Extractable Device Key in IndexedDB for localStorage
// ============================================================

function openKeystoreDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(KEYSTORE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEYSTORE_STORE)) {
        db.createObjectStore(KEYSTORE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Keystore DB error'));
  });
}

let cachedDeviceKey: CryptoKey | null = null;

async function getOrCreateDeviceKey(): Promise<CryptoKey | null> {
  if (!isWebCryptoAvailable()) return null;
  if (cachedDeviceKey) return cachedDeviceKey;
  try {
    const db = await openKeystoreDB();
    const existing = await new Promise<CryptoKey | null>((resolve) => {
      const tx = db.transaction(KEYSTORE_STORE, 'readonly');
      const req = tx.objectStore(KEYSTORE_STORE).get(DEVICE_KEY_ID);
      req.onsuccess = () => resolve((req.result as CryptoKey) || null);
      req.onerror = () => resolve(null);
    });
    if (existing) {
      cachedDeviceKey = existing;
      return existing;
    }

    const created = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // Non-extractable hardware/browser keystore key
      ['encrypt', 'decrypt']
    );
    await new Promise<void>((resolve) => {
      const tx = db.transaction(KEYSTORE_STORE, 'readwrite');
      tx.objectStore(KEYSTORE_STORE).put(created, DEVICE_KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    cachedDeviceKey = created;
    return created;
  } catch {
    return null;
  }
}

export async function sealRootForStorage(
  root: RootState,
  sessionMasterKeys: Record<string, Uint8Array>
): Promise<string> {
  // Always strip plaintext data for E2EE-enabled accounts before persistence
  const sanitizedAccounts = await Promise.all(
    root.accts.map(async (acct) => {
      if (!acct.e2ee?.enabled) return acct;
      const mk = sessionMasterKeys[acct.id];
      const updated = mk ? await reencryptAccountVault(acct, mk) : acct;
      return stripPrivateFields(updated);
    })
  );

  const storageRoot: RootState = {
    cur: root.cur,
    accts: sanitizedAccounts,
  };

  const json = JSON.stringify(storageRoot);
  const deviceKey = await getOrCreateDeviceKey();
  if (!deviceKey) {
    return json;
  }
  const encrypted = await encryptBytesWithKey(
    deviceKey,
    new TextEncoder().encode(json)
  );
  const envelope: EncryptedStoreEnvelope = {
    v: 'E2EE_STORE_V1',
    iv: encrypted.iv,
    data: encrypted.cipher,
  };
  return JSON.stringify(envelope);
}

export async function unsealRootFromStorage(
  raw: string
): Promise<unknown | null> {
  const parsed = JSON.parse(raw);
  if (parsed && parsed.v === 'E2EE_STORE_V1' && parsed.iv && parsed.data) {
    const deviceKey = await getOrCreateDeviceKey();
    if (!deviceKey) {
      throw new Error('Device encryption key missing');
    }
    const plainBytes = await decryptBytesWithKey(
      deviceKey,
      parsed.iv,
      parsed.data
    );
    return JSON.parse(new TextDecoder().decode(plainBytes));
  }
  return parsed;
}

// ============================================================
// Encrypted Backup Files (WhatsApp/Signal E2EE Backup)
// ============================================================

export async function encryptBackupPayload(
  root: RootState,
  password: string,
  sessionMasterKeys: Record<string, Uint8Array>
): Promise<string> {
  const normalized = normalizePasscode(password);
  if (normalized.length < 4) {
    throw new Error('Backup पासवर्ड कम से कम 4 अक्षर/अंक का होना चाहिए');
  }
  // Prepare sanitized accounts (locked accounts stay sealed inside backup too!)
  const exportAccts = await Promise.all(
    root.accts.map(async (acct) => {
      if (!acct.e2ee?.enabled) return acct;
      const mk = sessionMasterKeys[acct.id];
      const updated = mk ? await reencryptAccountVault(acct, mk) : acct;
      return stripPrivateFields(updated);
    })
  );

  const payload: RootState = {
    cur: root.cur,
    accts: exportAccts,
  };

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kek = await deriveKeyFromPasscode(
    normalized,
    salt,
    PBKDF2_ITERATIONS
  );
  const encrypted = await encryptBytesWithKey(
    kek,
    new TextEncoder().encode(JSON.stringify(payload))
  );

  const envelope: EncryptedBackupEnvelope = {
    format: 'ATTENDANCE_E2EE_BACKUP_V1',
    cipher: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: encrypted.iv,
    data: encrypted.cipher,
    createdAt: new Date().toISOString(),
  };

  return JSON.stringify(envelope, null, 2);
}

export function isEncryptedBackupString(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw.trim());
    return parsed?.format === 'ATTENDANCE_E2EE_BACKUP_V1';
  } catch {
    return false;
  }
}

export async function decryptBackupPayload(
  raw: string,
  password: string
): Promise<RootState> {
  const parsed = JSON.parse(raw.trim()) as EncryptedBackupEnvelope;
  if (parsed?.format !== 'ATTENDANCE_E2EE_BACKUP_V1') {
    throw new Error('Invalid encrypted backup format');
  }
  const salt = base64ToBytes(parsed.salt);
  const kek = await deriveKeyFromPasscode(
    password,
    salt,
    parsed.iterations || PBKDF2_ITERATIONS
  );
  const plainBytes = await decryptBytesWithKey(kek, parsed.iv, parsed.data);
  const root = JSON.parse(new TextDecoder().decode(plainBytes)) as RootState;
  if (!root || !Array.isArray(root.accts) || root.accts.length === 0) {
    throw new Error('Corrupt backup payload');
  }
  return root;
}
