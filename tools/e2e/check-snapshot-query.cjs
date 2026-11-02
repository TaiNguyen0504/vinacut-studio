const assert = require('node:assert/strict');
const { queryPage, ActionFailure } = require('../../electron/engine/actions.cjs');

(async () => {
  const rows = [];
  for (const call of ['entitySnapshot()', 'selectedEntities()']) {
    const win = { webContents: { executeJavaScript: async () => ({ __error: `${call}: id trùng 53C` }) } };
    await assert.rejects(queryPage(win, call), (error) => error instanceof ActionFailure && /53C/.test(error.message));
    rows.push({ call, duplicate: 'EXPECTED FAIL' });
    win.webContents.executeJavaScript = async () => [{ id: '53C' }, { id: '53D' }];
    assert.equal((await queryPage(win, call)).length, 2);
  }
  console.log(JSON.stringify({ passed: true, rows }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
