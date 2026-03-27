const fs = require("fs");
const path = require("path");
const { Worker } = require("worker_threads");

const WORKER_PATH = path.join(__dirname, "urlfetch-worker.js");

function createResponse(result) {
  return {
    getResponseCode() {
      return result.statusCode;
    },
    getContentText() {
      return result.body;
    },
  };
}

function runWorker(url, outputPath, signalBuffer) {
  return new Worker(WORKER_PATH, {
    workerData: {
      outputPath: outputPath,
      signal: signalBuffer,
      url: url,
    },
  });
}

function fetchSync(url) {
  const tempDir = fs.mkdtempSync(path.join("/tmp", "hoodlefinance-urlfetch-"));
  const outputPath = path.join(tempDir, "response.json");
  const signal = new SharedArrayBuffer(4);
  const state = new Int32Array(signal);
  const worker = runWorker(url, outputPath, signal);
  let payload;

  try {
    Atomics.wait(state, 0, 0);
    worker.terminate();
    payload = JSON.parse(fs.readFileSync(outputPath, "utf8"));

    if (!payload.ok) {
      throw new Error(payload.error);
    }

    return createResponse(payload.result);
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
}

function fetchAllSync(requests) {
  const tempDir = fs.mkdtempSync(
    path.join("/tmp", "hoodlefinance-urlfetch-batch-"),
  );
  const workers = [];
  const results = [];
  let i;
  let outputPath;
  let signal;
  let state;
  let payload;

  try {
    for (i = 0; i < requests.length; i += 1) {
      outputPath = path.join(tempDir, i + ".json");
      signal = new SharedArrayBuffer(4);
      state = new Int32Array(signal);
      workers.push({
        outputPath: outputPath,
        signal: signal,
        state: state,
        worker: runWorker(
          typeof requests[i] === "string" ? requests[i] : requests[i].url,
          outputPath,
          signal,
        ),
      });
    }

    for (i = 0; i < workers.length; i += 1) {
      Atomics.wait(workers[i].state, 0, 0);
      workers[i].worker.terminate();
    }

    for (i = 0; i < workers.length; i += 1) {
      payload = JSON.parse(fs.readFileSync(workers[i].outputPath, "utf8"));

      if (!payload.ok) {
        throw new Error(payload.error);
      }

      results.push(createResponse(payload.result));
    }

    return results;
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
}

function createUrlFetchApp() {
  return {
    fetch(url) {
      return fetchSync(url);
    },
    fetchAll(requests) {
      return fetchAllSync(requests);
    },
  };
}

module.exports = {
  createUrlFetchApp,
};
