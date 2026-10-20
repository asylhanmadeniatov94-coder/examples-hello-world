const kv = await Deno.openKv();

function checkToken(token: string | null): boolean {
  return token === "2701_8dc46d:oafefe";
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Извлечение токена из параметров URL или заголовка
  let token = url.searchParams.get("token");
  if (!token) {
    const auth = req.headers.get("Authorization");
    if (auth && auth.startsWith("Bearer ")) {
      token = auth.substring(7);
    }
  }

  // Маршрут для дампа (используется для проверки доступности)
  if (url.pathname === "/dump") {
    const entries = [];
    for await (const res of kv.list({ prefix: [] })) {
      entries.push(res);
    }
    return new Response(JSON.stringify(entries), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  // Проверка токена
  if (!checkToken(token)) {
    return new Response("Missing or invalid token", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Роутинг для /kv/...
  const parts = url.pathname.split("/").filter(Boolean);

  // parts[0] === 'kv'
  if (parts.length >= 2 && parts[0] === "kv") {
    const action = parts[1]; // list, get, set, delete
    const keyPath = parts.slice(2);

    if (action === "list") {
      const entries = [];
      for await (const res of kv.list({ prefix: keyPath })) {
        entries.push(res);
      }
      return new Response(JSON.stringify(entries), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    if (action === "get") {
      const res = await kv.get(keyPath);
      return new Response(JSON.stringify(res), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    if (action === "set" && req.method === "POST") {
      const body = await req.json();
      await kv.set(keyPath, body);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    if (action === "delete" && (req.method === "POST" || req.method === "DELETE")) {
      await kv.delete(keyPath);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
  }

  return new Response("Deno KV Admin Server Running", {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
});
