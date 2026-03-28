#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  buildPathRows,
  buildStatusRow,
  getPathStatus,
  printBundleFiles,
  printContextBlock,
} = require("../cli-reporting.js");
const { getClaspCommand, getClaspAuth } = require("../clasp-auth.js");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const LOCAL_DIR = path.join(ROOT_DIR, ".addon-deploy.local");
const DEFAULT_LAYOUT_PATH = path.join(
  ROOT_DIR,
  "docs",
  "google-sheets-editor-addon",
  "addon-deploy-layout.json",
);
const DEFAULT_TARGET_NAME = "production";
const GENERATED_DEPLOYMENT_CONFIG_FILENAME = "hoodlefinance.deployment.js";
const VERSION_METADATA_PATH = path.join(ROOT_DIR, "version.properties");

async function main() {
  const rawArgv = process.argv.slice(2);
  assertNoLikelyMissingNpmArgSeparator(rawArgv, process.env, "addon:deploy");
  const options = parseArgs(rawArgv);
  await printCredentialContext(options);
  const result = await deployAddon(options);

  if (options.dryRun) {
    process.stdout.write(
      "Dry run: would sync " +
        result.bundleFiles.length +
        " bundle file" +
        (result.bundleFiles.length === 1 ? "" : "s") +
        " to script " +
        result.scriptId +
        ".\n",
    );
    printBundleFiles(result.bundleFiles);
    if (result.versionDescription) {
      process.stdout.write(
        "Version description: " + result.versionDescription + "\n",
      );
    }
    return;
  }

  process.stdout.write(
    "Pushed add-on sources to script " + result.scriptId + ".\n",
  );
  if (result.versionNumber) {
    process.stdout.write(
      "Created Apps Script version " +
        result.versionNumber +
        (result.versionDescription
          ? " (" + result.versionDescription + ")"
          : "") +
        ".\n",
    );
  }
}

function assertNoLikelyMissingNpmArgSeparator(argv, env, scriptName) {
  const normalizedArgv = Array.isArray(argv) ? argv : [];
  const normalizedEnv = env || process.env;

  if (
    String(normalizedEnv.npm_config_dry_run || "").trim() === "true" &&
    normalizedArgv.indexOf("--dry-run") === -1
  ) {
    throw new Error(
      "It looks like `--dry-run` was passed to `npm run` without the required `--` separator.\n" +
        "Use `npm run " +
        scriptName +
        " -- --dry-run`, `npm run " +
        scriptName +
        " -- --staging --dry-run`, or a dedicated script such as `npm run " +
        scriptName +
        ":production:dry-run`.",
    );
  }
}

function parseArgs(argv) {
  const options = {
    createVersion: true,
    dryRun: false,
    layoutPath: DEFAULT_LAYOUT_PATH,
    target: "",
    targetConfigPath: "",
    versionDescription: "",
  };
  let i;
  let current;

  for (i = 0; i < argv.length; i += 1) {
    current = argv[i];

    if (current === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (current === "--push-only") {
      options.createVersion = false;
      continue;
    }

    if (current === "--production") {
      if (options.target && options.target !== "production") {
        throw new Error(
          "Choose exactly one add-on target: --staging or --production.",
        );
      }
      options.target = "production";
      continue;
    }

    if (current === "--staging") {
      if (options.target && options.target !== "staging") {
        throw new Error(
          "Choose exactly one add-on target: --staging or --production.",
        );
      }
      options.target = "staging";
      continue;
    }

    if (current === "--target-config") {
      i += 1;
      if (i >= argv.length) {
        throw new Error(
          "Usage: node tools/addon/deploy.js [--dry-run] [--push-only] [--production|--staging] [--target-config <path>] [--layout <path>] [--version-description <text>]",
        );
      }
      options.targetConfigPath = path.resolve(ROOT_DIR, argv[i]);
      continue;
    }

    if (current === "--layout") {
      i += 1;
      if (i >= argv.length) {
        throw new Error(
          "Usage: node tools/addon/deploy.js [--dry-run] [--push-only] [--production|--staging] [--target-config <path>] [--layout <path>] [--version-description <text>]",
        );
      }
      options.layoutPath = path.resolve(ROOT_DIR, argv[i]);
      continue;
    }

    if (current === "--version-description") {
      i += 1;
      if (i >= argv.length) {
        throw new Error(
          "Usage: node tools/addon/deploy.js [--dry-run] [--push-only] [--production|--staging] [--target-config <path>] [--layout <path>] [--version-description <text>]",
        );
      }
      options.versionDescription = argv[i];
      continue;
    }

    throw new Error("Unknown argument: " + current);
  }

  if (!options.target) {
    throw new Error("Choose an add-on target: --staging or --production.");
  }

  return options;
}

function readJsonSync(filePath, label) {
  let text;

  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(
      "Failed to read " +
        label +
        " at " +
        filePath +
        ".\n" +
        String(error && error.message ? error.message : error),
    );
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      "Failed to parse " +
        label +
        " at " +
        filePath +
        ".\n" +
        String(error && error.message ? error.message : error),
    );
  }
}

