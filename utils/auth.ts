import type {
  AppSession,
  OwnerAccount,
  PermissionGroup,
  StaffUser,
} from '../types';
import { apiJson, getAuthToken, setAuthToken } from './api';
import { ALL_PERMISSIONS, buildPresetGroups, sanitizeGroupPermissions } from './permissions';

export const DEFAULT_OWNER_USERNAME = 'admin';
export const DEFAULT_OWNER_PASSWORD = '1111';

/** Memory mirrors updated after login / state load */
let cachedOwner: OwnerAccount | null = null;
let cachedGroups: PermissionGroup[] = [];
let cachedStaff: StaffUser[] = [];
let cachedSession: AppSession | null = null;

export function hydrateAuthCache(input: {
  owner?: OwnerAccount | null;
  ownerPublic?: { username: string; displayName: string; needsPasswordChange?: boolean } | null;
  permissionGroups?: PermissionGroup[];
  staffUsers?: StaffUser[];
  session?: AppSession | null;
}) {
  if (input.owner) cachedOwner = input.owner;
  else if (input.ownerPublic) {
    cachedOwner = {
      username: input.ownerPublic.username,
      displayName: input.ownerPublic.displayName,
      hashedPassword: '',
      needsPasswordChange: input.ownerPublic.needsPasswordChange,
    };
  }
  if (input.permissionGroups) {
    cachedGroups = input.permissionGroups.map((g) => ({
      ...g,
      permissions: sanitizeGroupPermissions(g.permissions),
    }));
  }
  if (input.staffUsers) cachedStaff = input.staffUsers;
  if (input.session !== undefined) cachedSession = input.session;
}

export async function initUser() {
  /* Server seeds owner on boot — no-op for compatibility */
}

export function getOwnerAccount(): OwnerAccount | null {
  return cachedOwner;
}

export function getPermissionGroups(): PermissionGroup[] {
  if (!cachedGroups.length) return buildPresetGroups();
  return cachedGroups;
}

export async function savePermissionGroups(groups: PermissionGroup[]) {
  const sanitized = groups.map((g) => ({
    ...g,
    permissions: sanitizeGroupPermissions(g.permissions),
  }));
  cachedGroups = sanitized;
  await apiJson('/api/state', 'PUT', { permissionGroups: sanitized });
}

export function getStaffUsers(): StaffUser[] {
  return cachedStaff;
}

export async function saveStaffUsers(users: StaffUser[]) {
  cachedStaff = users;
  await apiJson('/api/state', 'PUT', { staffUsers: users });
}

export async function login(username: string, password: string): Promise<AppSession | null> {
  try {
    const data = await apiJson<{ token: string; session: AppSession }>('/api/auth/login', 'POST', {
      username,
      password,
    });
    setAuthToken(data.token);
    cachedSession = data.session;
    return data.session;
  } catch {
    return null;
  }
}

export function resolveSession(): AppSession | null {
  if (!getAuthToken()) return null;
  return cachedSession;
}

export async function logout() {
  try {
    if (getAuthToken()) await apiJson('/api/auth/logout', 'POST', {});
  } catch {
    /* ignore */
  }
  setAuthToken(null);
  cachedSession = null;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const data = await apiJson<{ message?: string }>('/api/auth/password', 'POST', {
      currentPassword,
      newPassword,
    });
    return { success: true, message: data.message || 'رمز عبور با موفقیت تغییر کرد.' };
  } catch (e: any) {
    return { success: false, message: e?.message || 'تغییر رمز ناموفق بود.' };
  }
}

export async function hashPassword(password: string): Promise<string> {
  const buffer = new TextEncoder().encode(password);
  if (self.crypto?.subtle?.digest) {
    const hashBuffer = await self.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return '';
}

export async function isOwnerUsingDefaultPassword(): Promise<boolean> {
  try {
    const data = await apiJson<{ showDefaultHints: boolean }>('/api/auth/default-hint', 'GET');
    return Boolean(data.showDefaultHints);
  } catch {
    return false;
  }
}

export { ALL_PERMISSIONS };
