const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  buildDefaultVersionDescription,
  deployAddon,
  getAddonDeployCredentialContext,
  getAddonDeployCredentialReport,
  loadLayout,
  loadTargetConfig,
  parseArgs,
  prepareWorkspace,
} = require("../tools/deploy-addon.js");

function createFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "hoodlefinance-addon-deploy-"));
  const docsDir = path.join(rootDir, "docs", "google-sheets-editor-addon");
  const localDir = path.join(rootDir, ".addon-deploy.local");
  const workDir = path.join(localDir, "work");
  const manifestPath = path.join(docsDir, "appsscript.json");
  const layoutPath = path.join(docsDir, "addon-deploy-layout.json");
  const targetConfigPath = path.join(localDir, "public-addon.json");
  const sourcePath = path.join(rootDir, "hoodlefinance.js");
  const versionMetadataPath = path.join(rootDir, "version.properties");

  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(localDir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify({ timeZone: "Etc/UTC" }, null, 2) + "\n", "utf8");
  fs.writeFileSync(layoutPath, JSON.stringify({
    manifestPath: "docs/google-sheets-editor-addon/appsscript.json",
    sourceFiles: ["hoodlefinance.js"],
  }, null, 2) + "\n", "utf8");
  fs.writeFileSync(targetConfigPath, JSON.stringify({ scriptId: "script-123" }, null, 2) + "\n", "utf8");
  fs.writeFileSync(sourcePath, 'const HOODLEFINANCE_VERSION_ = "0.9.3";\n', "utf8");
  fs.writeFileSync(versionMetadataPath, "version=0.9.3\n", "utf8");

  return {
    layoutPath,
    localDir,
    manifestPath,
    rootDir,
    sourcePath,
    targetConfigPath,
    versionMetadataPath,
    workDir,
  };
}

test("parseArgs supports dry run and push-only flags", function () {
  assert.deepEqual(parseArgs([]), {
    createVersion: true,
    dryRun: false,
    layoutPath: path.join(path.resolve(__dirname, ".."), "docs", "google-sheets-editor-addon", "addon-deploy-layout.json"),
    targetConfigPath: path.join(path.resolve(__dirname, ".."), ".addon-deploy.local", "public-addon.json"),
    versionDescription: "",
  });

  const parsed = parseArgs(["--dry-run", "--push-only", "--version-description", "custom"]);
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.createVersion, false);
  assert.equal(parsed.versionDescription, "custom");
});

test("loadLayout and loadTargetConfig read the tracked layout and local target", function () {
  const fixture = createFixture();
  const previousCwd = process.cwd();

  process.chdir(fixture.rootDir);
  try {
    const layout = loadLayout(fixture.layoutPath, { rootDir: fixture.rootDir });
    const target = loadTargetConfig(fixture.targetConfigPath);

    assert.equal(layout.manifestPath, fixture.manifestPath);
    assert.deepEqual(layout.sourceFiles, [fixture.sourcePath]);
    assert.equal(target.scriptId, "script-123");
  } finally {
    process.chdir(previousCwd);
  }
});

test("getAddonDeployCredentialContext reports the expected local credential paths", function () {
  const fixture = createFixture();
  const context = getAddonDeployCredentialContext(
    {
      targetConfigPath: fixture.targetConfigPath,
    },
    {
      rootDir: fixture.rootDir,
    }
  );

  assert.equal(context.claspAuthPath, path.join(fixture.localDir, ".clasprc.json"));
  assert.equal(context.oauthClientPath, path.join(fixture.localDir, "oauth-client.json"));
  assert.equal(context.targetConfigPath, fixture.targetConfigPath);
});

test("getAddonDeployCredentialReport reports status and identity details", async function () {
  const fixture = createFixture();
  const authPath = path.join(fixture.localDir, ".clasprc.json");
  const oauthClientPath = path.join(fixture.localDir, "oauth-client.json");
  fs.writeFileSync(authPath, "{}", "utf8");

  const report = await getAddonDeployCredentialReport(
    {
      targetConfigPath: fixture.targetConfigPath,
    },
    {
      rootDir: fixture.rootDir,
      runCommand: async function () {
        return { stdout: "You are logged in as deployer@example.com.\n", stderr: "" };
      },
    }
  );

  assert.equal(report.claspAuthPath, authPath);
  assert.equal(report.claspAuthStatus, "found");
  assert.equal(report.oauthClientPath, oauthClientPath);
  assert.equal(report.oauthClientStatus, "missing");
  assert.equal(report.targetConfigPath, fixture.targetConfigPath);
  assert.equal(report.targetConfigStatus, "found");
  assert.equal(report.targetDeployMode, "Public Add-on");
  assert.equal(report.claspAuthIdentity, "deployer@example.com");
});