function readVersionMetadata(versionMetadataPath) {
  const text = fs.readFileSync(
    versionMetadataPath || VERSION_METADATA_PATH,
    "utf8",
  );
  const match = text.match(/^version=(.+)$/m);

  if (!match) {
    throw new Error("version.properties is missing a version entry.");
  }

  return match[1].trim();
}

function loadLayout(layoutPath, options) {
  const normalizedOptions = options || {};
  const rootDir = normalizedOptions.rootDir || ROOT_DIR;
  const layout = readJsonSync(layoutPath, "add-on deployment layout");

  if (
    !layout ||
    !Array.isArray(layout.sourceFiles) ||
    !layout.sourceFiles.length
  ) {
    throw new Error(
      "Add-on deployment layout must include a non-empty sourceFiles array.",
    );
  }

  if (!layout.manifestPath || !String(layout.manifestPath).trim()) {
    throw new Error("Add-on deployment layout must include manifestPath.");
  }

  return {
    manifestPath: path.resolve(rootDir, layout.manifestPath),
    sourceFiles: layout.sourceFiles.map(function (filePath) {
      return path.resolve(rootDir, filePath);
    }),
  };
}

function loadTargetConfig(targetConfigPath) {
  let config;
  let scriptId;

  try {
    config = readJsonSync(targetConfigPath, "add-on deployment target config");
  } catch (error) {
    if (
      /ENOENT/i.test(String(error && error.message ? error.message : error))
    ) {
      throw new Error(
        "Missing add-on deployment target config at " +
          targetConfigPath +
          ".\n" +
          "Create it with JSON like:\n" +
          '{\n  "scriptId": "YOUR_SCRIPT_ID"\n}',
      );
    }
    throw error;
  }

  scriptId = String(
    (config && config.scriptId) ||
      process.env.HOODLEFINANCE_ADDON_SCRIPT_ID ||
      "",
  ).trim();

  if (!scriptId) {
    throw new Error(
      "Add-on deployment target config must include scriptId.\n" +
        "Expected " +
        targetConfigPath +
        " or HOODLEFINANCE_ADDON_SCRIPT_ID.",
    );
  }

  return {
    scriptId: scriptId,
  };
}

function normalizeAddonTargetName(targetName) {
  if (
    String(targetName || "")
      .trim()
      .toLowerCase() === "staging"
  ) {
    return "staging";
  }

  return "production";
}

function resolvePreferredLocalPath(primaryPath, legacyPath) {
  if (fs.existsSync(primaryPath)) {
    return primaryPath;
  }

  if (legacyPath && fs.existsSync(legacyPath)) {
    return legacyPath;
  }

  return primaryPath;
}

function getAddonTargetDir(rootDir, targetName) {
  return path.join(
    rootDir,
    ".addon-deploy.local",
    normalizeAddonTargetName(targetName),
  );
}

function getDefaultAddonTargetConfigPath(rootDir, targetName) {
  const normalizedTarget = normalizeAddonTargetName(targetName);
  const primaryPath = path.join(
    getAddonTargetDir(rootDir, normalizedTarget),
    "target.json",
  );

  if (normalizedTarget === "production") {
    return resolvePreferredLocalPath(
      primaryPath,
      path.join(rootDir, ".addon-deploy.local", "public-addon.json"),
    );
  }

  return primaryPath;
}

function getAddonClaspAuthPath(rootDir, targetName) {
  const normalizedTarget = normalizeAddonTargetName(targetName);
  const primaryPath = path.join(
    getAddonTargetDir(rootDir, normalizedTarget),
    ".clasprc.json",
  );

  if (normalizedTarget === "production") {
    return resolvePreferredLocalPath(
      primaryPath,
      path.join(rootDir, ".addon-deploy.local", ".clasprc.json"),
    );
  }

  return primaryPath;
}

