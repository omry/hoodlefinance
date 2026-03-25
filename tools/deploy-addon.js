#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  getClaspCommand,
  getClaspAuth,
} = require("./clasp-auth.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const LOCAL_DIR = path.join(ROOT_DIR, ".addon-deploy.local");
const WORK_DIR = path.join(LOCAL_DIR, "work");
const DEFAULT_LAYOUT_PATH = path.join(ROOT_DIR, "docs", "google-sheets-editor-addon", "addon-deploy-layout.json");
const DEFAULT_TARGET_CONFIG_PATH = path.join(LOCAL_DIR, "public-addon.json");
const VERSION_METADATA_PATH = path.join(ROOT_DIR, "version.properties");

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await deployAddon(options);

  if (options.dryRun) {
    process.stdout.write(
      "Dry run: would sync " +
        result.sourceFiles.length +
        " source file" +
        (result.sourceFiles.length === 1 ? "" : "s") +
        " to script " +
        result.scriptId +
        ".\n"
    );
    process.stdout.write("Manifest: " + result.manifestPath + "\n");
    process.stdout.write("Files:\n");
    result.sourceFiles.forEach(function (filePath) {
      process.stdout.write("- " + filePath + "\n");
    });
    if (result.versionDescription) {
      process.stdout.write("Version description: " + result.versionDescription + "\n");
    }
    return;
  }

  process.stdout.write("Pushed add-on sources to script " + result.scriptId + ".\n");
  if (result.versionNumber) {
    process.stdout.write(
      "Created Apps Script version " +
        result.versionNumber +
        (result.versionDescription ? " (" + result.versionDescription + ")" : "") +
        ".\n"
    );
  }
}

function parseArgs(argv) {
  const options = {
    createVersion: true,
    dryRun: false,
    layoutPath: DEFAULT_LAYOUT_PATH,
    targetConfigPath: DEFAULT_TARGET_CONFIG_PATH,
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

    if (current === "--target-config") {
      i += 1;
      if (i >= argv.length) {
        throw new Error("Usage: node tools/deploy-addon.js [--dry-run] [--push-only] [--target-config <path>] [--layout <path>] [--version-description <text>]");
      }
      options.targetConfigPath = path.resolve(ROOT_DIR, argv[i]);
      continue;
    }

    if (current === "--layout") {
      i += 1;
      if (i >= argv.length) {
        throw new Error("Usage: node tools/deploy-addon.js [--dry-run] [--push-only] [--target-config <path>] [--layout <path>] [--version-description <text>]");
      }
      options.layoutPath = path.resolve(ROOT_DIR, argv[i]);
      continue;
    }

    if (current === "--version-description") {
      i += 1;
      if (i >= argv.length) {
        throw new Error("Usage: node tools/deploy-addon.js [--dry-run] [--push-only] [--target-config <path>] [--layout <path>] [--version-description <text>]");
      }
      options.versionDescription = argv[i];
      continue;
    }

    throw new Error("Unknown argument: " + current);
  }

  return options;
}

function readJsonSync(filePath, label) {
  let text;

  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error("Failed to read " + label + " at " + filePath + ".\n" + String(error && error.message ? error.message : error));
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("Failed to parse " + label + " at " + filePath + ".\n" + String(error && error.message ? error.message : error));
  }
}

