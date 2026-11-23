import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../firebase';
import {
  Account,
  DayEntry,
  ManagerPermissions,
  ShopDoc,
  ShopMemberDoc,
  ShopRequestDoc,
  ShopRole,
  ShopShareDoc,
  StaffDirectoryCard,
  Story,
  UserShopSummary,
} from '../types';
import { DEFAULT_MANAGER_PERMISSIONS, expandDateRange } from './hazri';

function makeRandomCode(len = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => chars[b % chars.length])
    .join('');
}

function sanitizeId(raw: string, fallback: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
  return clean || fallback;
}

function clampStr(raw: string | undefined, max: number): string {
  return (raw || '').trim().slice(0, max);
}

function sanitizeStoriesForFirestore(stories: Story[] | undefined): Story[] {
  if (!Array.isArray(stories)) return [];
  const now = Date.now();
  return stories
    .filter((s) => now - s.ts < 86400000)
    .slice(-8)
    .map((s) => ({
      id: String(s.id || `s${Date.now()}`).slice(0, 64),
      type: s.type || 'text',
      txt: (s.txt || '').slice(0, 500),
      bg: (s.bg || '#111827').slice(0, 120),
      img: s.img && s.img.length <= 60000 ? s.img : '',
      duration: typeof s.duration === 'number' ? s.duration : 6,
      fontStyle: s.fontStyle || 'sans',
      sticker: (s.sticker || '').slice(0, 60),
      reactions: s.reactions || {},
      views: typeof s.views === 'number' ? s.views : 0,
      ts: Number(s.ts) || now,
    }));
}

export async function ensureUserDoc(user: User): Promise<{
  activeShopId: string;
  shopIds: string[];
}> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  if (snap.exists()) {
    const data = snap.data();
    return {
      activeShopId: String(data.activeShopId || ''),
      shopIds: Array.isArray(data.shopIds)
        ? data.shopIds.map((x) => String(x)).filter(Boolean)
        : [],
    };
  }

  try {
    await setDoc(ref, {
      uid: user.uid,
      email: clampStr(user.email || 'user@example.com', 200),
      displayName: clampStr(user.displayName || user.email || 'User', 100) || 'User',
      photoUrl: clampStr(user.photoURL || '', 1000),
      activeShopId: '',
      shopIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { activeShopId: '', shopIds: [] };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

async function addShopIdToUserDoc(user: User, shopId: string): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const existingIds: string[] =
    userSnap.exists() && Array.isArray(userSnap.data().shopIds)
      ? userSnap.data().shopIds.map((x: unknown) => String(x)).filter(Boolean)
      : [];
  const nextShopIds = Array.from(new Set([shopId, ...existingIds])).slice(0, 30);
  await updateDoc(userRef, {
    activeShopId: shopId,
    shopIds: nextShopIds,
    updatedAt: serverTimestamp(),
  });
}

export async function loadUserShops(
  user: User,
  savedShopIds: string[] = []
): Promise<UserShopSummary[]> {
  const byId = new Map<string, UserShopSummary>();

  try {
    const [ownedSnap, managedSnap] = await Promise.all([
      getDocs(
        query(collection(db, 'shops'), where('ownerUid', '==', user.uid))
      ),
      getDocs(
        query(
          collection(db, 'shops'),
          where('managerUids', 'array-contains', user.uid)
        )
      ),
    ]);

    const addFromShopDoc = (sd: Record<string, unknown>, role: ShopRole) => {
      const shopId = String(sd.shopId || '');
      if (!shopId || byId.has(shopId)) return;
      byId.set(shopId, {
        shop: {
          shopId,
          name: String(sd.name || 'Shop'),
          ownerUid: String(sd.ownerUid || ''),
          ownerEmail: String(sd.ownerEmail || ''),
          joinCode: String(sd.joinCode || ''),
          managerUids: Array.isArray(sd.managerUids)
            ? sd.managerUids.map((x) => String(x))
            : [],
        },
        role,
      });
    };

    ownedSnap.forEach((d) => addFromShopDoc(d.data(), 'owner'));
    managedSnap.forEach((d) => addFromShopDoc(d.data(), 'manager'));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'shops');
  }

  for (const sid of savedShopIds) {
    if (!sid || byId.has(sid)) continue;
    try {
      const ctx = await loadActiveShopContext(user, sid);
      if (ctx) {
        byId.set(sid, {
          shop: ctx.shop,
          role: ctx.member.role,
          staffId: ctx.member.staffId,
        });
      }
    } catch {
      // Ignore deleted or revoked shops in saved history
    }
  }

  const list = Array.from(byId.values()).sort((a, b) =>
    b.shop.shopId.localeCompare(a.shop.shopId)
  );

  // Backfill any newly discovered owned/managed shops into users/{uid}.shopIds
  const discoveredIds = list.map((item) => item.shop.shopId).slice(0, 30);
  if (
    discoveredIds.some((id) => !savedShopIds.includes(id))
  ) {
    const mergedIds = Array.from(
      new Set([...discoveredIds, ...savedShopIds])
    ).slice(0, 30);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        shopIds: mergedIds,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-fatal backfill
    }
  }

  return list;
}

export async function switchActiveShop(
  user: User,
  shopId: string
): Promise<{ shop: ShopDoc; member: ShopMemberDoc } | null> {
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      activeShopId: shopId,
      updatedAt: serverTimestamp(),
    });
    if (!shopId) return null;
    return await loadActiveShopContext(user, shopId);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
  }
}

