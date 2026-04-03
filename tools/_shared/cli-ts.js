#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

const cli = require("../../dist/ts/hoodlefinance.js");

if (require.main === module) {
  cli.main(process.argv.slice(2));
}

module.exports = cli;
