const kv = await Deno.openKv();

function checkToken(token: string | null): boolean {
  return token === "2701_8dc46d:oafefe" || token === "2701_8dc46d:0afefe";
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // 1. Проверка доступности /dump (Step 1)
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
        "access-control-allow-origin": "*",
      },
    });
  }

  // 2. Получение токена
  let token = url.searchParams.get("token");
  if (!token) {
    const auth = req.headers.get("Authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      token = auth.slice(7).trim();
    }
  }

  // 3. Проверка токена (Step 3): если токен не совпадает, отдаем только простой текст
  if (!checkToken(token)) {
    return new Response("Missing or invalid token", {
      status: 401,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "access-control-allow-origin": "*",
      },
    });
  }

  // 4. Обработка всех путей /kv/... (Step 2)
  const pathname = url.pathname;
  if (pathname.startsWith("/kv/")) {
    const parts = pathname.slice(4).split("/").filter(Boolean);
    const action = parts[0];
    const keyParts = parts.slice(1);

    if (action === "list") {
      const records = [];
      for await (const res of kv.list({ prefix: keyParts })) {
        records.push(res);
      }
      return new Response(JSON.stringify(records), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
        },
      });
    }

    if (action === "get") {
      const res = await kv.get(keyParts);
      return new Response(JSON.stringify(res), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
        },
      });
    }

    if (action === "set") {
      const body = await req.json();
      const res = await kv.set(keyParts, body);
      return new Response(JSON.stringify(res), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
        },
      });
    }

    if (action === "delete") {
      await kv.delete(keyParts);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
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
          "access-control-allow-origin": "*",
        },
      });
    }
  }

  // Любой другой запрос с корректным токеном возвращает JSON
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
});
