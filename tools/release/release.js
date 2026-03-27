#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const CHANGES_DIR = path.join(ROOT_DIR, "changes.d");
const VERSION_METADATA_PATH = path.join(ROOT_DIR, "version.properties");
const RELEASE_NOTES_PATH = path.join(
  ROOT_DIR,
  "docs",
  "release-notes",
  "RELEASE_NOTES.md",
);
const RELEASES_DIR = path.join(ROOT_DIR, "docs", "release-notes");
const RELEASE_TEMPLATE_PATH = path.join(RELEASES_DIR, "TEMPLATE.md");
const SCRIPT_SOURCE_PATH = path.join(ROOT_DIR, "hoodlefinance.js");
const FRAGMENT_CHECKER_PATH = path.join(
  ROOT_DIR,
  "tools",
  "release",
  "check-release-fragments.sh",
);
const FRAGMENT_CATEGORIES = ["upgrade", "added", "changed", "fixed", "docs"];
const FRAGMENT_HEADING_BY_CATEGORY = {
  upgrade: "Upgrade Notes",
  added: "Added",
  changed: "Changed",
  docs: "Documentation",
  fixed: "Fixed",
};
const FRAGMENT_FILENAME_PATTERN =
  /^(\d{8})-([a-z0-9][a-z0-9-]*)\.(upgrade|added|changed|docs|fixed)\.md$/;
const RELEASE_FILE_PATTERN = /^v(\d+\.\d+\.\d+)\.md$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const IGNORED_CHANGE_FILES = {
  ".gitkeep": true,
  "README.md": true,
  "TEMPLATE.md": true,
};
const RELEASE_NOTES_INTRO = ["# Release Notes"].join("\n");
const DEFAULT_RELEASE_TEMPLATE = [
  "# v{{version}} - {{release_date}}",
  "",
  "{{release_body}}",
  "",
].join("\n");
const DEFAULT_PREPARE_VERIFICATION_STEPS = [
  {
    args: ["--test", "--test-reporter=spec", "test/hoodlefinance.test.js"],
    command: process.execPath,
    label: "hoodlefinance test suite",
  },
  {
    args: ["--test", "--test-reporter=spec", "test/release.test.js"],
    command: process.execPath,
    label: "release test suite",
  },
  {
    args: ["--test", "--test-reporter=spec", "test/sync-demo-sheet.test.js"],
    command: process.execPath,
    label: "demo-sheet test suite",
  },
  {
    args: ["tools/demo/sync.js", "--staging", "--dry-run"],
    command: process.execPath,
    label: "demo-sheet staging dry run",
  },
  {
    args: ["tools/demo/sync.js", "--production", "--dry-run"],
    command: process.execPath,
    label: "demo-sheet production dry run",
  },
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let result;

  if (options.command === "check-fragments") {
    result = await runReleaseFragmentCheck();
    process.stdout.write(result.stdout);
    return;
  }

  if (options.command === "prepare") {
    if (options.dryRun) {
      result = await previewRelease(options.version);
      process.stdout.write(result.releaseFileText);
      return;
    }

    result = await prepareRelease(options.version);
    process.stdout.write(
      "Prepared release v" +
        result.version +
        " (" +
        result.releaseDate +
        ") with " +
        result.fragmentCount +
        " fragment" +
        (result.fragmentCount === 1 ? "" : "s") +
        ".\n",
    );
    return;
  }

  if (options.command === "publish") {
    result = await publishRelease(options.version);
    process.stdout.write("Published release v" + result.version + ".\n");
    return;
  }

  throw new Error("Unknown release command: " + options.command);
}

function parseArgs(argv) {
  if (!Array.isArray(argv) || !argv.length) {
    throw new Error(
      "Usage: node tools/release/release.js <check-fragments|prepare|publish> [x.y.z] [--dry-run]",
    );
  }

  if (
    argv[0] !== "check-fragments" &&
    argv[0] !== "prepare" &&
    argv[0] !== "publish"
  ) {
    throw new Error("Unknown release command: " + argv[0]);
  }

  if (argv[0] === "check-fragments") {
    if (argv.length !== 1) {
      throw new Error("Usage: node tools/release/release.js check-fragments");
    }

    return {
      command: "check-fragments",
    };
  }

  if (argv[0] === "publish") {
    if (argv.length !== 2) {
      throw new Error("Usage: node tools/release/release.js publish <x.y.z>");
    }

    validateVersion(argv[1]);

    return {
      command: "publish",
      version: argv[1],
    };
  }

  if (argv.length !== 2 && argv.length !== 3) {
    throw new Error(
      "Usage: node tools/release/release.js prepare <x.y.z> [--dry-run]",
    );
  }

  validateVersion(argv[1]);

  if (argv.length === 3 && argv[2] !== "--dry-run") {
    throw new Error(
      "Usage: node tools/release/release.js prepare <x.y.z> [--dry-run]",
    );
  }

  return {
    command: argv[0],
    dryRun: argv[2] === "--dry-run",
    version: argv[1],
  };
}

