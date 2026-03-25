"use strict";

const http = require("node:http");
const crypto = require("node:crypto");

async function ensureAccessTokenWithDeps(deps) {
  const readJson = deps.readJsonSync;
  const readOptionalJson = deps.readOptionalJsonSync;
  const nonInteractive = deps.nonInteractive === true;
  const refreshToken = deps.refreshAccessToken || function (client, token) {
    return refreshAccessToken(client, token, deps);
  };
  const authorize = deps.authorizeInteractively || function (client) {
    return authorizeInteractively(client, deps);
  };
  const clientConfig = readJson(deps.oauthClientPath, "OAuth client config");
  const client = normalizeOAuthClient(clientConfig);
  const existingToken = readOptionalJson(deps.oauthTokenPath);

  if (existingToken && !tokenExpired(existingToken)) {
    return existingToken.access_token;
  }

  if (existingToken && existingToken.refresh_token) {
    try {
      return (await refreshToken(client, existingToken)).access_token;
    } catch (error) {
      if (!isInvalidGrantOAuthError(error)) {
        throw error;
      }

      if (nonInteractive) {
        throw new Error(
          "Demo-sheet OAuth token is invalid in non-interactive mode. Update the stored demo-sheet OAuth token secret and retry."
        );
      }

      process.stdout.write(
        "Saved demo-sheet OAuth token is no longer valid. Starting interactive reauthorization.\n"
      );
    }
  }

  return (await authorize(client)).access_token;
}

async function refreshAccessToken(client, token, deps) {
  const refreshed = await exchangeToken("refresh_token", {
    client_id: client.clientId,
    client_secret: client.clientSecret,
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
  });

  refreshed.refresh_token = refreshed.refresh_token || token.refresh_token;
  await deps.saveJson(deps.oauthTokenPath, refreshed);
  return refreshed;
}

function isInvalidGrantOAuthError(error) {
  return Boolean(error && error.oauthError === "invalid_grant");
}

async function authorizeInteractively(client, deps) {
  const state = crypto.randomBytes(16).toString("hex");
  const server = http.createServer();
  const codePromise = new Promise(function (resolve, reject) {
    const timeout = setTimeout(function () {
      reject(new Error("Timed out waiting for OAuth callback."));
    }, 5 * 60 * 1000);

    server.on("request", function (request, response) {
      const url = new URL(request.url, "http://localhost");
      const returnedState = url.searchParams.get("state") || "";
      const code = url.searchParams.get("code") || "";
      const error = url.searchParams.get("error") || "";

      if (error) {
        clearTimeout(timeout);
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Authorization failed: " + error + "\n");
        reject(new Error("OAuth authorization failed: " + error));
        return;
      }

      if (returnedState !== state || !code) {
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Invalid OAuth callback.\n");
        return;
      }

      clearTimeout(timeout);
      response.writeHead(200, { 
        "Content-Type": "text/plain; charset=utf-8",
        "Connection": "close"
      });
      response.end("Authorization received. You can close this tab.\n");
      resolve(code);
    });
  });

  await new Promise(function (resolve) {
    server.listen(0, "localhost", resolve);
  });

  try {
    const port = server.address().port;
    const redirectUri = "http://localhost:" + port + "/oauth2callback";
    const authUrl =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        access_type: "offline",
        client_id: client.clientId,
        prompt: "consent",
        redirect_uri: redirectUri,
        response_type: "code",
        scope: deps.scopes.join(" "),
        state: state,
      }).toString();

    process.stdout.write(
      "Open this URL in a browser to authorize demo-sheet automation:\n" + authUrl + "\n\n"
    );

    const code = await codePromise;
    const token = await exchangeToken("authorization_code", {
      client_id: client.clientId,
      client_secret: client.clientSecret,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    await deps.saveJson(deps.oauthTokenPath, token);
    return token;
  } finally {
    if (server.closeAllConnections) {
      server.closeAllConnections();
    }
    await new Promise(function (resolve) {
      server.close(resolve);
    });
  }
}

async function exchangeToken(label, params) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams(params),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const payload = await response.json();

  if (!response.ok) {
    const authError = new Error(
      "OAuth token exchange failed for " +
        label +
        ": " +
        JSON.stringify(payload && payload.error ? payload : { error: response.statusText })
    );
    authError.oauthError = payload && payload.error ? payload.error : "";
    authError.oauthPayload = payload;
    throw authError;
  }

  payload.expiry_date = Date.now() + Number(payload.expires_in || 0) * 1000;
  return payload;
}

async function googleApiJson(accessToken, method, url, body) {
  const headers = {
    Accept: "application/json",
    Authorization: "Bearer " + accessToken,
  };
  const request = {
    headers: headers,
    method: method,
  };
  let response;
  let text;

  if (body != null) {
    headers["Content-Type"] = "application/json; charset=utf-8";
    request.body = JSON.stringify(body);
  }

  response = await fetch(url, request);
  text = await response.text();

  if (!response.ok) {
    throw new Error("Google API request failed (" + response.status + " " + response.statusText + "): " + text);
  }

  return text ? JSON.parse(text) : {};
}

function normalizeOAuthClient(rawConfig) {
  const client = rawConfig && (rawConfig.installed || rawConfig.web || rawConfig);

  if (!client || !client.client_id) {
    throw new Error("OAuth client JSON must contain an installed or web client with client_id.");
  }

  return {
    clientId: client.client_id,
    clientSecret: client.client_secret || "",
  };
}

function tokenExpired(token) {
  const expiry = Number(token && token.expiry_date ? token.expiry_date : 0);
  return !token || !token.access_token || (expiry && expiry <= Date.now() + 60 * 1000);
}

module.exports = {
  ensureAccessTokenWithDeps,
  googleApiJson,
  isInvalidGrantOAuthError,
};
