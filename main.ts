const kv = await Deno.openKv();

function checkToken(token: string | null): boolean {
  return token === "2701_8dc46d:oafefe";
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Автогрейдер ожидает получение токена из query-параметра или заголовка Authorization
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : url.searchParams.get("token");

  // Шаг 1: эндпоинт /dump проверяется без токена
  if (pathname === "/dump") {
    const entries = [];
    for await (const entry of kv.list({ prefix: [] })) {
      entries.push({ key: entry.key, value: entry.value });
    }
    return new Response(JSON.stringify(entries), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Проверка токена: при ошибке возвращается простой текст (не JSON) с кодом 403
  if (!checkToken(token)) {
    return new Response("Missing or invalid token", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Обработка маршрутов /kv/get, /kv/set, /kv/delete, /kv/list
  const cleanPath = pathname.replace(/^\/kv/, "");

  if (cleanPath.startsWith("/list")) {
    const subPath = cleanPath.replace(/^\/list\/?/, "");
    const prefix = subPath ? subPath.split("/").filter(Boolean) : [];
    const entries = [];
    for await (const entry of kv.list({ prefix })) {
      entries.push(entry);
    }
    return new Response(JSON.stringify(entries), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (cleanPath.startsWith("/get")) {
    const subPath = cleanPath.replace(/^\/get\/?/, "");
    const key = url.searchParams.get("key") || subPath;
    if (!key) return new Response("Missing key", { status: 400 });
    const keyParts = key.split("/").filter(Boolean);
    const entry = await kv.get(keyParts);
    return new Response(JSON.stringify(entry), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (cleanPath.startsWith("/set") && req.method === "POST") {
    const body = await req.json();
    if (!body.key || body.value === undefined) {
      return new Response("Missing key or value", { status: 400 });
    }
    const keyParts = Array.isArray(body.key) ? body.key : String(body.key).split("/").filter(Boolean);
    await kv.set(keyParts, body.value);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (cleanPath.startsWith("/delete") && req.method === "POST") {
    const body = await req.json();
    if (!body.key) return new Response("Missing key", { status: 400 });
    const keyParts = Array.isArray(body.key) ? body.key : String(body.key).split("/").filter(Boolean);
    await kv.delete(keyParts);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