export async function loadActiveShopContext(
  user: User,
  shopId: string
): Promise<{
  shop: ShopDoc;
  member: ShopMemberDoc;
} | null> {
  if (!shopId) return null;
  try {
    const memberRef = doc(db, 'shops', shopId, 'members', user.uid);
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) {
      return null;
    }
    const shopRef = doc(db, 'shops', shopId);
    const shopSnap = await getDoc(shopRef);
    if (!shopSnap.exists()) {
      return null;
    }
    const sd = shopSnap.data();
    const md = memberSnap.data();
    return {
      shop: {
        shopId: String(sd.shopId),
        name: String(sd.name),
        ownerUid: String(sd.ownerUid),
        ownerEmail: String(sd.ownerEmail),
        joinCode: String(sd.joinCode),
        managerUids: Array.isArray(sd.managerUids) ? sd.managerUids : [],
      },
      member: {
        uid: String(md.uid),
        shopId: String(md.shopId),
        ownerUid: String(md.ownerUid),
        email: String(md.email),
        displayName: String(md.displayName),
        role: (md.role as ShopRole) || 'staff',
        staffId: md.staffId ? String(md.staffId) : '',
        permissions: md.permissions
          ? (md.permissions as ManagerPermissions)
          : undefined,
      },
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `shops/${shopId}`);
  }
}

