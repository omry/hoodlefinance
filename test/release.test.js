const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const {
  DEFAULT_PREPARE_VERIFICATION_STEPS,
  buildReleaseNotesPage,
  buildReleaseNotesRelativePath,
  checkReleaseFragments,
  loadReleaseEntries,
  loadReleaseFragments,
  parseArgs,
  parseReleaseFile,
  parseVersionMetadataText,
  prepareRelease,
  publishRelease,
  renderReleaseBody,
  renderReleaseFile,
  renderVersionMetadata,
  upsertCurrentReleaseNotesLine,
  validateReleaseFragmentContent,
  replaceCurrentVersionLine,
  replaceVersionInSource,
  validateVersion,
} = require("../tools/release.js");

function runGit(rootDir, args) {
  execFileSync("git", args, {
    cwd: rootDir,
    stdio: "ignore",
  });
}

function commitAll(rootDir, message) {
  runGit(rootDir, ["add", "."]);
  runGit(rootDir, ["commit", "-m", message]);
}

function createFixtureRepo() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "hoodlefinance-release-"));
  const changesDir = path.join(rootDir, "changes.d");
  const docsDir = path.join(rootDir, "docs");
  const releasesDir = path.join(docsDir, "release-notes");
  const scriptSourcePath = path.join(rootDir, "hoodlefinance.js");
  const readmePath = path.join(rootDir, "README.md");
  const apiDocPath = path.join(docsDir, "hoodlefinance-api.md");
  const releaseNotesPath = path.join(releasesDir, "RELEASE_NOTES.md");
  const releaseTemplatePath = path.join(releasesDir, "TEMPLATE.md");
  const versionMetadataPath = path.join(rootDir, "version.properties");

  fs.mkdirSync(changesDir, { recursive: true });
  fs.mkdirSync(releasesDir, { recursive: true });
  fs.writeFileSync(path.join(changesDir, "README.md"), "# Release fragments\n", "utf8");
  fs.writeFileSync(scriptSourcePath, 'const HOODLEFINANCE_VERSION_ = "0.2.5";\n', "utf8");
  fs.writeFileSync(readmePath, "# HOODLEFINANCE\n\nCurrent script version: `0.2.5`\n", "utf8");
  fs.writeFileSync(apiDocPath, "# API\n\nCurrent script version: `0.2.5`\n", "utf8");
  fs.writeFileSync(releaseTemplatePath, "# v{{version}} - {{release_date}}\n\n{{release_body}}\n", "utf8");
  fs.writeFileSync(
    versionMetadataPath,
    renderVersionMetadata({ version: "0.2.5" }),
    "utf8"
  );
  fs.writeFileSync(
    releaseNotesPath,
    buildReleaseNotesPage(loadReleaseEntries(releasesDir)),
    "utf8"
  );
  runGit(rootDir, ["init"]);
  runGit(rootDir, ["config", "user.email", "test@example.com"]);
  runGit(rootDir, ["config", "user.name", "Test User"]);
  commitAll(rootDir, "Initial fixture");

  return {
    apiDocPath,
    changesDir,
    cwd: rootDir,
    readmePath,
    releaseNotesPath,
    releaseTemplatePath,
    releasesDir,
    rootDir,
    scriptSourcePath,
    versionMetadataPath,
  };
}

test("parseArgs validates the supported release commands", function () {
  assert.deepEqual(parseArgs(["check-fragments"]), {
    command: "check-fragments",
  });
  assert.deepEqual(parseArgs(["prepare", "1.2.3"]), {
    command: "prepare",
    version: "1.2.3",
  });
  assert.deepEqual(parseArgs(["publish", "2.0.0"]), {
    command: "publish",
    version: "2.0.0",
  });
  assert.throws(function () {
    parseArgs(["prepare"]);
  }, /Usage/);
  assert.throws(function () {
    parseArgs(["check-fragments", "1.2.3"]);
  }, /Usage/);
  assert.throws(function () {
    parseArgs(["draft-github", "1.2.3"]);
  }, /Unknown release command/);
});