function validateVersion(version) {
  if (!VERSION_PATTERN.test(String(version || "").trim())) {
    throw new Error('Release version must look like "x.y.z".');
  }
}

function compareVersions(left, right) {
  const leftParts = String(left || "0").split(".");
  const rightParts = String(right || "0").split(".");
  const length = Math.max(leftParts.length, rightParts.length);
  let i;
  let leftValue;
  let rightValue;

  for (i = 0; i < length; i += 1) {
    leftValue = Number(leftParts[i] || 0);
    rightValue = Number(rightParts[i] || 0);

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

function readTextSync(filePath, label) {
  try {
    return fs.readFileSync(filePath, "utf8");
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
}

async function writeText(filePath, content) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content, "utf8");
}

function toGitRelativePath(cwd, filePath) {
  const relativePath = path.relative(cwd, filePath);

  if (
    !relativePath ||
    relativePath === "." ||
    relativePath === ".." ||
    relativePath.startsWith(".." + path.sep) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error("Path is outside the git working tree: " + filePath);
  }

  return relativePath.split(path.sep).join("/");
}

async function ensureCleanGitWorktree(options) {
  const normalizedOptions = options || {};
  const cwd = normalizedOptions.cwd || ROOT_DIR;
  const runner = normalizedOptions.runCommand || runCommand;
  let gitStatus;

  try {
    gitStatus = await runner("git", ["status", "--short"], { cwd: cwd });
  } catch (error) {
    throw new Error(
      "Failed to inspect git status before preparing a release.\n" +
        String(error && error.message ? error.message : error),
    );
  }

  if (String(gitStatus.stdout || "").trim()) {
    throw new Error(
      "Git working tree must be clean before preparing a release.",
    );
  }
}

async function restorePreparedReleaseStateWithGit(state) {
  const cwd = state.cwd || ROOT_DIR;
  const runner = state.runCommand || runCommand;
  const trackedPaths = [
    state.releaseNotesPath,
    state.scriptSourcePath,
    state.versionMetadataPath,
  ]
    .filter(Boolean)
    .map(function (filePath) {
      return toGitRelativePath(cwd, filePath);
    });
  const releaseFilePath = toGitRelativePath(cwd, state.releaseFilePath);

  await runner("git", ["restore", "--worktree", "--"].concat(trackedPaths), {
    cwd: cwd,
  });
  await runner("git", ["clean", "-f", "--", releaseFilePath], {
    cwd: cwd,
  });
}

function buildReleaseNotesRelativePath(version) {
  return path.posix.join("docs", "release-notes", "v" + version + ".md");
}

function buildReleaseFilePath(releasesDir, version) {
  return path.join(releasesDir, "v" + version + ".md");
}

function parseVersionMetadataText(text) {
  const metadata = {};

  String(text || "")
    .split(/\r?\n/)
    .forEach(function (line) {
      const trimmed = line.trim();
      const separatorIndex = line.indexOf("=");
      let key;
      let value;

      if (!trimmed || trimmed.charAt(0) === "#") {
        return;
      }

      if (separatorIndex <= 0) {
        throw new Error("Invalid version metadata line: " + line);
      }

      key = line.slice(0, separatorIndex).trim();
      value = line.slice(separatorIndex + 1).trim();
      metadata[key] = value;
    });

  if (!metadata.version) {
    throw new Error("version.properties is missing a version entry.");
  }

  validateVersion(metadata.version);

  return metadata;
}

function readVersionMetadata(versionMetadataPath) {
  return parseVersionMetadataText(
    readTextSync(versionMetadataPath, "version metadata"),
  );
}

function renderVersionMetadata(metadata) {
  const lines = ["version=" + metadata.version];

  if (metadata.release_date) {
    lines.push("release_date=" + metadata.release_date);
  }

  if (metadata.release_notes_path) {
    lines.push("release_notes_path=" + metadata.release_notes_path);
  }

  lines.push("");
  return lines.join("\n");
}

function extractVersionFromSource(sourceText) {
  const match = String(sourceText || "").match(
    /const HOODLEFINANCE_VERSION_ = "([^"]+)"/,
  );
  return match ? match[1] : "";
}