function getAddonOauthClientPath(rootDir, targetName) {
  const normalizedTarget = normalizeAddonTargetName(targetName);
  const primaryPath = path.join(
    getAddonTargetDir(rootDir, normalizedTarget),
    "oauth-client.json",
  );

  if (normalizedTarget === "production") {
    return resolvePreferredLocalPath(
      primaryPath,
      path.join(rootDir, ".addon-deploy.local", "oauth-client.json"),
    );
  }

  return primaryPath;
}

function getAddonWorkDir(rootDir, targetName) {
  return path.join(getAddonTargetDir(rootDir, targetName), "work");
}

function getAddonDeployModeLabel(targetName) {
  return normalizeAddonTargetName(targetName) === "staging"
    ? "Staging Add-on"
    : "Production Add-on";
}

function buildAddonDeploymentConfigSource(targetName) {
  return [
    "// Generated by tools/addon/deploy.js during workspace preparation.",
    "var HF_IS_ADDON_STAGING = true;",
    "",
  ].join("\n");
}

function getAddonDeployCredentialContext(options, overrides) {
  const normalizedOptions = options || {};
  const normalizedOverrides = overrides || {};
  const rootDir = normalizedOverrides.rootDir || ROOT_DIR;
  const targetName = normalizeAddonTargetName(
    normalizedOverrides.targetName ||
      normalizedOptions.target ||
      DEFAULT_TARGET_NAME,
  );
  const targetConfigPath =
    normalizedOverrides.targetConfigPath ||
    normalizedOptions.targetConfigPath ||
    getDefaultAddonTargetConfigPath(rootDir, targetName);
  const claspAuth =
    normalizedOverrides.claspAuth ||
    getClaspAuth(getAddonClaspAuthPath(rootDir, targetName));
  const claspAuthPath = getClaspAuthPath(claspAuth);
  const oauthClientPath =
    normalizedOverrides.oauthClientPath ||
    getAddonOauthClientPath(rootDir, targetName);

  return {
    claspAuthPath: claspAuthPath,
    oauthClientPath: oauthClientPath,
    targetName: targetName,
    targetConfigPath: targetConfigPath,
  };
}

async function getAddonDeployCredentialReport(options, overrides) {
  const normalizedOverrides = overrides || {};
  const context = getAddonDeployCredentialContext(options, normalizedOverrides);
  const rootDir = normalizedOverrides.rootDir || ROOT_DIR;
  const runner = normalizedOverrides.runCommand || runCommand;
  const claspCommand =
    normalizedOverrides.claspCommand || getClaspCommand(rootDir);
  const claspAuth =
    normalizedOverrides.claspAuth ||
    getClaspAuth(getAddonClaspAuthPath(rootDir, context.targetName));

  return {
    claspAuthPath: context.claspAuthPath,
    claspAuthStatus: describeFileStatus(context.claspAuthPath),
    oauthClientPath: context.oauthClientPath,
    oauthClientStatus: describeFileStatus(context.oauthClientPath),
    targetConfigPath: context.targetConfigPath,
    targetConfigStatus: describeFileStatus(context.targetConfigPath),
    targetDeployMode: getAddonDeployModeLabel(context.targetName),
    targetName: context.targetName,
    claspAuthIdentity: await getClaspAuthIdentity(
      claspCommand,
      claspAuth,
      runner,
    ),
  };
}

function buildDefaultVersionDescription(options) {
  const normalizedOptions = options || {};
  const rootDir = normalizedOptions.rootDir || ROOT_DIR;
  return (
    "HOODLEFINANCE " +
    readVersionMetadata(path.join(rootDir, "version.properties")) +
    " (" +
    new Date().toISOString().slice(0, 10) +
    ")"
  );
}

function toRepoRelative(filePath, rootDir) {
  return path
    .relative(rootDir || ROOT_DIR, filePath)
    .split(path.sep)
    .join("/");
}

async function ensureCommandExists(command, runner) {
  try {
    await runner(command, ["--version"], { cwd: ROOT_DIR });
  } catch (error) {
    throw new Error(
      "Required command is not available: " +
        command +
        ".\n" +
        String(error && error.message ? error.message : error),
    );
  }
}

