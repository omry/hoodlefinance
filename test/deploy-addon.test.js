const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  buildDefaultVersionDescription,
  deployAddon,
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
      ["clasp", "-A", path.join(path.resolve(__dirname, ".."), ".addon-deploy.local", ".clasprc.json"), "-P", path.join(fixture.workDir, ".clasp.json"), "push", "--force"],
      ["clasp", "-A", path.join(path.resolve(__dirname, ".."), ".addon-deploy.local", ".clasprc.json"), "-P", path.join(fixture.workDir, ".clasp.json"), "version", "Release 0.9.3"],
    ]);
  } finally {
    process.chdir(previousCwd);
  }
});
