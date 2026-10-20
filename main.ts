const kv = await Deno.openKv();

function checkToken(token: string | null): boolean {
  return token === "2701_8dc46d:0afefe" || token === "2701_8dc46d:oafefe";
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // CORS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Step 1: /dump
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
      // ignore
    }

    const dumpData = {
      method: req.method,
      url: req.url,
      path: url.pathname,
      headers: headersObj,
      query: queryObj,
      body: bodyText,
    };

    return new Response(JSON.stringify(dumpData, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  // Token retrieval
  let token = url.searchParams.get("token");
  if (!token) {
    const auth = req.headers.get("Authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      token = auth.slice(7).trim();
    }
  }

  // Step 3: Неверный токен должен возвращать 401 и не-JSON строку
  if (!checkToken(token)) {
    return new Response("Missing or invalid token", {
      status: 401,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  // Обработка /kv/...
  const pathname = url.pathname;
  if (pathname.startsWith("/kv/")) {
    const parts = pathname.slice(4).split("/").filter(Boolean);
    const action = parts[0];
    const keyParts = parts.slice(1);

    // Step 2: list возвращает массив объектов
    if (action === "list") {
      const records = [];
      for await (const entry of kv.list({ prefix: keyParts })) {
        records.push({
          key: entry.key,
          value: entry.value,
          versionstamp: entry.versionstamp,
        });
      }
      return new Response(JSON.stringify(records), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      });
    }

    if (action === "get") {
      const entry = await kv.get(keyParts);
      return new Response(JSON.stringify(entry), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
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
          "content-type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      });
    }

    if (action === "delete" && (req.method === "DELETE" || req.method === "POST")) {
      await kv.delete(keyParts);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
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
          "content-type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      });
    }
  }

  return new Response("Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...corsHeaders,
    },
  });
});
