#!/usr/bin/env node

import { program } from 'commander';
import { resolve } from 'path';
import { printBanner, resolveDir, error } from '../src/utils.js';
import { runExport } from '../src/export.js';
import { runImport } from '../src/import.js';
import { runTemplate } from '../src/template.js';
import { runSetup } from '../src/setup.js';

printBanner();

program
  .name('exificare')
  .description('EXIF data ETL — extract to Excel, edit, write back to image copies')
  .version('1.0.0');

program
  .command('extract')
  .description('Extract EXIF data from images in Archive/ into an Excel spreadsheet in Output/')
  .option('-d, --dir <path>', 'Base directory (default: ~/Desktop/ExifIcare)')
  .action(async (opts) => {
    try {
      const baseDir = resolveDir(opts.dir);
      await runExport(baseDir);
    } catch (err) {
      error(err.message);
      process.exit(1);
    }
  });

program
  .command('import')
  .description('Read the Excel spreadsheet and write EXIF data into copies of the original images')
  .option('-d, --dir <path>', 'Base directory (default: ~/Desktop/ExifIcare)')
  .action(async (opts) => {
    try {
      const baseDir = resolveDir(opts.dir);
      await runImport(baseDir);
    } catch (err) {
      error(err.message);
      process.exit(1);
    }
  });

program
  .command('template <file>')
  .description('Apply a template xlsx to exif-data.xlsx (column A = tag name, column B = value)')
  .option('-d, --dir <path>', 'Base directory (default: ~/Desktop/ExifIcare)')
  .option('--overwrite', 'Overwrite existing values (default: skip)')
  .action(async (file, opts) => {
    try {
      const baseDir = resolveDir(opts.dir);
      const templatePath = resolve(file);
      await runTemplate(templatePath, baseDir, opts.overwrite || false);
    } catch (err) {
      error(err.message);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Create folder structure and template files')
  .option('-d, --dir <path>', 'Base directory (default: ~/Desktop/ExifIcare)')
  .action(async (opts) => {
    try {
      const baseDir = resolveDir(opts.dir);
      await runSetup(baseDir);
    } catch (err) {
      error(err.message);
      process.exit(1);
    }
  });

program.parse();
