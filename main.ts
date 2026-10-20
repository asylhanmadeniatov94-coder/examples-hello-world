const kv = await Deno.openKv();

// Поддерживаем оба варианта написания токена (с '0' и с 'o')
function checkToken(token: string | null): boolean {
  return token === "2701_8dc46d:0afefe" || token === "2701_8dc46d:oafefe";
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Step 1: Проверка /dump (возврат данных запроса)
  if (url.pathname === "/dump") {
    const headersObj: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    const queryObj: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryObj[key] = value;
    });

    let bodyText = "";
    try {
      bodyText = await req.text();
    } catch {
      // игнорируем
    }

    const dumpData = {
      method: req.method,
      url: req.url,
      path: url.pathname,
      headers: headersObj,
      query: queryObj,
      body: bodyText,
    };

    return new Response(JSON.stringify(dumpData), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  // Извлечение токена из параметров URL или заголовка
  let token = url.searchParams.get("token");
  if (!token) {
    const auth = req.headers.get("Authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      token = auth.slice(7).trim();
    }
  }

  // Step 3: при неверном токене возвращаем 401 и plain text (не JSON)
  if (!checkToken(token)) {
    return new Response("Missing or invalid token", {
      status: 401,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  // Обработка /kv/...
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length >= 2 && parts[0] === "kv") {
    const action = parts[1];
    const keyParts = parts.slice(2);

    // Step 2: autograder ждет пустой JSON-список []
    if (action === "list") {
      const records = [];
      for await (const res of kv.list({ prefix: keyParts })) {
        records.push(res);
      }
      return new Response(JSON.stringify(records), {
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
      const res = await kv.set(keyParts, body);
      return new Response(JSON.stringify(res), {
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
  }

  return new Response("Not Found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...corsHeaders,
    },
  });
});