function replaceVersionInSource(sourceText, version) {
  if (!/const HOODLEFINANCE_VERSION_ = "[^"]+"/.test(sourceText)) {
    throw new Error(
      "Could not find HOODLEFINANCE_VERSION_ in hoodlefinance.js.",
    );
  }

  return sourceText.replace(
    /const HOODLEFINANCE_VERSION_ = "[^"]+"/,
    'const HOODLEFINANCE_VERSION_ = "' + version + '"',
  );
}

function parseFragmentFilename(fileName) {
  const match = FRAGMENT_FILENAME_PATTERN.exec(fileName);

  if (!match) {
    return null;
  }

  return {
    category: match[3],
    dateKey: match[1],
    slug: match[2],
  };
}

function loadReleaseFragments(changesDir) {
  const fragments = [];
  let entries;

  try {
    entries = fs.readdirSync(changesDir, { withFileTypes: true });
  } catch (error) {
    throw new Error(
      "Failed to read release fragments from " +
        changesDir +
        ".\n" +
        String(error && error.message ? error.message : error),
    );
  }

  entries.forEach(function (entry) {
    const parsed = parseFragmentFilename(entry.name);
    const fragmentPath = path.join(changesDir, entry.name);
    let content;

    if (entry.isDirectory()) {
      return;
    }

    if (IGNORED_CHANGE_FILES[entry.name]) {
      return;
    }

    if (!parsed) {
      throw new Error(
        "Invalid release fragment filename: " +
          entry.name +
          ". Expected YYYYMMDD-slug.<upgrade|added|changed|docs|fixed>.md.",
      );
    }

    content = fs.readFileSync(fragmentPath, "utf8").trim();

    if (!content) {
      throw new Error("Release fragment " + entry.name + " is empty.");
    }

    fragments.push({
      category: parsed.category,
      content: content,
      dateKey: parsed.dateKey,
      fileName: entry.name,
      path: fragmentPath,
      slug: parsed.slug,
    });
  });

  fragments.sort(function (left, right) {
    return left.fileName.localeCompare(right.fileName);
  });

  return fragments;
}

function groupFragmentsByCategory(fragments) {
  const grouped = {
    added: [],
    changed: [],
    docs: [],
    fixed: [],
    upgrade: [],
  };

  fragments.forEach(function (fragment) {
    grouped[fragment.category].push(fragment.content);
  });

  return grouped;
}

async function runReleaseFragmentCheck(options) {
  const normalizedOptions = options || {};
  const changesDir = normalizedOptions.changesDir || CHANGES_DIR;
  const cwd = normalizedOptions.cwd || ROOT_DIR;
  const runner = normalizedOptions.runCommand || runCommand;
  return runner("sh", [FRAGMENT_CHECKER_PATH, changesDir], { cwd: cwd });
}

async function verifyReleasePreparation(options) {
  const normalizedOptions = options || {};
  const cwd = normalizedOptions.cwd || ROOT_DIR;
  const runner = normalizedOptions.runCommand || runCommand;
  const steps = normalizedOptions.steps || DEFAULT_PREPARE_VERIFICATION_STEPS;
  let i;
  let step;

  for (i = 0; i < steps.length; i += 1) {
    step = steps[i];

    try {
      await runner(step.command, step.args, { cwd: cwd });
    } catch (error) {
      throw new Error(
        "Release verification failed during " +
          step.label +
          ".\n" +
          String(error && error.message ? error.message : error),
      );
    }
  }
}

function renderReleaseBody(grouped) {
  const parts = [];

  FRAGMENT_CATEGORIES.forEach(function (category) {
    if (!grouped[category] || !grouped[category].length) {
      return;
    }

    parts.push("### " + FRAGMENT_HEADING_BY_CATEGORY[category]);
    parts.push(grouped[category].join("\n"));
  });

  return parts.join("\n\n").trim();
}

function renderReleaseFile(version, releaseDate, grouped, templateText) {
  const template = String(templateText || DEFAULT_RELEASE_TEMPLATE);
  const releaseBody = renderReleaseBody(grouped);

  return (
    template
      .replace(/\{\{version\}\}/g, version)
      .replace(/\{\{release_date\}\}/g, releaseDate)
      .replace(/\{\{release_body\}\}/g, releaseBody)
      .replace(/\s+$/, "") + "\n"
  );
}

