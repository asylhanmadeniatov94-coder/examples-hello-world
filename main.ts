const kv = await Deno.openKv();

function checkToken(token: string | null): boolean {
  return token === "2701_8dc46d:0afefe" || token === "2701_8dc46d:oafefe";
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  const corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. Проверка /dump (Step 1)
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

    return new Response(JSON.stringify(dumpData), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  // 2. Токен
  let token = url.searchParams.get("token");
  if (!token) {
    const auth = req.headers.get("Authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      token = auth.slice(7).trim();
    }
  }

  // Step 3: при неверном токене возвращаем 401 и plain-text
  if (!checkToken(token)) {
    return new Response("Missing or invalid token", {
      status: 401,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  // 3. Маршруты /kv/...
  const pathname = url.pathname;
  if (pathname.startsWith("/kv/")) {
    const pathParts = pathname.slice(4).split("/").filter(Boolean);
    const action = pathParts[0];
    const keyParts = pathParts.slice(1).map((p) => decodeURIComponent(p));

    if (action === "list") {
      const records = [];
      for await (const res of kv.list({ prefix: keyParts })) {
        records.push(res);
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
      const res = await kv.get(keyParts);
      return new Response(JSON.stringify(res), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      });
    }

    if (action === "set") {
      let body: any = null;
      try {
        body = await req.json();
      } catch {
        body = null;
      }
      const res = await kv.set(keyParts, body);
      return new Response(JSON.stringify(res), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      });
    }

    if (action === "delete") {
      await kv.delete(keyParts);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      });
    }

    if (action === "delete_prefix") {
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

  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
});