function readVersionMetadata(versionMetadataPath) {
  const text = fs.readFileSync(versionMetadataPath || VERSION_METADATA_PATH, "utf8");
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

  if (!layout || !Array.isArray(layout.sourceFiles) || !layout.sourceFiles.length) {
    throw new Error("Add-on deployment layout must include a non-empty sourceFiles array.");
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
  const config = readJsonSync(targetConfigPath, "add-on deployment target config");
  const scriptId = String((config && config.scriptId) || process.env.HOODLEFINANCE_ADDON_SCRIPT_ID || "").trim();

  if (!scriptId) {
    throw new Error(
      "Add-on deployment target config must include scriptId.\n" +
        "Expected " +
        targetConfigPath +
        " or HOODLEFINANCE_ADDON_SCRIPT_ID."
    );
  }

  return {
    scriptId: scriptId,
  };
}

function buildDefaultVersionDescription(options) {
  const normalizedOptions = options || {};
  const rootDir = normalizedOptions.rootDir || ROOT_DIR;
  return "HOODLEFINANCE " + readVersionMetadata(path.join(rootDir, "version.properties")) + " (" + new Date().toISOString().slice(0, 10) + ")";
}

function toRepoRelative(filePath, rootDir) {
  return path.relative(rootDir || ROOT_DIR, filePath).split(path.sep).join("/");
}

async function ensureCommandExists(command, runner) {
  try {
    await runner(command, ["--version"], { cwd: ROOT_DIR });
  } catch (error) {
    throw new Error(
      "Required command is not available: " +
        command +
        ".\n" +
        String(error && error.message ? error.message : error)
    );
  }
}

async function prepareWorkspace(layout, target, options) {
  const normalizedOptions = options || {};
  const rootDir = normalizedOptions.rootDir || ROOT_DIR;
  const workDir = options.workDir || WORK_DIR;
  const claspConfigPath = path.join(workDir, ".clasp.json");
  const manifestTargetPath = path.join(workDir, "appsscript.json");
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
      2
    ) + "\n",
    "utf8"
  );
  await fsp.copyFile(layout.manifestPath, manifestTargetPath);

  for (i = 0; i < layout.sourceFiles.length; i += 1) {
    sourcePath = layout.sourceFiles[i];
    relativePath = toRepoRelative(sourcePath, rootDir);
    targetPath = path.join(workDir, relativePath);
    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    await fsp.copyFile(sourcePath, targetPath);
  }

  return {
    claspConfigPath: claspConfigPath,
    manifestTargetPath: manifestTargetPath,
    workDir: workDir,
  };
}

async function deployAddon(options, overrides) {
  const normalizedOverrides = overrides || {};
  const rootDir = normalizedOverrides.rootDir || ROOT_DIR;
  const runner = normalizedOverrides.runCommand || runCommand;
  const claspCommand = normalizedOverrides.claspCommand || getClaspCommand(rootDir);
  const claspAuth = normalizedOverrides.claspAuth || getClaspAuth(path.join(LOCAL_DIR, ".clasprc.json"));
  const layout = normalizedOverrides.layout || loadLayout(options.layoutPath, { rootDir: rootDir });
  const target = normalizedOverrides.target || loadTargetConfig(options.targetConfigPath);
  const versionDescription = options.createVersion
    ? String(options.versionDescription || normalizedOverrides.versionDescription || buildDefaultVersionDescription({ rootDir: rootDir })).trim()
    : "";
  const workspace = await prepareWorkspace(layout, target, {
    rootDir: rootDir,
    workDir: normalizedOverrides.workDir,
  });
  const claspProjectPath = path.join(workspace.workDir, ".clasp.json");
  let versionOutput = "";
  let versionMatch;

  await ensureCommandExists(claspCommand, runner);

  if (!options.dryRun) {
    await runner(claspCommand, claspAuth.authArgs.concat(["-P", claspProjectPath, "push", "--force"]), {
        cwd: workspace.workDir,
    });

    if (options.createVersion) {
      versionOutput = (
        await runner(claspCommand, claspAuth.authArgs.concat(["-P", claspProjectPath, "version", versionDescription]), {
          cwd: workspace.workDir,
        })
      ).stdout;
      versionMatch = String(versionOutput).match(/Created version (\d+)/);
    }
  }

  return {
    manifestPath: toRepoRelative(layout.manifestPath, rootDir),
    scriptId: target.scriptId,
    sourceFiles: layout.sourceFiles.map(function (filePath) {
      return toRepoRelative(filePath, rootDir);
    }),
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
          Object.assign(new Error((stderr || stdout || "").trim() || (command + " failed")), {
            code: code,
            stderr: stderr,
            stdout: stdout,
          })
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

module.exports = {
  DEFAULT_LAYOUT_PATH,
  DEFAULT_TARGET_CONFIG_PATH,
  LOCAL_DIR,
  WORK_DIR,
  buildDefaultVersionDescription,
  deployAddon,
  getClaspCommand,
  loadLayout,
  loadTargetConfig,
  parseArgs,
  prepareWorkspace,
  runCommand,
};

if (require.main === module) {
  main().catch(function (error) {
    process.stderr.write(String(error && error.stack ? error.stack : error) + "\n");
    process.exitCode = 1;
  });
}
