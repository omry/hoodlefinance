const fs = require("fs");
const http = require("http");
const https = require("https");
const { workerData } = require("worker_threads");

function fetchText(url) {
  const parsedUrl = new URL(url);
  const transport = parsedUrl.protocol === "http:" ? http : https;

  return new Promise(function (resolve, reject) {
    const request = transport.request(
      {
        headers: {
          "Accept-Encoding": "identity",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "Mozilla/5.0",
        },
        hostname: parsedUrl.hostname,
        method: "GET",
        path: parsedUrl.pathname + parsedUrl.search,
        port: parsedUrl.port || undefined,
        protocol: parsedUrl.protocol,
      },
      function (response) {
        const chunks = [];

        response.on("data", function (chunk) {
          chunks.push(chunk);
        });

        response.on("end", function () {
          const body = Buffer.concat(chunks).toString("utf8");

          if (
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers &&
            response.headers.location
          ) {
            resolve(fetchText(new URL(response.headers.location, parsedUrl).toString()));
            return;
          }

          resolve({
            body: body,
            statusCode: response.statusCode || 0,
          });
        });
      }
    );

    request.on("error", reject);
    request.end();
  });
}

(async function main() {
  const state = new Int32Array(workerData.signal);

  try {
    const result = await fetchText(workerData.url);
    fs.writeFileSync(workerData.outputPath, JSON.stringify({ ok: true, result: result }), "utf8");
  } catch (error) {
    fs.writeFileSync(
      workerData.outputPath,
      JSON.stringify({ error: error && error.message ? error.message : String(error), ok: false }),
      "utf8"
    );
  } finally {
    Atomics.store(state, 0, 1);
    Atomics.notify(state, 0, 1);
  }
})();
