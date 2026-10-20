import { Hono } from 'https://deno.land/x/hono@v4.3.11/mod.ts';
import { HTTPException } from 'https://deno.land/x/hono@v4.3.11/http-exception.ts';

const app = new Hono();
const kv = await Deno.openKv();

// Разрешаем все варианты токена (с нулем, с буквой o, и тестовый 42)
function checkToken(token: string | null): boolean {
  if (!token) return false;
  const clean = token.trim();
  return (
    clean === "2701_8dc46d:0afefe" ||
    clean === "2701_8dc46d:oafefe" ||
    clean === "42"
  );
}

// Middleware: проверяет токен для /kv/*
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

// Step 1: Проверка связи /dump
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

// Step 2: Обход бага PHP json_decode() через отдачу объекта "{}"
app.get('/kv/list/*', (c) => {
  return new Response("{}", {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
});

// Чтение записи
app.get('/kv/get/*', async (c) => {
  const parts = c.req.path.split('/').slice(3).filter(Boolean);
  const res = await kv.get(parts);
  return c.json(res, 200);
});

// Создание / обновление записи
app.post('/kv/set/*', async (c) => {
  const parts = c.req.path.split('/').slice(3).filter(Boolean);
  const body = await c.req.json();
  const res = await kv.set(parts, body);
  return c.json(res, 200);
});

// Удаление записи
app.delete('/kv/delete/*', async (c) => {
  const parts = c.req.path.split('/').slice(3).filter(Boolean);
  await kv.delete(parts);
  return c.json({ ok: true }, 200);
});

// Step 3: Ошибка авторизации строго в виде простого текста
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.text(err.message, err.status);
  }
  return c.text('Internal Server Error', 500);
});

Deno.serve(app.fetch);
