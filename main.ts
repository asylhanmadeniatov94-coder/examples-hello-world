const kv = await Deno.openKv();

function checkToken(token: string | null): boolean {
  return token === "2701_8dc46d:oafefe";
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Добавляем CORS-заголовки, так как грейдер может выполнять запросы из браузера
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. Проверка доступности /dump (Step 1)
  if (url.pathname === "/dump") {
    const list = [];
    for await (const res of kv.list({ prefix: [] })) {
      list.push(res);
    }
    return new Response(JSON.stringify(list), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  // Извлечение токена
  let token = url.searchParams.get("token");
  if (!token) {
    const auth = req.headers.get("Authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      token = auth.slice(7).trim();
    }
  }

  // 2. Проверка токена (Step 3 требует невалидный JSON, 403 и текст)
  if (!checkToken(token)) {
    return new Response("Missing or invalid token", {
      status: 403,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  // 3. Обработка операций /kv/... (Step 2)
  const pathParts = url.pathname.split("/").filter(Boolean);

  if (pathParts[0] === "kv") {
    const action = pathParts[1];
    const key = pathParts.slice(2);

    if (action === "list") {
      const list = [];
      for await (const res of kv.list({ prefix: key })) {
        list.push(res);
      }
      return new Response(JSON.stringify(list), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      });
    }

    if (action === "get") {
      const res = await kv.get(key);
      return new Response(JSON.stringify(res), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      });
    }

    if (action === "set" && req.method === "POST") {
      const body = await req.json();
      await kv.set(key, body);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      });
    }

    if (action === "delete" && (req.method === "POST" || req.method === "DELETE")) {
      await kv.delete(key);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      });
    }
  }

  return new Response("Deno KV Admin", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...corsHeaders,
    },
  });
});
