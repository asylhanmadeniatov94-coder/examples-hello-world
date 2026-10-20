import { Hono } from 'https://deno.land/x/hono@v4.3.11/mod.ts';
import { HTTPException } from 'https://deno.land/x/hono@v4.3.11/http-exception.ts';

const app = new Hono();
const kv = await Deno.openKv();

// Insure security - The autograder will have you change this value
function checkToken(token: string | null): boolean {
  return token === "2701_8dc46d:0afefe" || token === "42" || token === "2701_8dc46d:oafefe";
}

// Middleware to check token
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

// Dump endpoint
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

// Set endpoint
app.post('/kv/set/*', async (c) => {
  const parts = c.req.path.split('/').slice(3);
  const body = await c.req.json();
  const res = await kv.set(parts, body);
  return c.json(res, 200);
});

// Get endpoint
app.get('/kv/get/*', async (c) => {
  const parts = c.req.path.split('/').slice(3);
  const res = await kv.get(parts);
  return c.json(res, 200);
});

// List endpoint
app.get('/kv/list/*', async (c) => {
  const parts = c.req.path.split('/').slice(3);
  const iter = await kv.list({ prefix: parts });
  const records = [];
  for await (const res of iter) records.push(res);
  return c.json(records, 200);
});

// Delete endpoint
app.delete('/kv/delete/*', async (c) => {
  const parts = c.req.path.split('/').slice(3);
  await kv.delete(parts);
  return c.json({ ok: true }, 200);
});

// Make sure we return the correct HTTP Status code when we throw an exception
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.text(err.message, err.status);
  }
  return c.text('Internal Server Error', 500);
});

Deno.serve(app.fetch);
