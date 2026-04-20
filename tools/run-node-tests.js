const { spawnSync } = require("node:child_process");

const defaultTestTargets = [
  "test/*.test.js",
  "test-ts/*.test.js",
  "test-ts/core-flow/*.test.js",
];

const forwardedArgs = process.argv.slice(2);
const testArgs = forwardedArgs.length > 0 ? forwardedArgs : defaultTestTargets;

const result = spawnSync(process.execPath, ["--test", ...testArgs], {
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);