function parseReleaseFile(text, expectedVersion) {
  const normalized = String(text || "");
  const match = normalized.match(/^# v(\d+\.\d+\.\d+) - (\d{4}-\d{2}-\d{2})$/m);
  let version;

  if (!match) {
    throw new Error(
      "Release file is missing a '# vX.Y.Z - YYYY-MM-DD' heading.",
    );
  }

  version = match[1];

  if (expectedVersion && version !== expectedVersion) {
    throw new Error(
      "Release file version mismatch: expected v" +
        expectedVersion +
        " but found v" +
        version +
        ".",
    );
  }

  return {
    body: normalized.slice(match.index + match[0].length).trim(),
    date: match[2],
    fullText: normalized.trim(),
    version: version,
  };
}

function loadReleaseEntries(releasesDir) {
  let entries;
  const releases = [];

  try {
    entries = fs.readdirSync(releasesDir, { withFileTypes: true });
  } catch (error) {
    throw new Error(
      "Failed to read release files from " +
        releasesDir +
        ".\n" +
        String(error && error.message ? error.message : error),
    );
  }

  entries.forEach(function (entry) {
    const match = RELEASE_FILE_PATTERN.exec(entry.name);
    let parsed;

    if (entry.isDirectory() || !match) {
      return;
    }

    parsed = parseReleaseFile(
      readTextSync(path.join(releasesDir, entry.name), "release file"),
      match[1],
    );
    releases.push({
      body: parsed.body,
      date: parsed.date,
      fullText: parsed.fullText,
      version: parsed.version,
    });
  });

  releases.sort(function (left, right) {
    return compareVersions(right.version, left.version);
  });

  return releases;
}

function buildReleaseNotesPage(releases) {
  const parts = [RELEASE_NOTES_INTRO];

  releases.forEach(function (release) {
    parts.push("");
    parts.push("## v" + release.version + " - " + release.date);
    parts.push("");
    parts.push(release.body);
  });

  return parts.join("\n").trim() + "\n";
}

async function prepareRelease(version, options) {
  const normalizedOptions = options || {};
  const cwd = normalizedOptions.cwd || ROOT_DIR;
  const verifyRelease =
    normalizedOptions.verifyRelease || verifyReleasePreparation;
  const runner = normalizedOptions.runCommand || runCommand;
  const draft = await previewRelease(version, normalizedOptions);
  const releaseNotesPath = draft.releaseNotesPath;
  const releaseFilePath = draft.releaseFilePath;
  const scriptSourcePath = draft.scriptSourcePath;
  const versionMetadataPath = draft.versionMetadataPath;
  const scriptSourceText = draft.scriptSourceText;
  const releaseNotesRelativePath = draft.releaseNotesRelativePath;
  const releaseDate = draft.releaseDate;
  const grouped = draft.groupedFragments;
  const fragments = draft.fragments;
  const releasesDir = draft.releasesDir;
  let releaseEntries;

  await ensureCleanGitWorktree({
    cwd: cwd,
    runCommand: runner,
  });

  try {
    await writeText(releaseFilePath, draft.releaseFileText);
    await writeText(
      versionMetadataPath,
      renderVersionMetadata({
        release_date: releaseDate,
        release_notes_path: releaseNotesRelativePath,
        version: version,
      }),
    );
    await writeText(
      scriptSourcePath,
      replaceVersionInSource(scriptSourceText, version),
    );

    releaseEntries = loadReleaseEntries(releasesDir);
    await writeText(releaseNotesPath, buildReleaseNotesPage(releaseEntries));
    await verifyRelease({
      cwd: cwd,
      runCommand: runner,
    });
  } catch (error) {
    try {
      await restorePreparedReleaseStateWithGit({
        cwd: cwd,
        releaseFilePath: releaseFilePath,
        releaseNotesPath: releaseNotesPath,
        runCommand: runner,
        scriptSourcePath: scriptSourcePath,
        versionMetadataPath: versionMetadataPath,
      });
    } catch (cleanupError) {
      throw new Error(
        "Release preparation failed and git cleanup also failed.\n" +
          "Original error: " +
          String(error && error.message ? error.message : error) +
          "\nCleanup error: " +
          String(
            cleanupError && cleanupError.message
              ? cleanupError.message
              : cleanupError,
          ),
      );
    }

    throw error;
  }

  await Promise.all(
    fragments.map(function (fragment) {
      return fsp.unlink(fragment.path);
    }),
  );

  return {
    fragmentCount: fragments.length,
    fragments: fragments,
    groupedFragments: grouped,
    releaseDate: releaseDate,
    releaseFileText: draft.releaseFileText,
    releaseFilePath: releaseFilePath,
    version: version,
  };
}

async function previewRelease(version, options) {
  const normalizedOptions = options || {};
  const cwd = normalizedOptions.cwd || ROOT_DIR;
  const changesDir = normalizedOptions.changesDir || CHANGES_DIR;
  const releaseDate =
    normalizedOptions.releaseDate || new Date().toISOString().slice(0, 10);
  const releaseNotesPath =
    normalizedOptions.releaseNotesPath || RELEASE_NOTES_PATH;
  const releasesDir = normalizedOptions.releasesDir || RELEASES_DIR;
  const releaseTemplatePath =
    normalizedOptions.releaseTemplatePath || RELEASE_TEMPLATE_PATH;
  const scriptSourcePath =
    normalizedOptions.scriptSourcePath || SCRIPT_SOURCE_PATH;
  const versionMetadataPath =
    normalizedOptions.versionMetadataPath || VERSION_METADATA_PATH;
  const runner = normalizedOptions.runCommand || runCommand;
  const versionMetadata = readVersionMetadata(versionMetadataPath);
  const scriptSourceText = readTextSync(
    scriptSourcePath,
    "hoodlefinance source",
  );
  const releaseTemplateText = readTextSync(
    releaseTemplatePath,
    "release template",
  );
  const currentScriptVersion = extractVersionFromSource(scriptSourceText);
  const releaseNotesRelativePath = buildReleaseNotesRelativePath(version);
  const releaseFilePath = buildReleaseFilePath(releasesDir, version);
  let fragments;
  let grouped;

  validateVersion(version);

  await runReleaseFragmentCheck({
    changesDir: changesDir,
    cwd: cwd,
    runCommand: runner,
  });

  fragments = loadReleaseFragments(changesDir);
  grouped = groupFragmentsByCategory(fragments);

  if (!fragments.length) {
    throw new Error("No release fragments were found in changes.d/.");
  }

  if (compareVersions(version, versionMetadata.version) <= 0) {
    throw new Error(
      "Target release version must be greater than the current version " +
        versionMetadata.version +
        ".",
    );
  }

  if (currentScriptVersion !== versionMetadata.version) {
    throw new Error(
      "hoodlefinance.js is out of sync with version.properties. Expected " +
        versionMetadata.version +
        " but found " +
        (currentScriptVersion || "(missing)") +
        ".",
    );
  }

  if (fs.existsSync(releaseFilePath)) {
    throw new Error("Release notes already contain v" + version + ".");
  }

  return {
    fragmentCount: fragments.length,
    fragments: fragments,
    groupedFragments: grouped,
    releaseDate: releaseDate,
    releaseFilePath: releaseFilePath,
    releaseFileText: renderReleaseFile(
      version,
      releaseDate,
      grouped,
      releaseTemplateText,
    ),
    releaseNotesPath: releaseNotesPath,
    releaseNotesRelativePath: releaseNotesRelativePath,
    releasesDir: releasesDir,
    scriptSourcePath: scriptSourcePath,
    scriptSourceText: scriptSourceText,
    version: version,
    versionMetadataPath: versionMetadataPath,
  };
}

async function runCommand(command, args, options) {
  const normalizedOptions = options || {};

  return new Promise(function (resolve, reject) {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      cwd: normalizedOptions.cwd || ROOT_DIR,
      stdio: "pipe",
    });

    if (normalizedOptions.input) {
      child.stdin.end(normalizedOptions.input);
    } else {
      child.stdin.end();
    }

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

async function publishRelease(version, options) {
  const normalizedOptions = options || {};
  const releaseNotesPath =
    normalizedOptions.releaseNotesPath || RELEASE_NOTES_PATH;
  const releasesDir = normalizedOptions.releasesDir || RELEASES_DIR;
  const scriptSourcePath =
    normalizedOptions.scriptSourcePath || SCRIPT_SOURCE_PATH;
  const versionMetadataPath =
    normalizedOptions.versionMetadataPath || VERSION_METADATA_PATH;
  const runner = normalizedOptions.runCommand || runCommand;
  const releaseFilePath =
    normalizedOptions.releaseFilePath ||
    buildReleaseFilePath(releasesDir, version);
  const tagName = "v" + version;
  const versionMetadata = readVersionMetadata(versionMetadataPath);
  const scriptSourceText = readTextSync(
    scriptSourcePath,
    "hoodlefinance source",
  );
  const releaseNotesText = readTextSync(releaseNotesPath, "release notes");
  let gitStatus;
  let existingTag;

  validateVersion(version);

  if (versionMetadata.version !== version) {
    throw new Error(
      "version.properties must point to " + version + " before publishing.",
    );
  }

  if (extractVersionFromSource(scriptSourceText) !== version) {
    throw new Error(
      "hoodlefinance.js must already be stamped to " +
        version +
        " before publishing.",
    );
  }

  if (!fs.existsSync(releaseFilePath)) {
    throw new Error("Per-release notes do not exist for v" + version + ".");
  }

  if (
    !new RegExp("^## v" + version.replace(/\./g, "\\.") + " - ", "m").test(
      releaseNotesText,
    )
  ) {
    throw new Error("RELEASE_NOTES.md does not contain v" + version + ".");
  }

  try {
    gitStatus = await runner("git", ["status", "--short"], {
      cwd: normalizedOptions.cwd || ROOT_DIR,
    });
  } catch (error) {
    throw new Error(
      "Failed to inspect git status before publishing v" +
        version +
        ".\n" +
        String(error && error.message ? error.message : error),
    );
  }

  if (String(gitStatus.stdout || "").trim()) {
    throw new Error("Git working tree must be clean before publishing.");
  }

  try {
    existingTag = await runner("git", ["tag", "--list", tagName], {
      cwd: normalizedOptions.cwd || ROOT_DIR,
    });
  } catch (error) {
    throw new Error(
      "Failed to inspect existing git tags before publishing v" +
        version +
        ".\n" +
        String(error && error.message ? error.message : error),
    );
  }

  if (String(existingTag.stdout || "").trim() === tagName) {
    throw new Error("Git tag " + tagName + " already exists.");
  }

  try {
    await runner("git", ["tag", "-a", tagName, "-m", "Release " + tagName], {
      cwd: normalizedOptions.cwd || ROOT_DIR,
    });
    await runner("git", ["push", "origin", "HEAD"], {
      cwd: normalizedOptions.cwd || ROOT_DIR,
    });
    await runner("git", ["push", "origin", tagName], {
      cwd: normalizedOptions.cwd || ROOT_DIR,
    });
    await runner(
      "gh",
      [
        "release",
        "create",
        tagName,
        "--title",
        tagName,
        "--notes-file",
        releaseFilePath,
      ],
      {
        cwd: normalizedOptions.cwd || ROOT_DIR,
      },
    );
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error("GitHub CLI (gh) is required to publish a release.");
    }

    if (
      /not logged in|authentication/i.test(
        String(error && error.stderr ? error.stderr : error),
      )
    ) {
      throw new Error(
        "GitHub CLI must be authenticated before publishing a release.",
      );
    }

    throw new Error(
      "Failed to publish release v" +
        version +
        ".\n" +
        String(error && error.message ? error.message : error),
    );
  }

  return {
    releaseFilePath: releaseFilePath,
    tagName: tagName,
    version: version,
  };
}

module.exports = {
  CHANGES_DIR,
  DEFAULT_PREPARE_VERIFICATION_STEPS,
  FRAGMENT_CATEGORIES,
  FRAGMENT_HEADING_BY_CATEGORY,
  RELEASE_NOTES_INTRO,
  RELEASE_NOTES_PATH,
  RELEASES_DIR,
  RELEASE_TEMPLATE_PATH,
  SCRIPT_SOURCE_PATH,
  VERSION_METADATA_PATH,
  buildReleaseFilePath,
  buildReleaseNotesPage,
  buildReleaseNotesRelativePath,
  compareVersions,
  ensureCleanGitWorktree,
  extractVersionFromSource,
  groupFragmentsByCategory,
  loadReleaseEntries,
  loadReleaseFragments,
  parseArgs,
  parseReleaseFile,
  parseVersionMetadataText,
  prepareRelease,
  previewRelease,
  publishRelease,
  readVersionMetadata,
  restorePreparedReleaseStateWithGit,
  renderReleaseBody,
  renderReleaseFile,
  renderVersionMetadata,
  runReleaseFragmentCheck,
  toGitRelativePath,
  replaceVersionInSource,
  runCommand,
  validateVersion,
  verifyReleasePreparation,
};

if (require.main === module) {
  main().catch(function (error) {
    process.stderr.write(
      String(error && error.stack ? error.stack : error) + "\n",
    );
    process.exitCode = 1;
  });
}
