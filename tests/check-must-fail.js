#!/usr/bin/env node
'use strict';

// Runs the scenarios of tests/must-fail/ and checks that every one of them
// FAILS, at its last step, with the message its description announces
// ("Fails with: ..."), and that the message carries a hint.
//
// A step that cannot fail proves nothing. Each scenario here asserts something
// that is not true on the test shop; the steps before the last one must pass.
// They carry the tag @must-fail, which the default run of cucumber.js leaves
// out. A few of them place an order to have something to fail on (an order's
// status, its mail): the scenarios tagged @must-fail-cleanup run afterwards,
// must pass, and delete those orders again, so the run leaves the shop as it
// found it.
//
// MUST_FAIL_TAGS narrows the run to a lane (a tag expression); the default runs
// every must-fail scenario.
//
// Usage: node tests/check-must-fail.js   (the shop of cucumber.js must be up)

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const lane = process.env.MUST_FAIL_TAGS || 'not @wip';
const features = fs.readdirSync(path.join(root, 'tests', 'must-fail')).filter((file) => file.endsWith('.feature')).map((file) => `tests/must-fail/${file}`);

/** One run of cucumber-js on the must-fail features, with a tag expression and a report of its own. */
function run(tags, name) {
  const report = path.join(root, 'tests', 'reports', `${name}.json`);
  fs.rmSync(report, { force: true });
  spawnSync('npx', ['cucumber-js', '--config', 'cucumber.js'], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, FEATURES: features.join(','), CUCUMBER_TAGS: tags, REPORT_NAME: name, WEBSHIP_REPORT_DISABLE: '1', WEBSHIP_SCREENSHOT_ON_FAILED: 'false' },
  });
  if (!fs.existsSync(report)) {
    console.error(`The run of ${tags} wrote no report: cucumber-js did not start.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(report, 'utf8'));
}

const strip = (text) => String(text || '').replace(/\u001b\[[0-9;]*m/g, '');
const problems = [];
let count = 0;
for (const feature of run(`@must-fail and not @must-fail-cleanup and (${lane})`, 'must-fail')) {
  for (const scenario of feature.elements || []) {
    count += 1;
    const where = `${feature.uri}:${scenario.line} "${scenario.name}"`;
    const wanted = (strip(scenario.description).match(/Fails with:\s*(.+)/) || [])[1];
    const steps = (scenario.steps || []).filter((step) => !step.hidden);
    const last = steps[steps.length - 1];
    const earlier = steps.slice(0, -1).filter((step) => step.result.status !== 'passed');
    if (!wanted) { problems.push(`${where}: no "Fails with:" line in its description.`); continue; }
    if (earlier.length) { problems.push(`${where}: an earlier step did not pass (${earlier[0].keyword}${earlier[0].name}: ${earlier[0].result.status}) ${strip(earlier[0].result.error_message).split('\n')[0]}`); continue; }
    if (!last || last.result.status !== 'failed') { problems.push(`${where}: its last step ${last ? last.result.status : 'is missing'}; it must fail.`); continue; }
    const message = strip(last.result.error_message);
    if (!message.includes(wanted.trim())) { problems.push(`${where}: failed, but not with "${wanted.trim()}":\n      ${message.split('\n').slice(0, 3).join('\n      ')}`); continue; }
    if (!/Hint:/.test(message)) { problems.push(`${where}: the failure carries no hint:\n      ${message.split('\n')[0]}`); continue; }
    console.log(`  fails as it must: ${scenario.name}\n      ${message.split('\n')[0].trim()}`);
  }
}

// The cleanup: every scenario must pass.
let cleaned = 0;
for (const feature of run(`@must-fail-cleanup and (${lane})`, 'must-fail-cleanup')) {
  for (const scenario of feature.elements || []) {
    cleaned += 1;
    const failed = (scenario.steps || []).filter((step) => !step.hidden && step.result.status !== 'passed');
    if (failed.length) problems.push(`${feature.uri}:${scenario.line} "${scenario.name}": the cleanup did not pass (${failed[0].keyword}${failed[0].name}: ${failed[0].result.status}) ${strip(failed[0].result.error_message).split('\n')[0]}`);
  }
}

if (!count) problems.push(`No must-fail scenario ran (${lane}).`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s) in ${count} must-fail scenario(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`\n${count} must-fail scenarios (${lane}), each failed at its last step with the announced message and a hint${cleaned ? `; ${cleaned} cleanup scenario(s) passed` : ''}.`);