test("prepareWorkspace writes clasp config, manifest, and source files", async function () {
  const fixture = createFixture();
  const layout = {
    manifestPath: fixture.manifestPath,
    sourceFiles: [fixture.sourcePath],
  };
  const target = {
    scriptId: "script-123",
  };

  const workspace = await prepareWorkspace(layout, target, {
    rootDir: fixture.rootDir,
    workDir: fixture.workDir,
  });

  assert.match(fs.readFileSync(path.join(workspace.workDir, ".clasp.json"), "utf8"), /"scriptId": "script-123"/);
  assert.equal(fs.readFileSync(path.join(workspace.workDir, "appsscript.json"), "utf8"), fs.readFileSync(fixture.manifestPath, "utf8"));
  assert.equal(fs.readFileSync(path.join(workspace.workDir, "hoodlefinance.js"), "utf8"), fs.readFileSync(fixture.sourcePath, "utf8"));
});

test("deployAddon dry run prepares the workspace without calling clasp", async function () {
  const fixture = createFixture();
  const previousCwd = process.cwd();

  process.chdir(fixture.rootDir);
  try {
    const calls = [];
    const result = await deployAddon(
      {
        createVersion: true,
        dryRun: true,
        layoutPath: fixture.layoutPath,
        targetConfigPath: fixture.targetConfigPath,
        versionDescription: "",
      },
      {
        env: {},
        runCommand: async function (command, args) {
          calls.push([path.basename(command)].concat(args));
          return { stdout: "3.1.3\n", stderr: "" };
        },
        rootDir: fixture.rootDir,
        workDir: fixture.workDir,
      }
    );

    assert.equal(result.scriptId, "script-123");
    assert.equal(result.versionNumber, "");
    assert.match(result.versionDescription, /^HOODLEFINANCE 0\.9\.3 \(\d{4}-\d{2}-\d{2}\)$/);
    assert.deepEqual(calls, [["clasp", "--version"]]);
    assert.equal(fs.existsSync(path.join(fixture.workDir, "hoodlefinance.js")), true);
  } finally {
    process.chdir(previousCwd);
  }
});

test("deployAddon push flow runs clasp push and clasp version", async function () {
  const fixture = createFixture();
  const previousCwd = process.cwd();

  process.chdir(fixture.rootDir);
  try {
    const calls = [];
    const result = await deployAddon(
      {
        createVersion: true,
        dryRun: false,
        layoutPath: fixture.layoutPath,
        targetConfigPath: fixture.targetConfigPath,
        versionDescription: "Release 0.9.3",
      },
      {
        env: {},
        runCommand: async function (command, args) {
          calls.push([path.basename(command)].concat(args));
          if (args[0] === "--version") {
            return { stdout: "3.1.3\n", stderr: "" };
          }
          if (args.includes("version")) {
            return { stdout: "Created version 17\n", stderr: "" };
          }
          return { stdout: "", stderr: "" };
        },
        rootDir: fixture.rootDir,
        workDir: fixture.workDir,
      }
    );

    assert.equal(result.versionNumber, "17");
    assert.deepEqual(calls, [
      ["clasp", "--version"],
      ["clasp", "-A", path.join(fixture.localDir, ".clasprc.json"), "-P", path.join(fixture.workDir, ".clasp.json"), "push", "--force"],
      ["clasp", "-A", path.join(fixture.localDir, ".clasprc.json"), "-P", path.join(fixture.workDir, ".clasp.json"), "version", "Release 0.9.3"],
    ]);
  } finally {
    process.chdir(previousCwd);
  }
});

test("deployAddon surfaces missing add-on credential paths when clasp reports no credentials", async function () {
  const fixture = createFixture();
  const previousCwd = process.cwd();

  process.chdir(fixture.rootDir);
  try {
    await assert.rejects(
      deployAddon(
        {
          createVersion: true,
          dryRun: false,
          layoutPath: fixture.layoutPath,
          targetConfigPath: fixture.targetConfigPath,
          versionDescription: "Release 0.9.3",
        },
        {
          runCommand: async function (command, args) {
            if (args[0] === "--version") {
              return { stdout: "3.1.3\n", stderr: "" };
            }

            throw Object.assign(new Error("No credentials found."), {
              code: 1,
              stderr: "No credentials found.\n",
              stdout: "",
            });
          },
          rootDir: fixture.rootDir,
          workDir: fixture.workDir,
        }
      ),
      function (error) {
        assert.match(error.message, /No clasp credentials found for add-on deployment\./);
        assert.match(error.message, new RegExp("Expected auth file: " + escapeRegex(path.join(fixture.localDir, ".clasprc.json")) + " \\(missing\\)"));
        assert.match(error.message, new RegExp("Expected OAuth client file: " + escapeRegex(path.join(fixture.localDir, "oauth-client.json")) + " \\(missing\\)"));
        assert.match(error.message, /clasp -A \.addon-deploy\.local\/\.clasprc\.json login --creds \.addon-deploy\.local\/oauth-client\.json/);
        return true;
      }
    );
  } finally {
    process.chdir(previousCwd);
  }
});

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
