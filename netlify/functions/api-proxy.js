export default async (req) => {
  const url = new URL(req.url);

  // 目标 Worker API
  const target = "https://qiumo-comments.moqiu846.workers.dev" + url.pathname;

  try {
    const res = await fetch(target, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
      },
      body: req.method === "GET" ? null : await req.text(),
    });

    const data = await res.text();

    return new Response(data, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "proxy failed" }),
      { status: 500 }
    );
  }
};