import { createHmac, randomUUID } from 'node:crypto';
import { test as base, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import type { LocalCache } from '../src/utils/storage';
import type { SyncSnapshot } from '../src/utils/sync';

const APP_URL = 'http://127.0.0.1:3011';
const SUPABASE_URL = 'https://benbi-test.supabase.co';
const PUBLIC_KEY = 'public-test-key-longer-than-20-characters';
const ACCOUNT_BUTTON = 'Quản lý Tài khoản, Đồng bộ Đám mây & Sao lưu JSON';
const TASK_NAME = 'VD: Đọc sách 30p, Lập trình Frontend, Thiền sáng...';
const READING = 'Đọc sách chuyên sâu';
const MEDITATION = 'Thiền chánh niệm & Thở sâu';
const EMAIL = 'alice@example.test';

type CloudRow = { user_id: string; revision: number; data: SyncSnapshot };
type FakeUser = ReturnType<typeof makeUser>;
type WriteGate = {
  userId: string;
  saved: CloudRow | null;
  ready: Promise<void>;
  release: () => void;
};

function makeUser(email: string) {
  const id = randomUUID();
  const now = new Date().toISOString();
  return {
    id, email, aud: 'authenticated', role: 'authenticated', phone: '',
    created_at: now, updated_at: now, confirmed_at: now, email_confirmed_at: now,
    last_sign_in_at: now, is_anonymous: false,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { email_verified: true },
    identities: [{
      identity_id: randomUUID(), id, user_id: id, provider: 'email',
      identity_data: { sub: id, email, email_verified: true },
      created_at: now, updated_at: now, last_sign_in_at: now,
    }],
  };
}

// All Supabase traffic is intercepted. Nothing falls through to a real project.
// Rows are shared across contexts inside ONE test, never between tests.
class FakeSupabase {
  readonly rows = new Map<string, CloudRow>();
  readonly sentEmails: string[] = [];
  readonly verifiedCodes: string[] = [];
  readonly unexpected: string[] = [];
  writes = 0;
  writeAttempts = 0;
  logouts = 0;
  private users = new Map<string, FakeUser>();
  private accessTokens = new Map<string, FakeUser>();
  private refreshTokens = new Map<string, FakeUser>();
  private offline = new Set<BrowserContext>();
  private gates: WriteGate[] = [];
  private allGates: WriteGate[] = [];

  user(email: string): FakeUser {
    const normalized = email.trim().toLowerCase();
    if (!this.users.has(normalized)) this.users.set(normalized, makeUser(normalized));
    return this.users.get(normalized)!;
  }

  row(email = EMAIL) { return this.rows.get(this.user(email).id); }

  private session(user: FakeUser) {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
      iss: `${SUPABASE_URL}/auth/v1`, sub: user.id, aud: 'authenticated',
      exp: now + 3600, iat: now, email: user.email, role: 'authenticated',
      aal: 'aal1', amr: [{ method: 'otp', timestamp: now }],
      session_id: randomUUID(), is_anonymous: false,
    })}`;
    // Local-only signing material: a structurally valid JWT, not a real credential.
    const signature = createHmac('sha256', 'playwright-local-fake-signing-key').update(unsigned).digest('base64url');
    const access_token = `${unsigned}.${signature}`;
    const refresh_token = randomUUID();
    this.accessTokens.set(access_token, user);
    this.refreshTokens.set(refresh_token, user);
    return { access_token, refresh_token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user };
  }

  async install(context: BrowserContext) {
    await context.route('**/*.supabase.co/**', route => this.handle(route, context));
  }

  async setOffline(context: BrowserContext, value: boolean) {
    // Route fulfillment can bypass Chromium's offline emulation, so block the
    // fake cloud explicitly as well as changing the real navigator.onLine flag.
    if (value) this.offline.add(context);
    else this.offline.delete(context);
    await context.setOffline(value);
  }

  holdNextWrite(email = EMAIL): WriteGate {
    let release!: () => void;
    const ready = new Promise<void>(resolve => { release = resolve; });
    const gate = { userId: this.user(email).id, saved: null, ready, release };
    this.gates.push(gate);
    this.allGates.push(gate);
    return gate;
  }

  releaseAll() { for (const gate of this.allGates) gate.release(); }

  private async handle(route: Route, context: BrowserContext) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const headers = request.headers();
    const reply = (body: unknown, status = 200) => route.fulfill({
      status,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': APP_URL,
        'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
        'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, prefer, x-supabase-api-version',
      },
      body: status === 204 ? '' : JSON.stringify(body),
    });
    const reject = (message: string) => {
      this.unexpected.push(`${method} ${url.pathname}: ${message}`);
      return reply({ message }, 400);
    };
    if (url.origin !== SUPABASE_URL) return reject('Only the local fake Supabase host is allowed');
    if (this.offline.has(context)) return route.abort('internetdisconnected');
    if (method === 'OPTIONS') return reply(null, 204);
    if (headers.apikey !== PUBLIC_KEY) return reject('Unexpected public API key');
    const body = request.postData() ? request.postDataJSON() : {};
    const token = headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
    const user = this.accessTokens.get(token);

    if (url.pathname === '/auth/v1/otp' && method === 'POST') {
      if (typeof body.email !== 'string') return reject('OTP requires an email');
      this.sentEmails.push(body.email.trim().toLowerCase());
      return reply({});
    }
    if (url.pathname === '/auth/v1/verify' && method === 'POST') {
      this.verifiedCodes.push(body.token);
      if (body.type !== 'email' || body.token !== '123456' || !this.sentEmails.includes(body.email)) {
        return reply({ code: 'otp_expired', msg: 'Token has expired or is invalid' }, 403);
      }
      return reply(this.session(this.user(body.email)));
    }
    if (url.pathname === '/auth/v1/token' && method === 'POST' && url.searchParams.get('grant_type') === 'refresh_token') {
      const refreshing = this.refreshTokens.get(body.refresh_token);
      return refreshing ? reply(this.session(refreshing)) : reply({ message: 'Invalid refresh token' }, 401);
    }
    if (url.pathname === '/auth/v1/user' && method === 'GET') {
      return user ? reply(user) : reply({ message: 'Invalid token' }, 401);
    }
    if (url.pathname === '/auth/v1/logout' && method === 'POST') {
      if (!user) return reject('Logout without a verified session');
      this.logouts++;
      this.accessTokens.delete(token);
      return reply(null, 204);
    }
    if (url.pathname !== '/rest/v1/benbi_state') return reject('Unimplemented endpoint');
    if (!user) return reject('REST accessed without a verified session');

    // PostgREST maybeSingle uses arrays on GET and object media type on writes.
    const replyRows = (rows: CloudRow[]) => {
      if (!headers.accept?.includes('application/vnd.pgrst.object+json')) return reply(rows);
      return rows.length === 1 ? reply(rows[0]) : reply({
        code: 'PGRST116', details: 'The result contains 0 rows', hint: null,
        message: 'JSON object requested, multiple (or no) rows returned',
      }, 406);
    };
    const requestedUser = method === 'POST' ? body.user_id : url.searchParams.get('user_id')?.replace(/^eq\./, '');
    if (requestedUser !== user.id) return reject('Cross-user REST access');
    const existing = this.rows.get(user.id);
    if (method === 'GET') return replyRows(existing ? [structuredClone(existing)] : []);
    if (method !== 'POST' && method !== 'PATCH') return reject('Unsupported REST mutation');
    this.writeAttempts++;
    if (method === 'POST' && existing) return reply({ code: '23505', message: 'duplicate user_id' }, 409);
    if (method === 'PATCH') {
      if (!url.searchParams.has('revision')) return reject('PATCH must use revision CAS');
      if (!existing || url.searchParams.get('revision') !== `eq.${existing.revision}`) return replyRows([]);
    }
    const saved: CloudRow = {
      user_id: user.id, revision: (existing?.revision ?? 0) + 1, data: structuredClone(body.data),
    };
    this.rows.set(user.id, saved);
    this.writes++;
    const gateIndex = this.gates.findIndex(gate => gate.userId === user.id);
    if (gateIndex !== -1) {
      const [gate] = this.gates.splice(gateIndex, 1);
      gate.saved = structuredClone(saved);
      // Commit first, delay only this response, and return the ORIGINAL version.
      await gate.ready;
    }
    return replyRows([structuredClone(saved)]);
  }
}

const test = base.extend<{ cloud: FakeSupabase }>({
  cloud: async ({}, use) => {
    const cloud = new FakeSupabase();
    try { await use(cloud); }
    finally {
      cloud.releaseAll();
      expect(cloud.unexpected, 'No unmocked or unauthorized Supabase requests').toEqual([]);
    }
  },
  page: async ({ page, context, cloud }, use) => {
    await cloud.install(context);
    await use(page);
  },
});

const taskHeading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true, level: 3 });
// CircularTaskNode: h3 -> title/status wrapper -> card containing its actions.
const taskCard = (page: Page, name: string) => taskHeading(page, name).locator('../..');

async function localCache(page: Page): Promise<LocalCache> {
  return page.evaluate(() => {
    const id = localStorage.getItem('benbi_active_account_v3');
    const raw = localStorage.getItem(`benbi_state_v3_${id}`);
    if (!raw) throw new Error(`Missing persisted cache for ${id}`);
    return JSON.parse(raw);
  });
}

async function openFreshApp(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Bắt đầu trải nghiệm ngay', exact: true }).click();
  // The welcome CTA opens the real quick-add form; dismiss it without seeding data.
  await page.getByRole('heading', { name: 'Thêm Tác Vụ Mới', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
}

async function expectSaved(page: Page) {
  await expect(page.getByTitle('Toàn bộ dữ liệu đã được lưu an toàn', { exact: true })).toBeVisible();
  await expect.poll(async () => {
    const cache = await localCache(page);
    return cache.initialized && !cache.account.isAnonymous && !!cache.account.lastSyncedAtMs &&
      !!cache.acknowledged && [cache.snapshot.tasks, cache.snapshot.sessions, cache.snapshot.logs]
        .every(records => records.every(record => record.sync_status === 0));
  }).toBe(true);
}

async function requestOtp(page: Page, email = EMAIL) {
  await page.getByTitle(ACCOUNT_BUTTON, { exact: true }).click();
  await page.getByLabel('Địa chỉ email của bạn', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Gửi mã OTP', exact: true }).click();
  await expect(page.getByLabel('Mã OTP gồm 6 chữ số', { exact: true })).toBeVisible();
}

async function verifyOtp(page: Page, email = EMAIL) {
  await page.getByLabel('Mã OTP gồm 6 chữ số', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Xác thực & Đăng nhập', exact: true }).click();
  await expect(page.getByLabel('Mã OTP gồm 6 chữ số', { exact: true })).toHaveCount(0);
  await expect(page.getByTitle(ACCOUNT_BUTTON, { exact: true })).toHaveText(email.split('@')[0]);
  await expectSaved(page);
}

async function login(page: Page, email = EMAIL) {
  await requestOtp(page, email);
  await verifyOtp(page, email);
}

async function createTask(page: Page, name: string) {
  await page.getByRole('banner').getByRole('button', { name: 'Thêm tác vụ', exact: true }).click();
  await page.getByPlaceholder(TASK_NAME, { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Tạo tác vụ', exact: true }).click();
  await expect(taskHeading(page, name)).toBeVisible();
}

async function renameTask(page: Page, before: string, after: string) {
  await taskCard(page, before).getByTitle('Chỉnh sửa thông tin tác vụ', { exact: true }).click();
  await page.getByPlaceholder(TASK_NAME, { exact: true }).fill(after);
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(taskHeading(page, after)).toBeVisible();
  await expect(taskHeading(page, before)).toHaveCount(0);
}

async function deleteTask(page: Page, name: string) {
  await taskCard(page, name).getByTitle('Xem báo cáo 3 tầng, ma trận chuỗi & tạo thẻ vinh danh', { exact: true }).click();
  await page.getByRole('button', { name: 'Xóa tác vụ này vĩnh viễn', exact: true }).click();
  await page.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click();
  await expect(taskHeading(page, name)).toHaveCount(0);
}

test('fresh guest starts at Day 0 with no history or cloud writes', async ({ page, cloud }) => {
  await openFreshApp(page);
  await expect(page.getByRole('button', { name: 'Sao lưu / Cloud', exact: true })).toBeVisible();
  await expect(page.getByText('Đang duy trì 0 chuỗi', { exact: true })).toBeVisible();
  const cache = await localCache(page);
  expect(cache.account).toMatchObject({ id: 'guest', isAnonymous: true, email: null });
  expect(cache.snapshot.tasks).toHaveLength(5);
  for (const task of cache.snapshot.tasks) {
    await expect(taskHeading(page, task.name)).toBeVisible();
    expect(task).toMatchObject({ currentStreak: 0, bestStreak: 0, shields: 0, accumulatedMs: 0, status: 'idle' });
  }
  expect(cache.snapshot.sessions).toEqual([]);
  expect(cache.snapshot.logs).toEqual([]);
  expect(cache.snapshot.tombstones).toEqual([]);
  await page.reload();
  expect((await localCache(page)).snapshot).toEqual(cache.snapshot);
  expect(cloud.sentEmails).toEqual([]);
  expect(cloud.rows.size).toBe(0);
  expect(cloud.writeAttempts).toBe(0);
});

test('OTP rejects invalid input and code, disables resend, then verifies six digits', async ({ page, cloud }) => {
  await openFreshApp(page);
  await page.getByTitle(ACCOUNT_BUTTON, { exact: true }).click();
  const emailInput = page.getByLabel('Địa chỉ email của bạn', { exact: true });
  await emailInput.fill('not-an-email');
  await page.getByRole('button', { name: 'Gửi mã OTP', exact: true }).click();
  expect(await emailInput.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  expect(cloud.sentEmails).toEqual([]);
  await emailInput.fill('  ALICE@example.test  ');
  await page.getByRole('button', { name: 'Gửi mã OTP', exact: true }).click();
  const otp = page.getByLabel('Mã OTP gồm 6 chữ số', { exact: true });
  const verify = page.getByRole('button', { name: 'Xác thực & Đăng nhập', exact: true });
  await expect(page.getByRole('button', { name: /^Gửi lại mã sau \d+s$/ })).toBeDisabled();
  await otp.fill('12a');
  await expect(otp).toHaveValue('12');
  await expect(verify).toBeDisabled();
  await otp.fill('654321');
  await verify.click();
  await expect(page.getByRole('alert')).toContainText('Mã không đúng hoặc đã hết hạn');
  expect((await localCache(page)).account.isAnonymous).toBe(true);
  expect(cloud.rows.size).toBe(0);
  expect(cloud.writeAttempts).toBe(0);
  await expect(page.getByRole('button', { name: /^Gửi lại mã sau \d+s$/ })).toBeDisabled();
  expect(cloud.sentEmails).toEqual([EMAIL]);
  await verifyOtp(page);
  expect(cloud.verifiedCodes).toEqual(['654321', '123456']);
  expect((await localCache(page)).account).toMatchObject({ id: cloud.user(EMAIL).id, email: EMAIL, provider: 'supabase' });
  expect(cloud.row()?.revision).toBe(1);
});

test('UI-created tasks sync; cloud wins on a second device without starter resurrection or write loops', async ({ page, browser, cloud }) => {
  await openFreshApp(page);
  await login(page);
  await createTask(page, 'Cloud-only planning');
  await renameTask(page, READING, 'Cloud reading schedule');
  await deleteTask(page, MEDITATION);
  await expectSaved(page);
  const remoteNames = cloud.row()!.data.tasks.map(task => task.name).sort();
  expect(remoteNames).toContain('Cloud-only planning');
  expect(remoteNames).not.toContain(MEDITATION);
  const writes = cloud.writes;
  const attempts = cloud.writeAttempts;
  const second = await browser.newContext({ baseURL: APP_URL, serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  try {
    await cloud.install(second);
    const other = await second.newPage();
    await openFreshApp(other);
    await expect(taskHeading(other, MEDITATION)).toBeVisible();
    await createTask(other, 'Guest-only draft');
    expect((await localCache(other)).account.id).toBe('guest');
    await login(other);
    for (const name of remoteNames) await expect(taskHeading(other, name)).toBeVisible();
    for (const name of [READING, MEDITATION, 'Guest-only draft']) await expect(taskHeading(other, name)).toHaveCount(0);
    expect((await localCache(other)).snapshot.tasks.map(task => task.name).sort()).toEqual(remoteNames);
    await other.reload();
    await expectSaved(other);
    await expect(taskHeading(other, MEDITATION)).toHaveCount(0);
    // Exercise an explicit no-op sync as well as automatic acknowledgments.
    await other.getByTitle(ACCOUNT_BUTTON, { exact: true }).click();
    await other.getByRole('button', { name: 'Lưu lên Đám mây', exact: true }).click();
    await expect(other.getByRole('button', { name: 'Lưu lên Đám mây', exact: true })).toBeEnabled();
    // Intentional negative-observation window: >3 debounce periods (700 ms)
    // and the first error retry (2 s). Not an arbitrary UI readiness sleep.
    await other.waitForTimeout(2500);
    expect(cloud.writes).toBe(writes);
    expect(cloud.writeAttempts).toBe(attempts);
  } finally { await second.close(); }
});

test('same-origin tabs propagate account-scoped offline edits and deletes through storage', async ({ page, context, cloud }) => {
  await openFreshApp(page);
  await login(page);
  await createTask(page, 'Shared tab task');
  await expectSaved(page);
  const id = (await localCache(page)).snapshot.tasks.find(task => task.name === 'Shared tab task')!.id;
  const guestBefore = await page.evaluate(() => localStorage.getItem('benbi_state_v3_guest'));
  const tab = await context.newPage();
  try {
    await tab.goto('/');
    await expectSaved(tab);
    await expect(taskHeading(tab, 'Shared tab task')).toBeVisible();
    const writes = cloud.writes;
    await cloud.setOffline(context, true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await renameTask(page, 'Shared tab task', 'Edit from first tab');
    await expect(taskHeading(tab, 'Edit from first tab')).toBeVisible();
    await renameTask(tab, 'Edit from first tab', 'Edit from second tab');
    await expect(taskHeading(page, 'Edit from second tab')).toBeVisible();
    await deleteTask(tab, 'Edit from second tab');
    await expect(taskHeading(page, 'Edit from second tab')).toHaveCount(0);
    for (const current of [page, tab]) {
      const cache = await localCache(current);
      expect(cache.account.id).toBe(cloud.user(EMAIL).id);
      expect(cache.snapshot.tombstones).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'tasks', id })]));
      expect(await current.evaluate(() => localStorage.getItem('benbi_state_v3_guest'))).toBe(guestBefore);
    }
    expect(cloud.writes).toBe(writes);
    expect(cloud.row()!.data.tasks.find(task => task.id === id)?.name).toBe('Shared tab task');
    await cloud.setOffline(context, false);
    await expectSaved(page);
    await expectSaved(tab);
    expect(cloud.row()!.data.tasks.some(task => task.id === id)).toBe(false);
    expect(cloud.row()!.data.tombstones).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'tasks', id })]));
  } finally {
    await cloud.setOffline(context, false);
    await tab.close();
  }
});

test('offline deletion survives reload as a tombstone and reconnect never resurrects it', async ({ page, context, cloud }) => {
  // Service workers remain blocked. Only the local Vite shell/assets are served
  // by the runner during offline reload; Supabase stays disconnected and the
  // browser's navigator.onLine remains false. This tests data recovery, not PWA caching.
  await context.route(`${APP_URL}/**`, async route => {
    await route.fulfill({ response: await route.fetch() });
  });
  await openFreshApp(page);
  await login(page);
  await createTask(page, 'Delete while disconnected');
  await expectSaved(page);
  const id = (await localCache(page)).snapshot.tasks.find(task => task.name === 'Delete while disconnected')!.id;
  const writes = cloud.writes;
  try {
    await cloud.setOffline(context, true);
    await expect(page.getByText(/^Offline \(/)).toBeVisible();
    await deleteTask(page, 'Delete while disconnected');
    const tombstone = (await localCache(page)).snapshot.tombstones.find(item => item.kind === 'tasks' && item.id === id);
    expect(tombstone).toBeDefined();
    expect(cloud.row()!.data.tasks.some(task => task.id === id)).toBe(true);
    await page.reload();
    await expect(page.getByText(/^Offline \(/)).toBeVisible();
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    await expect(taskHeading(page, 'Delete while disconnected')).toHaveCount(0);
    expect((await localCache(page)).snapshot.tombstones).toContainEqual(tombstone);
    expect(cloud.writes).toBe(writes);
    await cloud.setOffline(context, false);
    await expectSaved(page);
    expect(cloud.row()!.data.tasks.some(task => task.id === id)).toBe(false);
    expect(cloud.row()!.data.tombstones).toContainEqual(tombstone);
    await page.reload();
    await expectSaved(page);
    await expect(taskHeading(page, 'Delete while disconnected')).toHaveCount(0);
    expect((await localCache(page)).snapshot.tombstones).toContainEqual(tombstone);
  } finally { await cloud.setOffline(context, false); }
});

test('a delayed server acknowledgment preserves a newer local edit and its dirty flag', async ({ page, cloud }) => {
  await openFreshApp(page);
  await login(page);
  await createTask(page, 'Original task');
  await expectSaved(page);
  const id = (await localCache(page)).snapshot.tasks.find(task => task.name === 'Original task')!.id;
  const firstAck = cloud.holdNextWrite();
  try {
    await renameTask(page, 'Original task', 'Server saw edit one');
    await expect.poll(() => firstAck.saved?.data.tasks.find(task => task.id === id)?.name).toBe('Server saw edit one');
    await renameTask(page, 'Server saw edit one', 'Newer local edit two');
    const newer = (await localCache(page)).snapshot.tasks.find(task => task.id === id)!;
    expect(newer.sync_status).toBe(1);
    expect(newer.updated_at_ms).toBeGreaterThan(firstAck.saved!.data.tasks.find(task => task.id === id)!.updated_at_ms);
    const secondAck = cloud.holdNextWrite();
    firstAck.release();
    await expect.poll(() => secondAck.saved?.data.tasks.find(task => task.id === id)?.name).toBe('Newer local edit two');
    await expect(taskHeading(page, 'Newer local edit two')).toBeVisible();
    const pending = await localCache(page);
    expect(pending.snapshot.tasks.find(task => task.id === id)).toMatchObject({ name: 'Newer local edit two', sync_status: 1 });
    expect(pending.acknowledged!.tasks.find(task => task.id === id)?.name).toBe('Server saw edit one');
    secondAck.release();
    await expectSaved(page);
    expect(cloud.row()!.data.tasks.find(task => task.id === id)?.name).toBe('Newer local edit two');
    await page.reload();
    await expectSaved(page);
    await expect(taskHeading(page, 'Newer local edit two')).toBeVisible();
  } finally { cloud.releaseAll(); }
});

test('logout clears account data and a different email cannot inherit tasks or settings', async ({ page, cloud }) => {
  await openFreshApp(page);
  await login(page);
  await createTask(page, 'Alice private task');
  await page.getByTitle('Chuyển sang Giao diện Tối (Dịu mắt ban đêm)', { exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expectSaved(page);
  const aliceBefore = structuredClone(cloud.row()!);
  await page.getByTitle(ACCOUNT_BUTTON, { exact: true }).click();
  await page.getByRole('button', { name: 'Đăng xuất tài khoản này', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sao lưu / Cloud', exact: true })).toBeVisible();
  await expect(taskHeading(page, 'Alice private task')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  expect(cloud.logouts).toBe(1);
  expect(await page.evaluate(id => localStorage.getItem(`benbi_state_v3_${id}`), cloud.user(EMAIL).id)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('sb-benbi-test-auth-token'))).toBeNull();
  const guest = await localCache(page);
  expect(guest.account.id).toBe('guest');
  expect(guest.snapshot.tasks.every(task => task.currentStreak === 0 && task.bestStreak === 0)).toBe(true);
  expect(guest.snapshot.sessions).toEqual([]);
  expect(guest.snapshot.logs).toEqual([]);
  // Real reload resets the modal's resend cooldown; no clock or auth storage injection.
  await page.reload();
  const bob = 'bob@example.test';
  await login(page, bob);
  await expect(taskHeading(page, 'Alice private task')).toHaveCount(0);
  expect((await localCache(page)).account.id).toBe(cloud.user(bob).id);
  expect(cloud.user(bob).id).not.toBe(cloud.user(EMAIL).id);
  expect(cloud.row(bob)!.data.settings.darkMode).toBe(false);
  expect(cloud.row(bob)!.data.tasks.some(task => task.name === 'Alice private task')).toBe(false);
  await createTask(page, 'Bob private task');
  await expectSaved(page);
  expect(cloud.row(bob)!.data.tasks.some(task => task.name === 'Bob private task')).toBe(true);
  expect(cloud.row()).toEqual(aliceBefore);
});

test('an expired session keeps local edits and re-verifying the same email uploads them', async ({ page, cloud }) => {
  await openFreshApp(page);
  await login(page);
  await createTask(page, 'Before expiry');
  await expectSaved(page);
  await page.evaluate(() => localStorage.removeItem('sb-benbi-test-auth-token'));
  await page.reload();
  const reauth = page.getByTitle('Phiên đăng nhập đã hết hạn. Bấm để xác thực lại email.', { exact: true });
  await expect(reauth).toBeVisible();
  await expect(taskHeading(page, 'Before expiry')).toBeVisible();
  await createTask(page, 'Edited while expired');
  expect((await localCache(page)).account.id).toBe(cloud.user(EMAIL).id);
  expect(cloud.row()!.data.tasks.some(task => task.name === 'Edited while expired')).toBe(false);
  await reauth.click();
  await expect(page.getByText('Phiên đăng nhập đã hết hạn', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Địa chỉ email của bạn', { exact: true })).toHaveValue(EMAIL);
  await page.getByRole('button', { name: 'Gửi mã OTP', exact: true }).click();
  await verifyOtp(page);
  const names = cloud.row()!.data.tasks.map(task => task.name);
  expect(names).toEqual(expect.arrayContaining(['Before expiry', 'Edited while expired']));
});
