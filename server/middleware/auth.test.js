import test from 'node:test';
import assert from 'node:assert/strict';

const { requireAdmin } = await import('./auth.js');

async function invoke(req) {
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
  await requireAdmin(req, response, () => { advanced = true; });
  return { response, advanced };
}

test('requireAdmin allows admins and rejects staff roles', async () => {
  const admin = await invoke({ auth: { role: 'admin' } });
  assert.equal(admin.advanced, true);

  const staff = await invoke({ auth: { role: 'staff' } });
  assert.equal(staff.advanced, false);
  assert.equal(staff.response.statusCode, 403);
  assert.equal(staff.response.body.code, 'ADMIN_ROLE_REQUIRED');
});
