import assert from 'node:assert/strict';
import test from 'node:test';
import { preferencePage, tokenFrom } from './emailPreferences.js';

const token = '123e4567-e89b-42d3-a456-426614174000';

test('unsubscribe confirmation page uses POST and does not unsubscribe on GET', () => {
  const page = preferencePage({ token });
  assert.match(page, /method="post"/);
  assert.match(page, new RegExp(token));
  assert.match(page, /Unsubscribe me/);
});

test('confirmed unsubscribe page has no submission button', () => {
  const page = preferencePage({ state: 'confirmed' });
  assert.match(page, /You’re unsubscribed/);
  assert.doesNotMatch(page, /<form/);
});

test('unsubscribe route accepts only UUID tokens', () => {
  assert.equal(tokenFrom({ query: { token }, body: {} }), token);
  assert.equal(tokenFrom({ query: { token: '<script>' }, body: {} }), null);
});

