import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { contentTypeFor, createStaticHandler } from '../src/static.js';

test('the bundled guide is served as a PDF, not the SPA fallback or an unknown binary', async (t) => {
  const assetUrl = new URL('../../../app/src/assets/DataHub-App-Guide.pdf', import.meta.url);
  const asset = await fs.readFile(assetUrl);
  const root = new URL('../../../app/src/', import.meta.url);
  const serve = createStaticHandler(fileURLToPath(root));
  const server = http.createServer(async (req, res) => {
    if (!await serve(req, res, new URL(req.url, 'http://localhost').pathname)) {
      res.writeHead(404);
      res.end();
    }
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/assets/DataHub-App-Guide.pdf`;
  assert.equal(contentTypeFor('guide.PDF'), 'application/pdf');
  for (const method of ['GET', 'HEAD']) {
    const response = await fetch(url, { method, headers: { Accept: 'text/html,application/pdf', 'Accept-Encoding': 'br,gzip' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(response.headers.get('content-encoding'), null);
    const body = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(body, method === 'HEAD' ? Buffer.alloc(0) : asset);
  }
});
