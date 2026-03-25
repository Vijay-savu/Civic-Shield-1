const http = require("http");
const https = require("https");

function proxyRequest(req, res, targetBaseUrl) {
  const targetUrl = new URL(req.originalUrl || req.url, targetBaseUrl);
  const transport = targetUrl.protocol === "https:" ? https : http;

  const headers = {
    ...req.headers,
    host: targetUrl.host,
  };

  const requestOptions = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: `${targetUrl.pathname}${targetUrl.search}`,
    method: req.method,
    headers,
  };

  const proxyReq = transport.request(requestOptions, (proxyRes) => {
    res.status(proxyRes.statusCode || 502);

    Object.entries(proxyRes.headers || {}).forEach(([key, value]) => {
      if (typeof value !== "undefined") {
        res.setHeader(key, value);
      }
    });

    proxyRes.pipe(res);
  });

  proxyReq.on("error", (error) => {
    res.status(502).json({
      success: false,
      status: "failed",
      reason: "service_unreachable",
      message: `Gateway could not reach service: ${error.message}`,
    });
  });

  req.pipe(proxyReq);
}

module.exports = { proxyRequest };
