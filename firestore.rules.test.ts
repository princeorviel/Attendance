export interface SecurityTestCase {
  name: string;
  actorUid: string;
  actorEmailVerified: boolean;
  targetPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_SECURITY_TESTS: SecurityTestCase[] = [
  {
    name: '1. Staff B cannot read Staff A private attendance/salary ledger',
    actorUid: 'staff_b_uid',
    actorEmailVerified: true,
    targetPath: 'shops/shop_1/staffPrivate/staff_a',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '2. Staff B cannot list all staffPrivate documents without linkedUid filter',
    actorUid: 'staff_b_uid',
    actorEmailVerified: true,
    targetPath: 'shops/shop_1/staffPrivate',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '3. Staff A cannot modify their own salary (sal)',
    actorUid: 'staff_a_uid',
    actorEmailVerified: true,
    targetPath: 'shops/shop_1/staffPrivate/staff_a',
    operation: 'update',
    payload: { sal: { '2026-11': 999999 } },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '4. Staff A cannot erase advance/payment ledger (money)',
    actorUid: 'staff_a_uid',
    actorEmailVerified: true,
    targetPath: 'shops/shop_1/staffPrivate/staff_a',
    operation: 'update',
    payload: { money: [] },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '5. Staff A cannot overwrite official owner-marked attendance (days)',
    actorUid: 'staff_a_uid',
    actorEmailVerified: true,
    targetPath: 'shops/shop_1/staffPrivate/staff_a',
    operation: 'update',
    payload: { days: { '2026-11-18': { s: 'P' } } },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '6. Staff cannot self-assign owner or manager role on join',
    actorUid: 'staff_b_uid',
    actorEmailVerified: true,
    targetPath: 'shops/shop_1/members/staff_b_uid',
    operation: 'create',
    payload: { role: 'owner', shopId: 'shop_1', uid: 'staff_b_uid' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '7. Outsider cannot join shop without matching joinCode',
    actorUid: 'outsider_uid',
    actorEmailVerified: true,
    targetPath: 'shops/shop_1/members/outsider_uid',
    operation: 'create',
    payload: { role: 'staff', joinCode: 'WRONG999', shopId: 'shop_1' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '8. Shadow ghost field injection rejected by hasOnly schema gate',
    actorUid: 'owner_uid',
    actorEmailVerified: true,
    targetPath: 'shops/shop_1/staffPrivate/staff_x',
    operation: 'create',
    payload: { staffId: 'staff_x', isAdmin: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '9. Oversized or invalid path ID rejected by isValidId',
    actorUid: 'owner_uid',
    actorEmailVerified: true,
    targetPath: `shops/shop_1/staffPrivate/${'x'.repeat(200)}`,
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '10. Staff C cannot intercept direct share between Staff A and Staff B',
    actorUid: 'staff_c_uid',
    actorEmailVerified: true,
    targetPath: 'shops/shop_1/shares/share_ab',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '11. Staff cannot delete another staff member or shop account',
    actorUid: 'staff_a_uid',
    actorEmailVerified: true,
    targetPath: 'shops/shop_1/staffPrivate/staff_a',
    operation: 'delete',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '12. Unverified email account rejected on write',
    actorUid: 'unverified_uid',
    actorEmailVerified: false,
    targetPath: 'users/unverified_uid',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
