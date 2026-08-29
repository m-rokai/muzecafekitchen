import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'auth-middleware-test-secret-that-is-long-enough';

const { requireAdmin } = await import('./auth.js');

function invoke(req) {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let advanced = false;
  requireAdmin(req, response, () => { advanced = true; });
  return { response, advanced };
}

test('requireAdmin allows admins and rejects staff roles', () => {
  const admin = invoke({ auth: { role: 'admin' } });
  assert.equal(admin.advanced, true);

  const staff = invoke({ auth: { role: 'staff' } });
  assert.equal(staff.advanced, false);
  assert.equal(staff.response.statusCode, 403);
  assert.equal(staff.response.body.code, 'ADMIN_ROLE_REQUIRED');
});
