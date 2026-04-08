import chalk from 'chalk';
import { createInterface } from 'readline';
import { resolve, join } from 'path';
import { homedir } from 'os';
import { readdir, access } from 'fs/promises';
import { constants } from 'fs';

const BANNER = chalk.cyan(
`░▒▓████████▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓████████▓▒░▒▓█▓▒░░▒▓██████▓▒░ ░▒▓██████▓▒░░▒▓███████▓▒░░▒▓████████▓▒░
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░
░▒▓██████▓▒░  ░▒▓██████▓▒░░▒▓█▓▒░▒▓██████▓▒░ ░▒▓█▓▒░▒▓█▓▒░      ░▒▓████████▓▒░▒▓███████▓▒░░▒▓██████▓▒░
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░
░▒▓████████▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓████████▓▒░`
);

export function printBanner() {
  console.log(BANNER);
}

export function log(msg) {
  console.log(chalk.white(msg));
}

export function success(msg) {
  console.log(chalk.green('✓ ' + msg));
}

export function warn(msg) {
  console.log(chalk.yellow('⚠ ' + msg));
}

export function error(msg) {
  console.log(chalk.red('✗ ' + msg));
}

export function progress(current, total, fileName) {
  process.stdout.write(chalk.gray(`\r  [${current}/${total}] ${fileName}`.padEnd(60)));
}

export function progressDone() {
  process.stdout.write('\r' + ' '.repeat(60) + '\r');
}

export function resolveDir(dirFlag) {
  if (dirFlag) {
    const expanded = dirFlag.startsWith('~')
      ? join(homedir(), dirFlag.slice(1))
      : resolve(dirFlag);
    return expanded;
  }
  return join(homedir(), 'Desktop', 'ExificareOutput');
}

export async function discoverImages(archiveDir) {
  try {
    await access(archiveDir, constants.R_OK);
  } catch {
    return null; // directory doesn't exist or not readable
  }

  const entries = await readdir(archiveDir);
  const images = entries.filter(f =>
    /\.(jpe?g)$/i.test(f)
  );
  images.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return images;
}

export async function confirm(message) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolvePromise => {
    rl.question(chalk.yellow(message + ' Type y to continue: '), answer => {
      rl.close();
      resolvePromise(answer.trim().toLowerCase() === 'y');
    });
  });
}
