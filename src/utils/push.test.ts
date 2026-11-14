import { test } from 'vitest';
import assert from 'node:assert/strict';
import { toSubscriptionRecord, urlBase64ToUint8Array } from './push';

test('urlBase64ToUint8Array decodes standard and URL-safe base64', () => {
  assert.deepEqual(Array.from(urlBase64ToUint8Array('aGVsbG8')), [104, 101, 108, 108, 111]);
  assert.deepEqual(Array.from(urlBase64ToUint8Array('-_8')), [251, 255]);
});

test('toSubscriptionRecord rejects subscriptions without endpoint or keys', () => {
  assert.equal(toSubscriptionRecord({ endpoint: '', keys: { p256dh: 'p', auth: 'a' } }), null);
  assert.equal(toSubscriptionRecord({ endpoint: 'https://push.example/1', keys: { p256dh: 'p' } }), null);
  assert.equal(toSubscriptionRecord({ endpoint: 'https://push.example/1' }), null);
});

test('toSubscriptionRecord keeps endpoint, keys and time zone', () => {
  assert.deepEqual(
    toSubscriptionRecord(
      { endpoint: 'https://push.example/1', keys: { p256dh: 'p256', auth: 'auth' } },
      'Asia/Ho_Chi_Minh',
    ),
    { endpoint: 'https://push.example/1', p256dh: 'p256', auth: 'auth', timeZone: 'Asia/Ho_Chi_Minh' },
  );
});
