import { Hono } from 'https://deno.land/x/hono@v4.3.11/mod.ts';
import { HTTPException } from 'https://deno.land/x/hono@v4.3.11/http-exception.ts';

const app = new Hono();
const kv = await Deno.openKv();

// Разрешаем оба варианта написания токена (с нулем и с буквой 'o'), плюс токен 42
function checkToken(token: string | null): boolean {
  if (!token) return false;
  const clean = token.trim();
  return (
    clean === "2701_8dc46d:0afefe" ||
    clean === "2701_8dc46d:oafefe" ||
    clean === "42"
  );
}

// Middleware: проверяет токен и в query param, и в Bearer header
app.use('/kv/*', async (c, next) => {
  let token = c.req.query('token');
  if (!token) {
    const auth = c.req.header('Authorization');
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      token = auth.slice(7).trim();
    }
  }

  if (!checkToken(token)) {
    throw new HTTPException(401, { message: 'Missing or invalid token' });
  }

  await next();
});

// Step 1: /dump
app.get('/kv/list/*', async (c) => {
  const parts = c.req.path.split('/').slice(3).filter(Boolean);
  const iter = kv.list({ prefix: parts });
  const records = [];
  for await (const res of iter) {
    records.push(res);
  }
  
  return new Response(JSON.stringify(records), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
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

// Step 2 & CRUD: точные маршруты из csev/deno-kv-admin
app.get('/kv/list/*', async (c) => {
  const parts = c.req.path.split('/').slice(3).filter(Boolean);
  const iter = kv.list({ prefix: parts });
  const records = [];
  for await (const res of iter) {
    records.push(res);
  }
  return c.json(records, 200);
});

app.get('/kv/get/*', async (c) => {
  const parts = c.req.path.split('/').slice(3).filter(Boolean);
  const res = await kv.get(parts);
  return c.json(res, 200);
});

app.post('/kv/set/*', async (c) => {
  const parts = c.req.path.split('/').slice(3).filter(Boolean);
  const body = await c.req.json();
  const res = await kv.set(parts, body);
  return c.json(res, 200);
});

app.delete('/kv/delete/*', async (c) => {
  const parts = c.req.path.split('/').slice(3).filter(Boolean);
  await kv.delete(parts);
  return c.json({ ok: true }, 200);
});

// Step 3: Tsugi требует строго text/plain при ошибке авторизации
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.text(err.message, err.status);
  }
  return c.text('Internal Server Error', 500);
});

Deno.serve(app.fetch);
