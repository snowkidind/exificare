import { join } from 'path';
import { mkdir, access, rename } from 'fs/promises';
import { constants } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ExcelJS from 'exceljs';
import { readAll, close } from './exif.js';
import { SHEETS, TOTAL_BUCKETS, categorize, collectColumns } from './sheets.js';
import { discoverImages, log, success, warn, error, progress, progressDone } from './utils.js';

const execFileAsync = promisify(execFile);

/**
 * Read the macOS Finder comment for a file (Get Info → Comments).
 * Returns the comment string or null.
 */
async function readFinderComment(filePath) {
  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e', `tell application "Finder" to get comment of (POSIX file "${filePath}" as alias)`,
    ]);
    const comment = stdout.trim().normalize('NFC');
    return comment || null;
  } catch {
    return null;
  }
}

/**
 * If exif-data.xlsx already exists, rename it to exif-data.v1.xlsx (or v2, v3, etc.)
 */
async function versionExisting(outputDir, fileName) {
  const filePath = join(outputDir, fileName);
  try {
    await access(filePath, constants.F_OK);
  } catch {
    return; // file doesn't exist, nothing to version
  }

  const base = fileName.replace('.xlsx', '');
  let version = 1;
  while (true) {
    const versionedName = `${base}.v${version}.xlsx`;
    const versionedPath = join(outputDir, versionedName);
    try {
      await access(versionedPath, constants.F_OK);
      version++;
    } catch {
      await rename(filePath, versionedPath);
      warn(`Existing spreadsheet backed up → ${versionedName}`);
      return;
    }
  }
}

export async function runExport(baseDir) {
  const archiveDir = join(baseDir, 'Archive');
  const outputDir = join(baseDir, 'Output');
  const xlsxPath = join(outputDir, 'exif-data.xlsx');

  // Discover images
  const images = await discoverImages(archiveDir);
  if (images === null) {
    error(`Could not find Archive/ folder at ${archiveDir}`);
    error('Make sure your images are in there.');
    process.exit(1);
  }
  if (images.length === 0) {
    error(`No JPEG files found in ${archiveDir}`);
    process.exit(1);
  }

  log(`Found ${images.length} images in Archive/`);
  log('Reading EXIF data...\n');

  // Read EXIF from all images
  const allTags = [];
  const allBuckets = [];
  for (let i = 0; i < images.length; i++) {
    const fileName = images[i];
    progress(i + 1, images.length, fileName);
    try {
      const tags = await readAll(join(archiveDir, fileName));

      // If the file has a macOS Finder comment (Get Info → Comments),
      // seed it into the caption fields so it appears in the spreadsheet
      if (!tags['ImageDescription'] && !tags['Caption-Abstract']) {
        const comment = await readFinderComment(join(archiveDir, fileName));
        if (comment) {
          tags['ImageDescription'] = comment;
          tags['Caption-Abstract'] = comment;
        }
      }

      allTags.push({ fileName, tags });
      allBuckets.push(categorize(tags));
    } catch (err) {
      progressDone();
      warn(`Could not read EXIF from ${fileName}: ${err.message}`);
      allTags.push({ fileName, tags: {} });
      allBuckets.push(categorize({}));
    }
  }
  progressDone();
  await close();

  log('Building spreadsheet...\n');

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'exificare';
  workbook.created = new Date();

  // Sheet names (defined sheets + Other catch-all)
  const sheetNames = [...SHEETS.map(s => s.name), 'Other'];

  for (let si = 0; si < TOTAL_BUCKETS; si++) {
    const columns = collectColumns(allBuckets, si);
    if (columns.length === 0 && si === TOTAL_BUCKETS - 1) continue; // skip empty Other sheet

    const sheet = workbook.addWorksheet(sheetNames[si]);

    // Header row: FileName + tag names
    const headerRow = ['FileName', ...columns];
    const header = sheet.addRow(headerRow);

    // Style the header
    header.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      cell.alignment = { horizontal: 'center' };
    });

    // Freeze the header row and FileName column
    sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

    // Data rows
    for (let fi = 0; fi < allTags.length; fi++) {
      const fileName = allTags[fi].fileName;
      const bucket = allBuckets[fi][si];
      const row = [fileName];
      for (const col of columns) {
        row.push(bucket[col] ?? '');
      }
      sheet.addRow(row);
    }

    // Auto-width columns (capped at 40)
    sheet.columns.forEach(col => {
      let maxLen = 10;
      col.eachCell({ includeEmpty: false }, cell => {
        const len = String(cell.value || '').length;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 2, 40);
    });
  }

  // Save (version any existing spreadsheet first)
  await mkdir(outputDir, { recursive: true });
  await versionExisting(outputDir, 'exif-data.xlsx');
  await workbook.xlsx.writeFile(xlsxPath);

  console.log('');
  success(`Extracted ${images.length} files → ${xlsxPath}`);
}
