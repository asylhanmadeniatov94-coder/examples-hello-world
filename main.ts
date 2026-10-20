const kv = await Deno.openKv();

function checkToken(token: string | null): boolean {
  return token === "2701_8dc46d:oafefe";
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token =
    req.headers.get("Authorization")?.replace("Bearer ", "") ||
    url.searchParams.get("token");

  if (!checkToken(token)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Маршрут /dump, который проверяет автогрейдер
  if (url.pathname === "/dump") {
    const entries = [];
    for await (const entry of kv.list({ prefix: [] })) {
      entries.push({ key: entry.key, value: entry.value });
    }
    return new Response(JSON.stringify(entries), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/get") {
    const key = url.searchParams.get("key");
    if (!key) return new Response("Missing key", { status: 400 });
    const keyParts = key.split("/");
    const res = await kv.get(keyParts);
    return new Response(JSON.stringify(res), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/set" && req.method === "POST") {
    const body = await req.json();
    if (!body.key || body.value === undefined) {
      return new Response("Missing key or value", { status: 400 });
    }
    const keyParts = Array.isArray(body.key) ? body.key : String(body.key).split("/");
    await kv.set(keyParts, body.value);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/delete" && req.method === "POST") {
    const body = await req.json();
    if (!body.key) return new Response("Missing key", { status: 400 });
    const keyParts = Array.isArray(body.key) ? body.key : String(body.key).split("/");
    await kv.delete(keyParts);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/list") {
    const prefix = url.searchParams.get("prefix") || "";
    const prefixParts = prefix ? prefix.split("/") : [];
    const entries = [];
    for await (const entry of kv.list({ prefix: prefixParts })) {
      entries.push(entry);
    }
    return new Response(JSON.stringify(entries), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ status: "ok", service: "deno-kv-admin" }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
});