async function prepareWorkspace(layout, target, options) {
  const normalizedOptions = options || {};
  const rootDir = normalizedOptions.rootDir || ROOT_DIR;
  const targetName = normalizeAddonTargetName(
    normalizedOptions.targetName || DEFAULT_TARGET_NAME,
  );
  const workDir =
    normalizedOptions.workDir ||
    getAddonWorkDir(
      rootDir,
      normalizedOptions.targetName || DEFAULT_TARGET_NAME,
    );
  const claspConfigPath = path.join(workDir, ".clasp.json");
  const deploymentConfigPath = path.join(
    workDir,
    GENERATED_DEPLOYMENT_CONFIG_FILENAME,
  );
  const manifestTargetPath = path.join(workDir, "appsscript.json");
  const bundleFiles = ["appsscript.json"];
  let i;
  let sourcePath;
  let relativePath;
  let targetPath;

  await fsp.rm(workDir, { force: true, recursive: true });
  await fsp.mkdir(workDir, { recursive: true });
  await fsp.writeFile(
    claspConfigPath,
    JSON.stringify(
      {
        rootDir: ".",
        scriptId: target.scriptId,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  if (targetName === "staging") {
    await fsp.writeFile(
      deploymentConfigPath,
      buildAddonDeploymentConfigSource(targetName),
      "utf8",
    );
    bundleFiles.push(GENERATED_DEPLOYMENT_CONFIG_FILENAME);
  }
  await fsp.copyFile(layout.manifestPath, manifestTargetPath);

  for (i = 0; i < layout.sourceFiles.length; i += 1) {
    sourcePath = layout.sourceFiles[i];
    relativePath = toRepoRelative(sourcePath, rootDir);
    targetPath = path.join(workDir, relativePath);
    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    await fsp.copyFile(sourcePath, targetPath);
    bundleFiles.push(relativePath);
  }

  return {
    bundleFiles: bundleFiles,
    claspConfigPath: claspConfigPath,
    deploymentConfigPath: targetName === "staging" ? deploymentConfigPath : "",
    manifestTargetPath: manifestTargetPath,
    workDir: workDir,
  };
}

async function deployAddon(options, overrides) {
  const normalizedOverrides = overrides || {};
  const rootDir = normalizedOverrides.rootDir || ROOT_DIR;
  const runner = normalizedOverrides.runCommand || runCommand;
  const claspCommand =
    normalizedOverrides.claspCommand || getClaspCommand(rootDir);
  const targetName = normalizeAddonTargetName(
    normalizedOverrides.targetName || options.target || DEFAULT_TARGET_NAME,
  );
  const claspAuth =
    normalizedOverrides.claspAuth ||
    getClaspAuth(getAddonClaspAuthPath(rootDir, targetName));
  const layout =
    normalizedOverrides.layout ||
    loadLayout(options.layoutPath, { rootDir: rootDir });
  const targetConfigPath =
    normalizedOverrides.targetConfigPath ||
    options.targetConfigPath ||
    getDefaultAddonTargetConfigPath(rootDir, targetName);
  const target =
    normalizedOverrides.target || loadTargetConfig(targetConfigPath);
  const versionDescription = options.createVersion
    ? String(
        options.versionDescription ||
          normalizedOverrides.versionDescription ||
          buildDefaultVersionDescription({ rootDir: rootDir }),
      ).trim()
    : "";
  const workspace = await prepareWorkspace(layout, target, {
    rootDir: rootDir,
    targetName: targetName,
    workDir:
      normalizedOverrides.workDir || getAddonWorkDir(rootDir, targetName),
  });
  const claspProjectPath = path.join(workspace.workDir, ".clasp.json");
  const claspAuthPath = getClaspAuthPath(claspAuth);
  const oauthClientPath =
    normalizedOverrides.oauthClientPath ||
    getAddonOauthClientPath(rootDir, targetName);
  let versionOutput = "";
  let versionMatch;

  await ensureCommandExists(claspCommand, runner);

  if (!options.dryRun) {
    try {
      await runner(
        claspCommand,
        claspAuth.authArgs.concat(["-P", claspProjectPath, "push", "--force"]),
        {
          cwd: workspace.workDir,
        },
      );
    } catch (error) {
      throw explainCredentialError(error, {
        claspAuthPath: claspAuthPath,
        oauthClientPath: oauthClientPath,
        targetName: targetName,
      });
    }

    if (options.createVersion) {
      try {
        versionOutput = (
          await runner(
            claspCommand,
            claspAuth.authArgs.concat([
              "-P",
              claspProjectPath,
              "version",
              versionDescription,
            ]),
            {
              cwd: workspace.workDir,
            },
          )
        ).stdout;
      } catch (error) {
        throw explainCredentialError(error, {
          claspAuthPath: claspAuthPath,
          oauthClientPath: oauthClientPath,
          targetName: targetName,
        });
      }
      versionMatch = String(versionOutput).match(/Created version (\d+)/);
    }
  }

  return {
    bundleFiles: workspace.bundleFiles,
    deploymentConfigPath: workspace.deploymentConfigPath,
    manifestPath: toRepoRelative(layout.manifestPath, rootDir),
    scriptId: target.scriptId,
    sourceFiles: layout.sourceFiles.map(function (filePath) {
      return toRepoRelative(filePath, rootDir);
    }),
    targetName: targetName,
    versionDescription: versionDescription,
    versionNumber: versionMatch ? versionMatch[1] : "",
    workDir: workspace.workDir,
  };
}

async function runCommand(command, args, options) {
  const normalizedOptions = options || {};

  return new Promise(function (resolve, reject) {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      cwd: normalizedOptions.cwd || ROOT_DIR,
      env: normalizedOptions.env || process.env,
      stdio: "pipe",
    });

    child.stdin.end();
    child.stdout.on("data", function (chunk) {
      stdout += chunk;
    });
    child.stderr.on("data", function (chunk) {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", function (code) {
      if (code !== 0) {
        reject(
          Object.assign(
            new Error((stderr || stdout || "").trim() || command + " failed"),
            {
              code: code,
              stderr: stderr,
              stdout: stdout,
            },
          ),
        );
        return;
      }

      resolve({
        stderr: stderr,
        stdout: stdout,
      });
    });
  });
}

function getClaspAuthPath(claspAuth) {
  let authFlagIndex;

  if (!claspAuth || !Array.isArray(claspAuth.authArgs)) {
    return "";
  }

  authFlagIndex = claspAuth.authArgs.indexOf("-A");
  if (authFlagIndex === -1 || authFlagIndex + 1 >= claspAuth.authArgs.length) {
    return "";
  }

  return String(claspAuth.authArgs[authFlagIndex + 1] || "").trim();
}

function describeCredentialFile(filePath, label) {
  if (!filePath) {
    return label + ": <unknown>";
  }

  return (
    label +
    ": " +
    filePath +
    " (" +
    (fs.existsSync(filePath) ? "found" : "missing") +
    ")"
  );
}

function describeFileStatus(filePath) {
  return getPathStatus(filePath);
}

function getAddonClaspLoginCommand(targetName) {
  return (
    "npm run clasp:user:login -- --addon-" +
    normalizeAddonTargetName(targetName)
  );
}

function getCredentialErrorText(error) {
  return [
    error && error.message,
    error && error.stderr,
    error && error.stdout,
  ]
    .filter(Boolean)
    .join("\n");
}

function isLikelyAddonReauthError(error) {
  const text = getCredentialErrorText(error);

  return (
    /invalid_grant/i.test(text) &&
    (/invalid_rapt/i.test(text) || /reauth/i.test(text))
  );
}

function getOauthClientLevel(report) {
  if (!report || report.oauthClientStatus === "missing") {
    return "ERROR";
  }

  if (
    report.claspAuthIdentity &&
    report.claspAuthIdentity !== "(Not logged in or auth file missing)"
  ) {
    return "OK";
  }

  return "UNKNOWN";
}

async function getClaspAuthIdentity(claspCommand, claspAuth, runner) {
  let authPath;
  let output;
  let emailMatch;
  let normalizedOutput;

  authPath = getClaspAuthPath(claspAuth);
  if (!authPath || !fs.existsSync(authPath)) {
    return "(Not logged in or auth file missing)";
  }

  try {
    output = await runner(
      claspCommand,
      claspAuth.authArgs.concat(["show-authorized-user"]),
      {
        cwd: ROOT_DIR,
      },
    );
  } catch (error) {
    return "(Not logged in or auth file missing)";
  }

  normalizedOutput = String(
    (output && (output.stdout || output.stderr)) || "",
  ).trim();
  if (!normalizedOutput) {
    return "(Logged in)";
  }

  emailMatch = normalizedOutput.match(/([^ ]+@[^ ]+\.[^ \r\n]+)/);
  if (emailMatch) {
    return emailMatch[1].replace(/[.,;:]+$/, "");
  }

  if (/unknown user/i.test(normalizedOutput)) {
    return "(Unknown user)";
  }

  return normalizedOutput.split(/\r?\n/)[0];
}

async function printCredentialContext(options, overrides) {
  const context = await getAddonDeployCredentialReport(options, overrides);
  const rows = buildPathRows(
    [
      {
        label: "OAuth Client config",
        path: context.oauthClientPath,
        level: getOauthClientLevel(context),
      },
      { label: "Clasp Auth config", path: context.claspAuthPath },
    ],
    {
      prefixStatusIconOnLabel: true,
    },
  );

  rows.push(
    buildStatusRow({
      label: "Clasp Auth Identity",
      level:
        context.claspAuthIdentity === "(Not logged in or auth file missing)"
          ? "ERROR"
          : "OK",
      value: context.claspAuthIdentity,
    }),
  );

  rows.push.apply(
    rows,
    buildPathRows(
      [{ label: "Target config", path: context.targetConfigPath }],
      {
        prefixStatusIconOnLabel: true,
      },
    ),
  );

  rows.push(
    buildStatusRow({
      label: "Target Deploy Mode",
      level: context.targetName === "staging" ? "OK" : "ATTENTION",
      value: context.targetDeployMode,
    }),
  );

  printContextBlock("Add-on Credentials Context", rows);
}

function explainCredentialError(error, paths) {
  const message = String(error && error.message ? error.message : error);
  const normalizedTarget = normalizeAddonTargetName(paths && paths.targetName);

  if (/No credentials found/i.test(message)) {
    return Object.assign(
      new Error(
        "No clasp credentials found for add-on deployment.\n" +
          describeCredentialFile(
            paths && paths.claspAuthPath,
            "Expected auth file",
          ) +
          "\n" +
          describeCredentialFile(
            paths && paths.oauthClientPath,
            "Expected OAuth client file",
          ) +
          "\n" +
          "Create the auth file with:\n" +
          "npm exec -- clasp -A .addon-deploy.local/" +
          normalizedTarget +
          "/.clasprc.json login --creds .addon-deploy.local/" +
          normalizedTarget +
          "/oauth-client.json",
      ),
      {
        cause: error,
        code: error && error.code,
        stderr: error && error.stderr,
        stdout: error && error.stdout,
      },
    );
  }

  if (isLikelyAddonReauthError(error)) {
    return Object.assign(
      new Error(
        "Saved clasp credentials for add-on deployment need reauthorization.\n" +
        describeCredentialFile(
          paths && paths.claspAuthPath,
          "Current auth file",
        ) +
        "\n" +
        describeCredentialFile(
          paths && paths.oauthClientPath,
          "OAuth client file",
        ) +
        "\n" +
        "Original error: " +
        message +
        "\n\n" +
        "Refresh the auth file with:\n" +
        getAddonClaspLoginCommand(normalizedTarget),
      ),
      {
        cause: error,
        code: error && error.code,
        stderr: error && error.stderr,
        stdout: error && error.stdout,
      },
    );
  }

  return error;
}

function isExpectedCliError(error) {
  const message = String(error && error.message ? error.message : error);

  return (
    /^Choose an add-on target:/i.test(message) ||
    /^Choose exactly one add-on target:/i.test(message) ||
    /^Missing add-on deployment target config at /i.test(message) ||
    /^Add-on deployment target config must include scriptId\./i.test(message) ||
    /^No clasp credentials found for add-on deployment\./i.test(message) ||
    /^Saved clasp credentials for add-on deployment need reauthorization\./i.test(
      message,
    ) ||
    /^Unknown argument:/i.test(message) ||
    /^Usage:/i.test(message) ||
    /required `--` separator/i.test(message)
  );
}

module.exports = {
  DEFAULT_LAYOUT_PATH,
  DEFAULT_TARGET_NAME,
  GENERATED_DEPLOYMENT_CONFIG_FILENAME,
  LOCAL_DIR,
  buildAddonDeploymentConfigSource,
  buildDefaultVersionDescription,
  deployAddon,
  explainCredentialError,
  assertNoLikelyMissingNpmArgSeparator,
  getAddonDeployCredentialReport,
  getClaspCommand,
  getAddonDeployCredentialContext,
  getClaspAuthIdentity,
  getAddonClaspAuthPath,
  getAddonOauthClientPath,
  getAddonTargetDir,
  getAddonWorkDir,
  getDefaultAddonTargetConfigPath,
  getAddonDeployModeLabel,
  getOauthClientLevel,
  loadLayout,
  loadTargetConfig,
  parseArgs,
  printCredentialContext,
  prepareWorkspace,
  runCommand,
};

if (require.main === module) {
  main().catch(function (error) {
    const output = isExpectedCliError(error)
      ? String(error && error.message ? error.message : error)
      : String(error && error.stack ? error.stack : error);
    process.stderr.write(output + "\n");
    process.exitCode = 1;
  });
}
