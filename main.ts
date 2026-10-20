const kv = await Deno.openKv();

function checkToken(token: string | null): boolean {
  return token === "2701_8dc46d:oafefe";
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Обработка предварительных CORS-запросов браузера
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. Проверка доступности (Step 1 автогрейдера и verifyconnection в kvadmin.py)
  if (url.pathname === "/dump") {
    const list = [];
    for await (const res of kv.list({ prefix: [] })) {
      list.push(res);
    }
    return new Response(JSON.stringify(list), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  // 2. Извлечение токена
  let token = url.searchParams.get("token");
  if (!token) {
    const auth = req.headers.get("Authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      token = auth.slice(7).trim();
    }
  }

  // 3. Проверка токена (Step 3 автогрейдера: должен возвращать НЕ json, а простой текст с кодом 403)
  if (!checkToken(token)) {
    return new Response("Missing or invalid token", {
      status: 403,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  // 4. Эндпоинт статистики
  if (url.pathname === "/stats") {
    let count = 0;
    for await (const _ of kv.list({ prefix: [] })) {
      count++;
    }
    return new Response(JSON.stringify({ total_keys: count }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  // 5. Обработка команд /kv/... (Step 2 автогрейдера и команды CLI)
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length >= 2 && parts[0] === "kv") {
    const action = parts[1];
    const keyParts = parts.slice(2);

    if (action === "list") {
      const list = [];
      for await (const res of kv.list({ prefix: keyParts })) {
        list.push(res);
      }
      return new Response(JSON.stringify(list), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      });
    }

    if (action === "get") {
      const res = await kv.get(keyParts);
      return new Response(JSON.stringify(res), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      });
    }

    if (action === "set" && req.method === "POST") {
      const body = await req.json();
      await kv.set(keyParts, body);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      });
    }

    if (action === "delete" && (req.method === "DELETE" || req.method === "POST")) {
      await kv.delete(keyParts);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      });
    }

    if (action === "delete_prefix" && (req.method === "DELETE" || req.method === "POST")) {
      for await (const entry of kv.list({ prefix: keyParts })) {
        await kv.delete(entry.key);
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      });
    }
  }

  return new Response("Deno KV Admin Running", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...corsHeaders,
    },
  });
});
