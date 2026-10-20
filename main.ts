import { Hono } from 'https://deno.land/x/hono@v4.3.11/mod.ts';
import { cors } from 'https://deno.land/x/hono@v4.3.11/middleware.ts';
import { HTTPException } from 'https://deno.land/x/hono@v4.3.11/http-exception.ts';

const app = new Hono();
const kv = await Deno.openKv();

// Token checking function
function checkToken(token: string | null): boolean {
  return token === "2701_8dc46d:0afefe" || token === "42";
}

// Enable CORS for all routes
app.use('*', cors());

// Middleware for token validation on /kv/* endpoints
app.use('/kv/*', async (c, next) => {
  let token = c.req.query('token');
  if (!token) {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!checkToken(token)) {
    throw new HTTPException(401, { message: 'Missing or invalid token' });
  }

  await next();
});

// Step 1: /dump endpoint
app.get('/dump', async (c) => {
  const headersObj: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    headersObj[key] = value;
  });

  const dump = {
    method: c.req.method,
    url: c.req.url,
    path: c.req.path,
    headers: headersObj,
    query: c.req.query(),
    body: await c.req.text(),
  };

  return c.json(dump, 200);
});

// Helper to extract key parts cleanly
function getKeyParts(path: string, prefixLength: number): string[] {
  const segment = path.slice(prefixLength);
  if (!segment) return [];
  return segment.split('/').filter(Boolean).map(p => decodeURIComponent(p));
}

// Step 2: /kv/list
app.get('/kv/list', async (c) => {
  const iter = kv.list({ prefix: [] });
  const records = [];
  for await (const res of iter) records.push(res);
  return c.json(records, 200);
});

app.get('/kv/list/*', async (c) => {
  const parts = getKeyParts(c.req.path, '/kv/list/'.length);
  const iter = kv.list({ prefix: parts });
  const records = [];
  for await (const res of iter) records.push(res);
  return c.json(records, 200);
});

// /kv/get
app.get('/kv/get/*', async (c) => {
  const parts = getKeyParts(c.req.path, '/kv/get/'.length);
  const res = await kv.get(parts);
  return c.json(res, 200);
});

// /kv/set
app.post('/kv/set/*', async (c) => {
  const parts = getKeyParts(c.req.path, '/kv/set/'.length);
  const body = await c.req.json();
  const res = await kv.set(parts, body);
  return c.json(res, 200);
});

// /kv/delete
app.delete('/kv/delete/*', async (c) => {
  const parts = getKeyParts(c.req.path, '/kv/delete/'.length);
  await kv.delete(parts);
  return c.json({ ok: true }, 200);
});

// Error handling - plain text strictly for 401
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.text(err.message, err.status);
  }
  return c.text('Internal Server Error', 500);
});

Deno.serve(app.fetch);