test("validateVersion rejects invalid release numbers", function () {
  assert.doesNotThrow(function () {
    validateVersion("1.2.3");
  });
  assert.throws(function () {
    validateVersion("1.2");
  }, /x\.y\.z/);
});

test("parseVersionMetadataText reads the version source-of-truth file", function () {
  const metadata = parseVersionMetadataText(
    [
      "# Release metadata",
      "version=0.2.5",
      "",
    ].join("\n")
  );

  assert.deepEqual(metadata, { version: "0.2.5" });
});

test("renderReleaseBody keeps the configured section order", function () {
  const body = renderReleaseBody({
    added: ["- Added feature"],
    changed: ["- Changed behavior"],
    fixed: ["- Fixed bug"],
    upgrade: ["- Upgrade note"],
  });

  assert.match(body, /### Upgrade Notes[\s\S]*### Added[\s\S]*### Changed[\s\S]*### Fixed/);
});

test("renderReleaseBody keeps validated bullets as a tight list", function () {
  const body = renderReleaseBody({
    added: ["- Added one", "- Added two"],
    changed: [],
    fixed: [],
    upgrade: [],
  });

  assert.equal(body, ["### Added", "", "- Added one", "- Added two"].join("\n"));
});

test("buildReleaseNotesPage renders release links in reverse version order", function () {
  const notes = buildReleaseNotesPage([
    {
      body: "### Added\n\n- New release",
      date: "2026-03-16",
      version: "0.2.6",
    },
    {
      body: "### Added\n\n- Existing release",
      date: "2026-03-15",
      version: "0.2.5",
    },
  ]);

  assert.match(notes, /## v0\.2\.6 - 2026-03-16[\s\S]*## v0\.2\.5 - 2026-03-15/);
});

test("loadReleaseFragments rejects invalid filenames", function () {
  const fixture = createFixtureRepo();

  fs.writeFileSync(path.join(fixture.changesDir, "bad-name.md"), "oops\n", "utf8");

  assert.throws(function () {
    loadReleaseFragments(fixture.changesDir);
  }, /Invalid release fragment filename/);
});

test("checkReleaseFragments validates fragments without mutating them", function () {
  const fixture = createFixtureRepo();

  fs.writeFileSync(path.join(fixture.changesDir, "20260316-one.added.md"), "- Added thing\n", "utf8");
  fs.writeFileSync(path.join(fixture.changesDir, "20260316-two.fixed.md"), "- Fixed thing\n", "utf8");

  const result = checkReleaseFragments({ changesDir: fixture.changesDir });

  assert.equal(result.fragmentCount, 2);
  assert.equal(result.groupedFragments.added.length, 1);
  assert.equal(result.groupedFragments.fixed.length, 1);
  assert.equal(fs.existsSync(path.join(fixture.changesDir, "20260316-one.added.md")), true);
  assert.equal(fs.existsSync(path.join(fixture.changesDir, "20260316-two.fixed.md")), true);
});

test("checkReleaseFragments rejects paragraph-style fragments", function () {
  const fixture = createFixtureRepo();

  fs.writeFileSync(path.join(fixture.changesDir, "20260316-one.added.md"), "Added thing\n", "utf8");

  assert.throws(function () {
    checkReleaseFragments({ changesDir: fixture.changesDir });
  }, /must start with a single '- ' bullet line/);
});

test("checkReleaseFragments rejects fragments with multiple top-level bullets", function () {
  const fixture = createFixtureRepo();

  fs.writeFileSync(
    path.join(fixture.changesDir, "20260316-one.added.md"),
    "- Added thing\n- Added another thing\n",
    "utf8"
  );

  assert.throws(function () {
    checkReleaseFragments({ changesDir: fixture.changesDir });
  }, /must contain exactly one top-level bullet/);
});

test("validateReleaseFragmentContent accepts a single bullet fragment", function () {
  assert.doesNotThrow(function () {
    validateReleaseFragmentContent({
      content: "- Added thing",
      fileName: "20260316-one.added.md",
    });
  });
});

test("validateReleaseFragmentContent accepts indented sub-bullets under one top-level bullet", function () {
  assert.doesNotThrow(function () {
    validateReleaseFragmentContent({
      content: [
        "- Added thing",
        "  - More detail",
        "  - Another detail",
      ].join("\n"),
      fileName: "20260316-one.added.md",
    });
  });
});

test("validateReleaseFragmentContent accepts continuation text under one top-level bullet", function () {
  assert.doesNotThrow(function () {
    validateReleaseFragmentContent({
      content: [
        "- Added thing",
        "  With a little more explanation for readers.",
      ].join("\n"),
      fileName: "20260316-one.added.md",
    });
  });
});

test("prepareRelease fails when there are no release fragments", async function () {
  const fixture = createFixtureRepo();

  await assert.rejects(
    prepareRelease("0.2.6", fixture),
    /No release fragments/
  );
});

test("prepareRelease rejects non-incrementing versions and duplicate release files", async function () {
  const fixture = createFixtureRepo();

  fs.writeFileSync(path.join(fixture.changesDir, "20260316-example.added.md"), "- Added thing\n", "utf8");
  commitAll(fixture.rootDir, "Add release fragment");

  await assert.rejects(
    prepareRelease("0.2.5", fixture),
    /greater than the current version/
  );

  fs.writeFileSync(path.join(fixture.releasesDir, "v0.2.6.md"), "# v0.2.6 - 2026-03-16\n\n### Added\n\n- Existing entry\n", "utf8");

  await assert.rejects(
    prepareRelease("0.2.6", fixture),
    /Release notes already contain v0\.2\.6/
  );
});

test("prepareRelease updates metadata, creates a per-release file, rebuilds the full history file, and consumes fragments", async function () {
  const fixture = createFixtureRepo();
  let verifyCalls = 0;

  fs.writeFileSync(path.join(fixture.changesDir, "20260316-upgrade.upgrade.md"), "- Review the new release notes before updating.\n", "utf8");
  fs.writeFileSync(path.join(fixture.changesDir, "20260316-market.added.md"), "- Added broader market coverage examples.\n", "utf8");
  fs.writeFileSync(path.join(fixture.changesDir, "20260316-wording.changed.md"), "- Improved update messaging in Sheets.\n", "utf8");
  commitAll(fixture.rootDir, "Add release fragments");

  await prepareRelease("0.2.6", Object.assign({}, fixture, {
    releaseDate: "2026-03-16",
    verifyRelease: async function () {
      verifyCalls += 1;
    },
  }));

  assert.equal(verifyCalls, 1);
  assert.match(fs.readFileSync(fixture.versionMetadataPath, "utf8"), /version=0\.2\.6/);
  assert.match(fs.readFileSync(fixture.versionMetadataPath, "utf8"), /release_notes_path=docs\/release-notes\/v0\.2\.6\.md/);
  assert.match(fs.readFileSync(fixture.versionMetadataPath, "utf8"), /release_date=2026-03-16/);
  assert.match(fs.readFileSync(fixture.scriptSourcePath, "utf8"), /HOODLEFINANCE_VERSION_ = "0\.2\.6"/);
  assert.match(fs.readFileSync(fixture.readmePath, "utf8"), /Current script version: `0\.2\.6`/);
  assert.match(fs.readFileSync(fixture.readmePath, "utf8"), /Current release notes: \[`docs\/release-notes\/v0\.2\.6\.md`\]\(\.\/docs\/release-notes\/v0\.2\.6\.md\)/);
  assert.match(fs.readFileSync(fixture.apiDocPath, "utf8"), /Current script version: `0\.2\.6`/);
  assert.match(fs.readFileSync(fixture.apiDocPath, "utf8"), /Current release notes: \[`release-notes\/v0\.2\.6\.md`\]\(\.\/release-notes\/v0\.2\.6\.md\)/);
  assert.match(
    fs.readFileSync(path.join(fixture.releasesDir, "v0.2.6.md"), "utf8"),
    /# v0\.2\.6 - 2026-03-16[\s\S]*### Upgrade Notes[\s\S]*### Added[\s\S]*### Changed/
  );
  assert.match(
    fs.readFileSync(fixture.releaseNotesPath, "utf8"),
    /## v0\.2\.6 - 2026-03-16[\s\S]*### Upgrade Notes/
  );
  assert.equal(fs.existsSync(path.join(fixture.changesDir, "20260316-upgrade.upgrade.md")), false);
  assert.equal(fs.existsSync(path.join(fixture.changesDir, "20260316-market.added.md")), false);
  assert.equal(fs.existsSync(path.join(fixture.changesDir, "20260316-wording.changed.md")), false);
});

test("prepareRelease rolls back generated files and preserves fragments when verification fails", async function () {
  const fixture = createFixtureRepo();

  fs.writeFileSync(path.join(fixture.changesDir, "20260316-market.added.md"), "- Added broader market coverage examples.\n", "utf8");
  commitAll(fixture.rootDir, "Add release fragment");

  await assert.rejects(
    prepareRelease("0.2.6", Object.assign({}, fixture, {
      releaseDate: "2026-03-16",
      verifyRelease: async function () {
        throw new Error("verification failed");
      },
    })),
    /verification failed/
  );

  assert.equal(fs.readFileSync(fixture.versionMetadataPath, "utf8"), renderVersionMetadata({ version: "0.2.5" }));
  assert.equal(fs.readFileSync(fixture.scriptSourcePath, "utf8"), 'const HOODLEFINANCE_VERSION_ = "0.2.5";\n');
  assert.equal(fs.readFileSync(fixture.readmePath, "utf8"), "# HOODLEFINANCE\n\nCurrent script version: `0.2.5`\n");
  assert.equal(fs.readFileSync(fixture.apiDocPath, "utf8"), "# API\n\nCurrent script version: `0.2.5`\n");
  assert.equal(fs.readFileSync(fixture.releaseNotesPath, "utf8"), buildReleaseNotesPage(loadReleaseEntries(fixture.releasesDir)));
  assert.equal(fs.existsSync(path.join(fixture.releasesDir, "v0.2.6.md")), false);
  assert.equal(fs.existsSync(path.join(fixture.changesDir, "20260316-market.added.md")), true);
});

test("prepareRelease rejects a dirty git worktree before writing release files", async function () {
  const fixture = createFixtureRepo();

  fs.writeFileSync(path.join(fixture.changesDir, "20260316-market.added.md"), "- Added broader market coverage examples.\n", "utf8");

  await assert.rejects(
    prepareRelease("0.2.6", Object.assign({}, fixture, {
      releaseDate: "2026-03-16",
      verifyRelease: async function () {
        throw new Error("verify should not run");
      },
    })),
    /Git working tree must be clean before preparing a release/
  );

  assert.equal(fs.existsSync(path.join(fixture.releasesDir, "v0.2.6.md")), false);
  assert.equal(fs.readFileSync(fixture.versionMetadataPath, "utf8"), renderVersionMetadata({ version: "0.2.5" }));
});

test("renderReleaseFile applies the release template placeholders", function () {
  const text = renderReleaseFile("0.9.0", "2026-04-01", {
    added: ["- Added thing"],
    changed: [],
    fixed: [],
    upgrade: [],
  }, "# Release {{version}}\nDate: {{release_date}}\n\n{{release_body}}\n");

  assert.match(text, /# Release 0\.9\.0/);
  assert.match(text, /Date: 2026-04-01/);
  assert.match(text, /### Added/);
});

test("parseReleaseFile returns the body for a specific per-release note file", function () {
  const body = parseReleaseFile(
    [
      "# v0.2.6 - 2026-03-16",
      "",
      "### Added",
      "",
      "- Added thing",
      "",
    ].join("\n"),
    "0.2.6"
  );

  assert.equal(body.date, "2026-03-16");
  assert.match(body.body, /### Added/);
});

test("publishRelease tags, pushes, and creates a GitHub release from the per-release notes", async function () {
  const fixture = createFixtureRepo();
  const calls = [];

  fs.writeFileSync(
    fixture.versionMetadataPath,
    renderVersionMetadata({
      release_date: "2026-03-16",
      release_notes_path: buildReleaseNotesRelativePath("0.2.6"),
      version: "0.2.6",
    }),
    "utf8"
  );
  fs.writeFileSync(fixture.scriptSourcePath, 'const HOODLEFINANCE_VERSION_ = "0.2.6";\n', "utf8");
  fs.writeFileSync(
    fixture.releaseNotesPath,
    [
      "# Release Notes",
      "",
      "## v0.2.6 - 2026-03-16",
      "",
      "### Added",
      "",
      "- Added thing",
      "",
    ].join("\n"),
    "utf8"
  );
  fs.writeFileSync(
    path.join(fixture.releasesDir, "v0.2.6.md"),
    [
      "# v0.2.6 - 2026-03-16",
      "",
      "### Added",
      "",
      "- Added thing",
      "",
    ].join("\n"),
    "utf8"
  );

  await publishRelease("0.2.6", Object.assign({}, fixture, {
    runCommand: async function (command, args, options) {
      calls.push({ args, command, options });
      if (command === "git" && args[0] === "status") {
        return { stderr: "", stdout: "" };
      }
      if (command === "git" && args[0] === "tag" && args[1] === "--list") {
        return { stderr: "", stdout: "" };
      }
      return { stderr: "", stdout: "" };
    },
  }));

  assert.deepEqual(calls.map(function (call) { return [call.command].concat(call.args); }), [
    ["git", "status", "--short"],
    ["git", "tag", "--list", "v0.2.6"],
    ["git", "tag", "-a", "v0.2.6", "-m", "Release v0.2.6"],
    ["git", "push", "origin", "HEAD"],
    ["git", "push", "origin", "v0.2.6"],
    ["gh", "release", "create", "v0.2.6", "--title", "v0.2.6", "--notes-file", path.join(fixture.releasesDir, "v0.2.6.md")],
  ]);
});

test("verifyReleasePreparation runs the expected verification steps", async function () {
  const seen = [];

  await require("../tools/release.js").verifyReleasePreparation({
    cwd: "/tmp/demo",
    runCommand: async function (command, args, options) {
      seen.push({ args, command, options });
      return { stderr: "", stdout: "" };
    },
  });

  assert.deepEqual(
    seen.map(function (call) {
      return {
        args: call.args,
        command: call.command,
        cwd: call.options.cwd,
      };
    }),
    DEFAULT_PREPARE_VERIFICATION_STEPS.map(function (step) {
      return {
        args: step.args,
        command: step.command,
        cwd: "/tmp/demo",
      };
    })
  );
});

test("publishRelease rejects a dirty git worktree", async function () {
  const fixture = createFixtureRepo();

  fs.writeFileSync(
    fixture.versionMetadataPath,
    renderVersionMetadata({
      release_date: "2026-03-16",
      release_notes_path: buildReleaseNotesRelativePath("0.2.6"),
      version: "0.2.6",
    }),
    "utf8"
  );
  fs.writeFileSync(fixture.scriptSourcePath, 'const HOODLEFINANCE_VERSION_ = "0.2.6";\n', "utf8");
  fs.writeFileSync(
    fixture.releaseNotesPath,
    [
      "# Release Notes",
      "",
      "## v0.2.6 - 2026-03-16",
      "",
      "### Added",
      "",
      "- Added thing",
      "",
    ].join("\n"),
    "utf8"
  );
  fs.writeFileSync(
    path.join(fixture.releasesDir, "v0.2.6.md"),
    [
      "# v0.2.6 - 2026-03-16",
      "",
      "### Added",
      "",
      "- Added thing",
      "",
    ].join("\n"),
    "utf8"
  );

  await assert.rejects(
    publishRelease("0.2.6", Object.assign({}, fixture, {
      runCommand: async function (command, args) {
        if (command === "git" && args[0] === "status") {
          return { stderr: "", stdout: " M hoodlefinance.js\n" };
        }

        throw new Error("Should not reach later publish commands");
      },
    })),
    /Git working tree must be clean/
  );
});

test("publishRelease reports missing gh with a clearer message", async function () {
  const fixture = createFixtureRepo();

  fs.writeFileSync(
    fixture.versionMetadataPath,
    renderVersionMetadata({
      release_date: "2026-03-16",
      release_notes_path: buildReleaseNotesRelativePath("0.2.6"),
      version: "0.2.6",
    }),
    "utf8"
  );
  fs.writeFileSync(fixture.scriptSourcePath, 'const HOODLEFINANCE_VERSION_ = "0.2.6";\n', "utf8");
  fs.writeFileSync(
    fixture.releaseNotesPath,
    [
      "# Release Notes",
      "",
      "## v0.2.6 - 2026-03-16",
      "",
      "### Fixed",
      "",
      "- Fixed thing",
      "",
    ].join("\n"),
    "utf8"
  );
  fs.writeFileSync(
    path.join(fixture.releasesDir, "v0.2.6.md"),
    [
      "# v0.2.6 - 2026-03-16",
      "",
      "### Fixed",
      "",
      "- Fixed thing",
      "",
    ].join("\n"),
    "utf8"
  );

  await assert.rejects(
    publishRelease("0.2.6", Object.assign({}, fixture, {
      runCommand: async function (command, args) {
        if (command === "git" && args[0] === "status") {
          return { stderr: "", stdout: "" };
        }
        if (command === "git" && args[0] === "tag" && args[1] === "--list") {
          return { stderr: "", stdout: "" };
        }
        if (command === "git") {
          return { stderr: "", stdout: "" };
        }
        const error = new Error("spawn gh ENOENT");
        error.code = "ENOENT";
        throw error;
      },
    })),
    /GitHub CLI \(gh\) is required/
  );
});

test("replace helpers update the expected version strings", function () {
  assert.equal(
    replaceVersionInSource('const HOODLEFINANCE_VERSION_ = "0.2.5";\n', "0.2.6"),
    'const HOODLEFINANCE_VERSION_ = "0.2.6";\n'
  );
  assert.equal(
    replaceCurrentVersionLine("Current script version: `0.2.5`\n", "0.2.6", "README.md"),
    "Current script version: `0.2.6`\n"
  );
  assert.equal(
    upsertCurrentReleaseNotesLine(
      "Current release notes: [`docs/release-notes/v0.2.5.md`](./docs/release-notes/v0.2.5.md)\n",
      "Current release notes: [`docs/release-notes/v0.2.6.md`](./docs/release-notes/v0.2.6.md)",
      "README.md"
    ),
    "Current release notes: [`docs/release-notes/v0.2.6.md`](./docs/release-notes/v0.2.6.md)\n"
  );
  assert.equal(
    upsertCurrentReleaseNotesLine(
      "Current script version: `0.2.6`\n",
      "Current release notes: [`docs/release-notes/v0.9.0.md`](./docs/release-notes/v0.9.0.md)",
      "README.md"
    ),
    "Current script version: `0.2.6`\nCurrent release notes: [`docs/release-notes/v0.9.0.md`](./docs/release-notes/v0.9.0.md)\n"
  );
});