export async function createShopWorkspace(
  user: User,
  shopName: string,
  localAccounts: Account[]
): Promise<{ shop: ShopDoc; member: ShopMemberDoc }> {
  const shopId = `shop_${Date.now()}_${makeRandomCode(6).toLowerCase()}`;
  const joinCode = `SHOP-${makeRandomCode(8)}`;
  const ownerEmail = clampStr(user.email || 'user@example.com', 200);
  const ownerName = clampStr(user.displayName || 'Shop Owner', 100) || 'Shop Owner';

  try {
    // 1. Create Shop doc
    await setDoc(doc(db, 'shops', shopId), {
      shopId,
      name: clampStr(shopName, 100) || 'My Shop',
      ownerUid: user.uid,
      ownerEmail,
      joinCode,
      managerUids: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Create secret invite doc
    await setDoc(doc(db, 'shopInvites', joinCode), {
      joinCode,
      shopId,
      shopName: clampStr(shopName, 100) || 'My Shop',
      ownerUid: user.uid,
      createdAt: serverTimestamp(),
    });

    // 3. Create Owner membership
    const ownerStaffId = sanitizeId(localAccounts[0]?.id || 'a1', 'a1');
    await setDoc(doc(db, 'shops', shopId, 'members', user.uid), {
      uid: user.uid,
      shopId,
      ownerUid: user.uid,
      email: ownerEmail,
      displayName: ownerName,
      role: 'owner',
      staffId: ownerStaffId,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 4. Sync initial accounts (owner = a1, others = staff slots)
    const accountsToSeed = localAccounts.length > 0 ? localAccounts : [];
    for (let i = 0; i < accountsToSeed.length; i++) {
      const acct = accountsToSeed[i];
      const staffId = sanitizeId(acct.id, `staff_${i + 1}`);
      const isFirst = i === 0;
      const linkedUid = isFirst ? user.uid : '';
      const linkedEmail = isFirst
        ? ownerEmail.toLowerCase()
        : clampStr(acct.em, 200).toLowerCase();

      await setDoc(doc(db, 'shops', shopId, 'directory', staffId), {
        staffId,
        shopId,
        ownerUid: user.uid,
        managerUids: [],
        linkedUid,
        name: clampStr(acct.name, 100) || 'Staff',
        photo: clampStr(acct.photo, 380000),
        emo: clampStr(acct.emo, 16),
        roleLabel: isFirst ? 'owner' : 'staff',
        followersCount: 0,
        stories: sanitizeStoriesForFirestore(acct.stories),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'shops', shopId, 'staffPrivate', staffId), {
        staffId,
        shopId,
        ownerUid: user.uid,
        managerUids: [],
        linkedUid,
        linkedEmail,
        name: clampStr(acct.name, 100) || 'Staff',
        ph: clampStr(acct.ph, 30),
        em: clampStr(acct.em, 200),
        days: acct.days || {},
        selfDays: acct.selfDays || {},
        money: Array.isArray(acct.money) ? acct.money.slice(-1500) : [],
        sal: acct.sal || {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 5. Update user's activeShopId & shopIds
    await addShopIdToUserDoc(user, shopId);

    return {
      shop: {
        shopId,
        name: clampStr(shopName, 100) || 'My Shop',
        ownerUid: user.uid,
        ownerEmail,
        joinCode,
        managerUids: [],
      },
      member: {
        uid: user.uid,
        shopId,
        ownerUid: user.uid,
        email: ownerEmail,
        displayName: ownerName,
        role: 'owner',
        staffId: ownerStaffId,
      },
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}`);
  }
}

export async function joinShopByCode(
  user: User,
  rawCode: string
): Promise<{ shop: ShopDoc; member: ShopMemberDoc }> {
  const joinCode = rawCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!joinCode) {
    throw new Error('सही Shop Code डालें');
  }

  let inviteData: Record<string, unknown>;
  try {
    const inviteSnap = await getDoc(doc(db, 'shopInvites', joinCode));
    if (!inviteSnap.exists()) {
      throw new Error('यह Shop Code नहीं मिला — कृपया Owner से सही कोड लें');
    }
    inviteData = inviteSnap.data();
  } catch (err) {
    if ((err as Error).message.includes('Shop Code')) throw err;
    handleFirestoreError(err, OperationType.GET, `shopInvites/${joinCode}`);
  }

  const shopId = String(inviteData.shopId);
  const ownerUid = String(inviteData.ownerUid);
  const userEmail = clampStr(user.email || 'user@example.com', 200).toLowerCase();
  const displayName = clampStr(user.displayName || userEmail || 'Staff', 100) || 'Staff';

  try {
    const memberRef = doc(db, 'shops', shopId, 'members', user.uid);
    const existingMember = await getDoc(memberRef);

    let assignedStaffId = existingMember.exists()
      ? String(existingMember.data().staffId || '')
      : '';

    if (!existingMember.exists()) {
      await setDoc(memberRef, {
        uid: user.uid,
        shopId,
        ownerUid,
        email: userEmail,
        displayName,
        role: 'staff',
        staffId: '',
        joinCode,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Try finding an unlinked pre-created staffPrivate doc matching this user's Gmail
    if (!assignedStaffId && user.email) {
      const claimQ = query(
        collection(db, 'shops', shopId, 'staffPrivate'),
        where('linkedUid', '==', ''),
        where('linkedEmail', '==', userEmail)
      );
      const claimSnaps = await getDocs(claimQ);
      const match = claimSnaps.docs[0];
      if (match) {
        assignedStaffId = match.id;
        await updateDoc(doc(db, 'shops', shopId, 'staffPrivate', assignedStaffId), {
          linkedUid: user.uid,
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'shops', shopId, 'directory', assignedStaffId), {
          linkedUid: user.uid,
          updatedAt: serverTimestamp(),
        });
      }
    }

    // If Owner didn't pre-create an email slot, create staff's own isolated slot
    if (!assignedStaffId) {
      const shopSnap = await getDoc(doc(db, 'shops', shopId));
      const managerUids = Array.isArray(shopSnap.data()?.managerUids)
        ? shopSnap.data()?.managerUids
        : [];
      assignedStaffId = sanitizeId(`staff_${user.uid.slice(0, 12)}`, `s_${Date.now()}`);

      const dirSnap = await getDoc(
        doc(db, 'shops', shopId, 'directory', assignedStaffId)
      );
      if (!dirSnap.exists()) {
        await setDoc(doc(db, 'shops', shopId, 'directory', assignedStaffId), {
          staffId: assignedStaffId,
          shopId,
          ownerUid,
          managerUids,
          linkedUid: user.uid,
          name: displayName,
          photo: '',
          emo: '',
          roleLabel: 'staff',
          followersCount: 0,
          stories: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const privSnap = await getDoc(
        doc(db, 'shops', shopId, 'staffPrivate', assignedStaffId)
      );
      if (!privSnap.exists()) {
        await setDoc(doc(db, 'shops', shopId, 'staffPrivate', assignedStaffId), {
          staffId: assignedStaffId,
          shopId,
          ownerUid,
          managerUids,
          linkedUid: user.uid,
          linkedEmail: userEmail,
          name: displayName,
          ph: '',
          em: userEmail,
          days: {},
          selfDays: {},
          money: [],
          sal: {},
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    await updateDoc(memberRef, {
      staffId: assignedStaffId,
      updatedAt: serverTimestamp(),
    });

    await addShopIdToUserDoc(user, shopId);

    const ctx = await loadActiveShopContext(user, shopId);
    if (!ctx) {
      throw new Error('Shop लोड नहीं हो सकी');
    }
    return ctx;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}`);
  }
}

export async function leaveShopWorkspace(user: User): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      activeShopId: '',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
  }
}

async function deleteDocsInChunks(
  docs: Array<{ ref: ReturnType<typeof doc> }>
): Promise<void> {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const chunk = docs.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function deleteShopWorkspace(
  user: User,
  shop: ShopDoc,
  options?: { skipUserDocUpdate?: boolean }
): Promise<void> {
  if (shop.ownerUid !== user.uid) {
    throw new Error('केवल Shop Owner ही यह Shop डिलीट कर सकते हैं।');
  }
  const shopId = shop.shopId;
  try {
    // Delete all subcollections BEFORE deleting shops/{shopId} so isShopOwner/isShopMember rules remain satisfied
    const [dirSnap, privSnap, reqSnap, shareSnap, followSnap, memberSnap] =
      await Promise.all([
        getDocs(collection(db, 'shops', shopId, 'directory')),
        getDocs(
          query(
            collection(db, 'shops', shopId, 'staffPrivate'),
            where('ownerUid', '==', user.uid)
          )
        ),
        getDocs(
          query(
            collection(db, 'shops', shopId, 'requests'),
            where('ownerUid', '==', user.uid)
          )
        ),
        getDocs(
          query(
            collection(db, 'shops', shopId, 'shares'),
            where('ownerUid', '==', user.uid)
          )
        ),
        getDocs(
          query(
            collection(db, 'shops', shopId, 'follows'),
            where('ownerUid', '==', user.uid)
          )
        ),
        getDocs(
          query(
            collection(db, 'shops', shopId, 'members'),
            where('ownerUid', '==', user.uid)
          )
        ),
      ]);

    await deleteDocsInChunks(dirSnap.docs);
    await deleteDocsInChunks(privSnap.docs);
    await deleteDocsInChunks(reqSnap.docs);
    await deleteDocsInChunks(shareSnap.docs);
    await deleteDocsInChunks(followSnap.docs);
    await deleteDocsInChunks(memberSnap.docs);

    if (shop.joinCode) {
      try {
        await deleteDoc(doc(db, 'shopInvites', shop.joinCode));
      } catch {
        // ignore if invite doc already removed
      }
    }

    await deleteDoc(doc(db, 'shops', shopId));

    if (!options?.skipUserDocUpdate) {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const existingIds = Array.isArray(data.shopIds)
          ? (data.shopIds as string[])
          : [];
        const nextShopIds = existingIds.filter((id) => id !== shopId);
        const currentActive = String(data.activeShopId || '');
        const nextActiveShopId =
          currentActive === shopId ? nextShopIds[0] || '' : currentActive;
        await updateDoc(userRef, {
          shopIds: nextShopIds,
          activeShopId: nextActiveShopId,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `shops/${shopId}`);
  }
}

export async function deleteShopkeeperData(user: User): Promise<void> {
  try {
    const ownedSnap = await getDocs(
      query(collection(db, 'shops'), where('ownerUid', '==', user.uid))
    );
    for (const d of ownedSnap.docs) {
      const s = d.data();
      const ownedShop: ShopDoc = {
        shopId: String(s.shopId || d.id),
        name: String(s.name || 'My Shop'),
        ownerUid: String(s.ownerUid || user.uid),
        ownerEmail: String(s.ownerEmail || user.email || ''),
        joinCode: String(s.joinCode || ''),
        managerUids: Array.isArray(s.managerUids) ? s.managerUids : [],
      };
      await deleteShopWorkspace(user, ownedShop, { skipUserDocUpdate: true });
    }

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await deleteDoc(userRef);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}`);
  }
}

export async function addShopStaff(
  shop: ShopDoc,
  payload: {
    name: string;
    ph: string;
    em: string;
    photo: string;
    emo: string;
  }
): Promise<string> {
  const staffId = `staff_${Date.now()}_${makeRandomCode(4).toLowerCase()}`;
  const cleanEmail = clampStr(payload.em, 200).toLowerCase();
  try {
    await setDoc(doc(db, 'shops', shop.shopId, 'directory', staffId), {
      staffId,
      shopId: shop.shopId,
      ownerUid: shop.ownerUid,
      managerUids: shop.managerUids,
      linkedUid: '',
      name: clampStr(payload.name, 100) || 'Staff',
      photo: clampStr(payload.photo, 380000),
      emo: clampStr(payload.emo, 16),
      roleLabel: 'staff',
      followersCount: 0,
      stories: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'shops', shop.shopId, 'staffPrivate', staffId), {
      staffId,
      shopId: shop.shopId,
      ownerUid: shop.ownerUid,
      managerUids: shop.managerUids,
      linkedUid: '',
      linkedEmail: cleanEmail,
      name: clampStr(payload.name, 100) || 'Staff',
      ph: clampStr(payload.ph, 30),
      em: cleanEmail,
      days: {},
      selfDays: {},
      money: [],
      sal: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return staffId;
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.CREATE,
      `shops/${shop.shopId}/staffPrivate/${staffId}`
    );
  }
}

export async function deleteShopStaff(
  shopId: string,
  staffId: string,
  options?: {
    linkedUid?: string;
    ownerUid?: string;
    isOwner?: boolean;
    managerUids?: string[];
  }
): Promise<void> {
  try {
    const ops: Array<Promise<unknown>> = [
      deleteDoc(doc(db, 'shops', shopId, 'directory', staffId)),
      deleteDoc(doc(db, 'shops', shopId, 'staffPrivate', staffId)),
    ];
    if (
      options?.isOwner &&
      options.linkedUid &&
      options.linkedUid !== options.ownerUid
    ) {
      ops.push(
        deleteDoc(doc(db, 'shops', shopId, 'members', options.linkedUid))
      );
      if (
        Array.isArray(options.managerUids) &&
        options.managerUids.includes(options.linkedUid)
      ) {
        const nextManagers = options.managerUids.filter(
          (uid) => uid !== options.linkedUid
        );
        ops.push(
          updateDoc(doc(db, 'shops', shopId), {
            managerUids: nextManagers,
            updatedAt: serverTimestamp(),
          })
        );
      }
    }
    await Promise.all(ops);
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.DELETE,
      `shops/${shopId}/staffPrivate/${staffId}`
    );
  }
}

export async function saveOwnerStaffPatch(
  shopId: string,
  staffId: string,
  privatePatch: Partial<{
    name: string;
    ph: string;
    em: string;
    linkedEmail: string;
    days: Record<string, DayEntry>;
    selfDays: Record<string, DayEntry>;
    money: Account['money'];
    sal: Account['sal'];
  }>,
  directoryPatch?: Partial<{
    name: string;
    photo: string;
    emo: string;
    stories: Story[];
  }>
): Promise<void> {
  try {
    if (Object.keys(privatePatch).length > 0) {
      const cleaned: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (privatePatch.name !== undefined)
        cleaned.name = clampStr(privatePatch.name, 100);
      if (privatePatch.ph !== undefined)
        cleaned.ph = clampStr(privatePatch.ph, 30);
      if (privatePatch.em !== undefined) {
        cleaned.em = clampStr(privatePatch.em, 200).toLowerCase();
        cleaned.linkedEmail = clampStr(privatePatch.em, 200).toLowerCase();
      }
      if (privatePatch.days !== undefined) cleaned.days = privatePatch.days;
      if (privatePatch.selfDays !== undefined)
        cleaned.selfDays = privatePatch.selfDays;
      if (privatePatch.money !== undefined)
        cleaned.money = privatePatch.money.slice(-1500);
      if (privatePatch.sal !== undefined) cleaned.sal = privatePatch.sal;

      await updateDoc(
        doc(db, 'shops', shopId, 'staffPrivate', staffId),
        cleaned
      );
    }

    if (directoryPatch && Object.keys(directoryPatch).length > 0) {
      const dirClean: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (directoryPatch.name !== undefined)
        dirClean.name = clampStr(directoryPatch.name, 100);
      if (directoryPatch.photo !== undefined)
        dirClean.photo = clampStr(directoryPatch.photo, 380000);
      if (directoryPatch.emo !== undefined)
        dirClean.emo = clampStr(directoryPatch.emo, 16);
      if (directoryPatch.stories !== undefined)
        dirClean.stories = sanitizeStoriesForFirestore(directoryPatch.stories);

      await updateDoc(
        doc(db, 'shops', shopId, 'directory', staffId),
        dirClean
      );
    }
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `shops/${shopId}/staffPrivate/${staffId}`
    );
  }
}

export async function saveStaffSelfAttendance(
  shopId: string,
  staffId: string,
  selfDays: Record<string, DayEntry>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'shops', shopId, 'staffPrivate', staffId), {
      selfDays,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `shops/${shopId}/staffPrivate/${staffId}`
    );
  }
}

export async function saveStaffDirectoryProfile(
  shopId: string,
  staffId: string,
  patch: Partial<{ photo: string; emo: string; stories: Story[] }>
): Promise<void> {
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.photo !== undefined) clean.photo = clampStr(patch.photo, 380000);
    if (patch.emo !== undefined) clean.emo = clampStr(patch.emo, 16);
    if (patch.stories !== undefined)
      clean.stories = sanitizeStoriesForFirestore(patch.stories);
    await updateDoc(doc(db, 'shops', shopId, 'directory', staffId), clean);
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `shops/${shopId}/directory/${staffId}`
    );
  }
}

export async function toggleFollowTeammate(
  shop: ShopDoc,
  followerUid: string,
  targetCard: StaffDirectoryCard,
  currentlyFollowing: boolean
): Promise<void> {
  const followId = `${followerUid}_${targetCard.staffId}`;
  const followRef = doc(db, 'shops', shop.shopId, 'follows', followId);
  const dirRef = doc(db, 'shops', shop.shopId, 'directory', targetCard.staffId);

  try {
    const batch = writeBatch(db);
    if (currentlyFollowing) {
      batch.delete(followRef);
      batch.update(dirRef, {
        followersCount: Math.max(0, (targetCard.followersCount || 0) - 1),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(followRef, {
        followId,
        shopId: shop.shopId,
        ownerUid: shop.ownerUid,
        followerUid,
        targetStaffId: targetCard.staffId,
        createdAt: serverTimestamp(),
      });
      batch.update(dirRef, {
        followersCount: (targetCard.followersCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.WRITE,
      `shops/${shop.shopId}/follows/${followId}`
    );
  }
}

export async function setMemberRole(
  shop: ShopDoc,
  targetMember: ShopMemberDoc,
  newRole: 'manager' | 'staff',
  permissions?: ManagerPermissions
): Promise<void> {
  try {
    const memberPatch: Record<string, unknown> = {
      role: newRole,
      updatedAt: serverTimestamp(),
    };
    if (newRole === 'manager') {
      memberPatch.permissions =
        permissions || targetMember.permissions || DEFAULT_MANAGER_PERMISSIONS;
    }

    await updateDoc(
      doc(db, 'shops', shop.shopId, 'members', targetMember.uid),
      memberPatch
    );

    const nextManagers =
      newRole === 'manager'
        ? Array.from(new Set([...shop.managerUids, targetMember.uid])).slice(
            0,
            10
          )
        : shop.managerUids.filter((id) => id !== targetMember.uid);

    await updateDoc(doc(db, 'shops', shop.shopId), {
      managerUids: nextManagers,
      updatedAt: serverTimestamp(),
    });

    // Propagate updated managerUids to staffPrivate, directory, and pending requests
    const privSnaps = await getDocs(
      query(
        collection(db, 'shops', shop.shopId, 'staffPrivate'),
        where('ownerUid', '==', shop.ownerUid)
      )
    );
    for (const d of privSnaps.docs) {
      await updateDoc(d.ref, {
        managerUids: nextManagers,
        updatedAt: serverTimestamp(),
      });
    }
    const dirSnaps = await getDocs(
      collection(db, 'shops', shop.shopId, 'directory')
    );
    for (const d of dirSnaps.docs) {
      const patch: Record<string, unknown> = {
        managerUids: nextManagers,
        updatedAt: serverTimestamp(),
      };
      if (d.data().linkedUid === targetMember.uid) {
        patch.roleLabel = newRole;
      }
      await updateDoc(d.ref, patch);
    }

    const reqSnaps = await getDocs(
      query(
        collection(db, 'shops', shop.shopId, 'requests'),
        where('ownerUid', '==', shop.ownerUid),
        where('status', '==', 'pending')
      )
    );
    for (const d of reqSnaps.docs) {
      await updateDoc(d.ref, {
        managerUids: nextManagers,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `shops/${shop.shopId}/members/${targetMember.uid}`
    );
  }
}

export async function updateManagerPermissions(
  shopId: string,
  targetUid: string,
  permissions: ManagerPermissions
): Promise<void> {
  try {
    await updateDoc(doc(db, 'shops', shopId, 'members', targetUid), {
      permissions,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `shops/${shopId}/members/${targetUid}`
    );
  }
}

export async function renameShopBranch(
  shopId: string,
  nextName: string
): Promise<string> {
  const cleanName = clampStr(nextName, 100);
  if (!cleanName) throw new Error('Shop का नाम लिखें');
  try {
    await updateDoc(doc(db, 'shops', shopId), {
      name: cleanName,
      updatedAt: serverTimestamp(),
    });
    return cleanName;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shops/${shopId}`);
  }
}

export async function regenerateShopJoinCode(shop: ShopDoc): Promise<string> {
  const nextCode = `SHOP-${makeRandomCode(8)}`;
  try {
    await setDoc(doc(db, 'shopInvites', nextCode), {
      joinCode: nextCode,
      shopId: shop.shopId,
      shopName: clampStr(shop.name, 100) || 'My Shop',
      ownerUid: shop.ownerUid,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'shops', shop.shopId), {
      joinCode: nextCode,
      updatedAt: serverTimestamp(),
    });
    if (shop.joinCode) {
      try {
        await deleteDoc(doc(db, 'shopInvites', shop.joinCode));
      } catch {
        // ignore if old invite already removed
      }
    }
    return nextCode;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shops/${shop.shopId}`);
  }
}

export async function submitShopRequest(
  shop: ShopDoc,
  payload: {
    staffId: string;
    staffUid: string;
    staffName: string;
    type: 'punch' | 'leave';
    requestedStatus: 'P' | 'H' | 'L';
    fromDate: string;
    toDate: string;
    reason?: string;
    inTime?: string;
    outTime?: string;
    gps?: string;
    selfie?: string;
  }
): Promise<string> {
  const requestId = `req_${Date.now()}_${makeRandomCode(4).toLowerCase()}`;
  const cleanSelfie =
    payload.selfie && payload.selfie.length <= 28000 ? payload.selfie : '';
  try {
    await setDoc(doc(db, 'shops', shop.shopId, 'requests', requestId), {
      requestId,
      shopId: shop.shopId,
      ownerUid: shop.ownerUid,
      managerUids: shop.managerUids,
      staffId: sanitizeId(payload.staffId, 'a1'),
      staffUid: payload.staffUid,
      staffName: clampStr(payload.staffName, 100) || 'Staff',
      type: payload.type,
      requestedStatus: payload.requestedStatus,
      fromDate: payload.fromDate.slice(0, 10),
      toDate: (payload.toDate || payload.fromDate).slice(0, 10),
      reason: clampStr(payload.reason, 280),
      inTime: clampStr(payload.inTime, 20),
      outTime: clampStr(payload.outTime, 20),
      gps: clampStr(payload.gps, 75),
      selfie: cleanSelfie,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return requestId;
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.CREATE,
      `shops/${shop.shopId}/requests/${requestId}`
    );
  }
}

export async function updatePendingPunchOut(
  shopId: string,
  requestId: string,
  outTime: string,
  gps?: string
): Promise<void> {
  try {
    const patch: Record<string, unknown> = {
      outTime: clampStr(outTime, 20),
      updatedAt: serverTimestamp(),
    };
    if (gps) patch.gps = clampStr(gps, 75);
    await updateDoc(doc(db, 'shops', shopId, 'requests', requestId), patch);
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `shops/${shopId}/requests/${requestId}`
    );
  }
}

export async function reviewShopRequest(
  shop: ShopDoc,
  req: ShopRequestDoc,
  existingStaffDays: Record<string, DayEntry>,
  decision: 'approved' | 'rejected',
  reviewerUid: string,
  reviewerName: string,
  reviewNote?: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'shops', shop.shopId, 'requests', req.requestId), {
      status: decision,
      reviewNote: clampStr(reviewNote, 180),
      reviewedByUid: reviewerUid,
      reviewedByName: clampStr(reviewerName, 100) || 'Owner',
      updatedAt: serverTimestamp(),
    });

    if (decision === 'approved') {
      const dates = expandDateRange(req.fromDate, req.toDate);
      const nextDays: Record<string, DayEntry> = { ...existingStaffDays };
      dates.forEach((dk) => {
        const prev = nextDays[dk];
        nextDays[dk] = {
          s: req.requestedStatus,
          n: req.reason || prev?.n || '',
          ...(req.inTime ? { inTime: req.inTime } : prev?.inTime ? { inTime: prev.inTime } : {}),
          ...(req.outTime ? { outTime: req.outTime } : prev?.outTime ? { outTime: prev.outTime } : {}),
          ...(req.gps ? { gps: req.gps } : prev?.gps ? { gps: prev.gps } : {}),
        };
      });
      await updateDoc(doc(db, 'shops', shop.shopId, 'staffPrivate', req.staffId), {
        days: nextDays,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `shops/${shop.shopId}/requests/${req.requestId}`
    );
  }
}

export async function deleteShopRequest(
  shopId: string,
  requestId: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'requests', requestId));
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.DELETE,
      `shops/${shopId}/requests/${requestId}`
    );
  }
}

export async function sendInAppShare(
  shop: ShopDoc,
  senderUid: string,
  senderName: string,
  recipientUid: string,
  recipientName: string,
  title: string,
  summaryText: string,
  options?: {
    recipientEmail?: string;
    recipientStaffId?: string;
  }
): Promise<void> {
  const shareId = `sh_${Date.now()}_${makeRandomCode(4).toLowerCase()}`;
  const cleanEmail = clampStr(options?.recipientEmail, 200).toLowerCase();
  const cleanStaffId = sanitizeId(options?.recipientStaffId || '', '');
  try {
    await setDoc(doc(db, 'shops', shop.shopId, 'shares', shareId), {
      shareId,
      shopId: shop.shopId,
      ownerUid: shop.ownerUid,
      senderUid,
      senderName: clampStr(senderName, 100) || 'Member',
      recipientUid,
      recipientEmail: cleanEmail,
      ...(cleanStaffId ? { recipientStaffId: cleanStaffId } : {}),
      recipientName: clampStr(recipientName, 100) || 'Member',
      title: clampStr(title, 160) || 'Attendance Report',
      summaryText: clampStr(summaryText, 7800),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.CREATE,
      `shops/${shop.shopId}/shares/${shareId}`
    );
  }
}

export async function deleteInAppShare(
  shopId: string,
  shareId: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'shares', shareId));
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.DELETE,
      `shops/${shopId}/shares/${shareId}`
    );
  }
}

export function subscribeShopWorkspace(
  shop: ShopDoc,
  user: User,
  role: ShopRole,
  callbacks: {
    onDirectory: (cards: StaffDirectoryCard[]) => void;
    onPrivateAccounts: (accounts: Account[]) => void;
    onFollows: (targetStaffIds: Set<string>) => void;
    onShares: (shares: ShopShareDoc[]) => void;
    onMembers: (members: ShopMemberDoc[]) => void;
    onRequests?: (requests: ShopRequestDoc[]) => void;
    onMemberChange?: (member: ShopMemberDoc) => void;
    onMembershipRevoked?: () => void;
  }
): () => void {
  const unsubs: Array<() => void> = [];
  let latestDirMap: Record<string, StaffDirectoryCard> = {};
  let latestPrivDocs: Array<Record<string, unknown>> = [];

  const mergeAccounts = () => {
    const merged: Account[] = latestPrivDocs.map((p) => {
      const id = String(p.staffId);
      const dir = latestDirMap[id];
      return {
        id,
        name: String(p.name || dir?.name || 'Staff'),
        ph: String(p.ph || ''),
        em: String(p.em || ''),
        photo: dir?.photo || '',
        emo: dir?.emo || '',
        days: (p.days as Record<string, DayEntry>) || {},
        selfDays: (p.selfDays as Record<string, DayEntry>) || {},
        money: Array.isArray(p.money) ? (p.money as Account['money']) : [],
        sal: (p.sal as Record<string, number>) || {},
        stories: dir?.stories || [],
        linkedUid: String(p.linkedUid || ''),
        linkedEmail: String(p.linkedEmail || ''),
        roleLabel: dir?.roleLabel || 'staff',
      };
    });
    callbacks.onPrivateAccounts(merged);
  };

  // 1. Directory listener (Non-PII cards for Follow & Stories)
  const dirPath = `shops/${shop.shopId}/directory`;
  unsubs.push(
    onSnapshot(
      collection(db, 'shops', shop.shopId, 'directory'),
      (snap) => {
        const cards: StaffDirectoryCard[] = [];
        const map: Record<string, StaffDirectoryCard> = {};
        snap.forEach((d) => {
          const v = d.data();
          const card: StaffDirectoryCard = {
            staffId: String(v.staffId),
            shopId: String(v.shopId),
            ownerUid: String(v.ownerUid),
            managerUids: Array.isArray(v.managerUids) ? v.managerUids : [],
            linkedUid: v.linkedUid ? String(v.linkedUid) : '',
            name: String(v.name || 'Staff'),
            photo: v.photo ? String(v.photo) : '',
            emo: v.emo ? String(v.emo) : '',
            roleLabel: (v.roleLabel as ShopRole) || 'staff',
            followersCount: Number(v.followersCount) || 0,
            stories: Array.isArray(v.stories) ? (v.stories as Story[]) : [],
          };
          cards.push(card);
          map[card.staffId] = card;
        });
        latestDirMap = map;
        callbacks.onDirectory(cards);
        mergeAccounts();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, dirPath)
    )
  );

  // 2. Private staff accounts listener (RBAC-enforced!)
  const privPath = `shops/${shop.shopId}/staffPrivate`;
  const privQuery =
    role === 'owner'
      ? query(
          collection(db, 'shops', shop.shopId, 'staffPrivate'),
          where('ownerUid', '==', user.uid)
        )
      : role === 'manager'
        ? query(
            collection(db, 'shops', shop.shopId, 'staffPrivate'),
            where('managerUids', 'array-contains', user.uid)
          )
        : query(
            collection(db, 'shops', shop.shopId, 'staffPrivate'),
            where('linkedUid', '==', user.uid)
          );

  unsubs.push(
    onSnapshot(
      privQuery,
      (snap) => {
        latestPrivDocs = snap.docs.map((d) => d.data());
        mergeAccounts();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, privPath)
    )
  );

  // 3. Follows listener
  const followsQ = query(
    collection(db, 'shops', shop.shopId, 'follows'),
    where('followerUid', '==', user.uid)
  );
  unsubs.push(
    onSnapshot(
      followsQ,
      (snap) => {
        const set = new Set<string>();
        snap.forEach((d) => {
          set.add(String(d.data().targetStaffId));
        });
        callbacks.onFollows(set);
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `shops/${shop.shopId}/follows`
        )
    )
  );

  // 4. Shares listener (Received by UID + Received by Email + Sent)
  let receivedShares: ShopShareDoc[] = [];
  let receivedEmailShares: ShopShareDoc[] = [];
  let sentShares: ShopShareDoc[] = [];
  const emitShares = () => {
    const map = new Map<string, ShopShareDoc>();
    [...receivedShares, ...receivedEmailShares, ...sentShares].forEach((s) =>
      map.set(s.shareId, s)
    );
    const sorted = Array.from(map.values()).sort((a, b) =>
      b.shareId.localeCompare(a.shareId)
    );
    callbacks.onShares(sorted);
  };

  unsubs.push(
    onSnapshot(
      query(
        collection(db, 'shops', shop.shopId, 'shares'),
        where('recipientUid', '==', user.uid)
      ),
      (snap) => {
        receivedShares = snap.docs.map((d) => d.data() as ShopShareDoc);
        emitShares();
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `shops/${shop.shopId}/shares`
        )
    )
  );

  const normalizedUserEmail = clampStr(user.email || '', 200).toLowerCase();
  if (normalizedUserEmail) {
    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'shops', shop.shopId, 'shares'),
          where('recipientEmail', '==', normalizedUserEmail)
        ),
        (snap) => {
          receivedEmailShares = snap.docs.map((d) => d.data() as ShopShareDoc);
          emitShares();
        },
        (err) =>
          handleFirestoreError(
            err,
            OperationType.LIST,
            `shops/${shop.shopId}/shares`
          )
      )
    );
  }

  unsubs.push(
    onSnapshot(
      query(
        collection(db, 'shops', shop.shopId, 'shares'),
        where('senderUid', '==', user.uid)
      ),
      (snap) => {
        sentShares = snap.docs.map((d) => d.data() as ShopShareDoc);
        emitShares();
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `shops/${shop.shopId}/shares`
        )
    )
  );

  // 5. Members listener (Owner sees full member list to promote Manager or inspect joins)
  if (role === 'owner') {
    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'shops', shop.shopId, 'members'),
          where('ownerUid', '==', user.uid)
        ),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as ShopMemberDoc);
          callbacks.onMembers(list);
        },
        (err) =>
          handleFirestoreError(
            err,
            OperationType.LIST,
            `shops/${shop.shopId}/members`
          )
      )
    );
  }

  // 6. Own membership listener (live permission/role sync & instant revocation enforcement)
  if (callbacks.onMemberChange || callbacks.onMembershipRevoked) {
    const memberPath = `shops/${shop.shopId}/members/${user.uid}`;
    unsubs.push(
      onSnapshot(
        doc(db, 'shops', shop.shopId, 'members', user.uid),
        (snap) => {
          if (!snap.exists()) {
            callbacks.onMembershipRevoked?.();
            return;
          }
          const md = snap.data();
          callbacks.onMemberChange?.({
            uid: String(md.uid),
            shopId: String(md.shopId),
            ownerUid: String(md.ownerUid),
            email: String(md.email),
            displayName: String(md.displayName),
            role: (md.role as ShopRole) || 'staff',
            staffId: md.staffId ? String(md.staffId) : '',
            permissions: md.permissions
              ? (md.permissions as ManagerPermissions)
              : undefined,
          });
        },
        (err) => handleFirestoreError(err, OperationType.GET, memberPath)
      )
    );
  }

  // 7. Staff Self-Service Punch & Leave Requests listener
  if (callbacks.onRequests) {
    const reqPath = `shops/${shop.shopId}/requests`;
    const reqQuery =
      role === 'owner'
        ? query(
            collection(db, 'shops', shop.shopId, 'requests'),
            where('ownerUid', '==', user.uid)
          )
        : role === 'manager'
          ? query(
              collection(db, 'shops', shop.shopId, 'requests'),
              where('managerUids', 'array-contains', user.uid)
            )
          : query(
              collection(db, 'shops', shop.shopId, 'requests'),
              where('staffUid', '==', user.uid)
            );
    unsubs.push(
      onSnapshot(
        reqQuery,
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as ShopRequestDoc)
            .sort((a, b) => b.requestId.localeCompare(a.requestId));
          callbacks.onRequests?.(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, reqPath)
      )
    );
  }

  return () => {
    unsubs.forEach((fn) => fn());
  };
}
