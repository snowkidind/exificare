#!/usr/bin/env node

import chalk from 'chalk';
import { createInterface } from 'readline';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join, resolve, dirname } from 'path';
import { homedir } from 'os';
import { access, readdir } from 'fs/promises';
import { constants } from 'fs';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const EXIFICARE = join(__dirname, 'exificare.js');

const BANNER = chalk.cyan(
`░▒▓████████▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓████████▓▒░▒▓█▓▒░░▒▓██████▓▒░ ░▒▓██████▓▒░░▒▓███████▓▒░░▒▓████████▓▒░
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░
░▒▓██████▓▒░  ░▒▓██████▓▒░░▒▓█▓▒░▒▓██████▓▒░ ░▒▓█▓▒░▒▓█▓▒░      ░▒▓████████▓▒░▒▓███████▓▒░░▒▓██████▓▒░
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░
░▒▓████████▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓████████▓▒░`
);

// --- Readline helpers ---

let rl;

function initRL() {
  rl = createInterface({ input: process.stdin, output: process.stdout });
}

function ask(question) {
  return new Promise(res => {
    rl.question(chalk.white(question), answer => res(answer.trim()));
  });
}

function closeRL() {
  rl.close();
}

// --- Menu ---

async function pickAction() {
  console.log(chalk.white('  What would you like to do?\n'));
  console.log(chalk.white('  1) Setup    — create folders and template files'));
  console.log(chalk.white('  2) Extract  — read EXIF from images into a spreadsheet'));
  console.log(chalk.white('  3) Template — apply artist info to the spreadsheet'));
  console.log(chalk.white('  4) Finalize — write spreadsheet data back into image copies'));
  console.log(chalk.white('  5) Quit'));
  console.log('');

  const choice = await ask('  Enter choice (1-5): ');
  return choice;
}

async function pickDir() {
  const defaultDir = join(homedir(), 'Desktop', 'ExificareOutput');
  console.log('');
  console.log(chalk.gray(`  Default folder: ${defaultDir}`));
  const answer = await ask('  Use default folder? (Y/n): ');

  if (answer.toLowerCase() === 'n') {
    const custom = await ask('  Enter folder path: ');
    const expanded = custom.startsWith('~')
      ? join(homedir(), custom.slice(1))
      : resolve(custom);
    return expanded;
  }
  return defaultDir;
}

async function pickTemplate(baseDir) {
  // Look for xlsx files in the base dir (not Output)
  const templateDir = join(baseDir, 'Templates');
  const templates = [];
  try {
    const entries = await readdir(templateDir);
    for (const f of entries) {
      if (f.endsWith('.xlsx') && !f.startsWith('SampleTemplate')) {
        templates.push(f);
      }
    }
  } catch { /* dir might not exist yet */ }

  if (templates.length === 0) {
    console.log('');
    console.log(chalk.yellow(`  No template files found in Templates/ folder.`));
    console.log(chalk.white(`  Edit DefaultTemplate.xlsx in: ${templateDir}`));
    console.log(chalk.gray(`  (See SampleTemplate.xlsx for an example)`));
    return null;
  }

  if (templates.length === 1) {
    console.log('');
    console.log(chalk.white(`  Found template: ${templates[0]}`));
    const confirm = await ask('  Use this template? (Y/n): ');
    if (confirm.toLowerCase() === 'n') return null;
    return join(templateDir, templates[0]);
  }

  // Multiple templates — let them pick
  console.log('');
  console.log(chalk.white('  Available templates:'));
  templates.forEach((f, i) => {
    console.log(chalk.white(`  ${i + 1}) ${f}`));
  });
  console.log('');

  const choice = await ask(`  Pick a template (1-${templates.length}): `);
  const idx = parseInt(choice, 10) - 1;

  if (idx >= 0 && idx < templates.length) {
    return join(templateDir, templates[idx]);
  }

  console.log(chalk.red('  Invalid choice.'));
  return null;
}

async function pickOverwrite() {
  const answer = await ask('  Overwrite existing values? (y/N): ');
  return answer.toLowerCase() === 'y';
}

// --- Run exificare ---

async function runCommand(args) {
  console.log('');
  console.log(chalk.gray(`  Running: exificare ${args.join(' ')}`));
  console.log('');

  return new Promise((res) => {
    // Resume stdin so child can read from it
    process.stdin.resume();

    const child = execFile('node', [EXIFICARE, ...args], { maxBuffer: 10 * 1024 * 1024 }, (err) => {
      process.stdin.removeListener('data', onData);
      process.stdin.pause();
      if (err && err.code) {
        console.log(chalk.red(`\n  Command exited with code ${err.code}`));
      }
      res();
    });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);

    // Forward stdin to child without pipe (pipe causes EOF issues)
    const onData = (chunk) => {
      if (child.stdin.writable) child.stdin.write(chunk);
    };
    process.stdin.on('data', onData);
  });
}

// --- Main loop ---

async function main() {
  console.log(BANNER);

  initRL();

  let running = true;
  while (running) {
    const action = await pickAction();

    switch (action) {
      case '1': {
        const dir = await pickDir();
        closeRL();
        await runCommand(['setup', '--dir', dir]);
        initRL();
        console.log('');
        break;
      }
      case '2': {
        const dir = await pickDir();
        closeRL();
        await runCommand(['extract', '--dir', dir]);
        initRL();
        console.log('');
        break;
      }
      case '3': {
        const dir = await pickDir();
        const templatePath = await pickTemplate(dir);
        if (!templatePath) {
          console.log('');
          break;
        }
        const overwrite = await pickOverwrite();
        const args = ['template', templatePath, '--dir', dir];
        if (overwrite) args.push('--overwrite');
        closeRL();
        await runCommand(args);
        initRL();
        console.log('');
        break;
      }
      case '4': {
        const dir = await pickDir();
        closeRL();
        await runCommand(['import', '--dir', dir]);
        console.log(chalk.white('\n  Done!\n'));
        process.exit(0);
      }
      case '5':
        running = false;
        break;
      default:
        console.log(chalk.red('  Invalid choice. Enter 1, 2, 3, 4, or 5.'));
        console.log('');
    }
  }

  closeRL();
  console.log(chalk.white('\n  Goodbye!\n'));
}

main();
