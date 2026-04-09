import { join } from 'path';
import { copyFile, mkdir, access } from 'fs/promises';
import { constants } from 'fs';
import ExcelJS from 'exceljs';
import { stripAndWrite, close } from './exif.js';
import { log, success, warn, error, progress, progressDone, confirm } from './utils.js';

export async function runImport(baseDir) {
  const archiveDir = join(baseDir, 'Archive');
  const outputDir = join(baseDir, 'Output');
  const xlsxPath = join(outputDir, 'exif-data.xlsx');

  // Check xlsx exists
  try {
    await access(xlsxPath, constants.R_OK);
  } catch {
    error(`No exif-data.xlsx found at ${xlsxPath}`);
    error("Run 'exificare export' first to create the spreadsheet.");
    process.exit(1);
  }

  // Check Archive exists
  try {
    await access(archiveDir, constants.R_OK);
  } catch {
    error(`Could not find Archive/ folder at ${archiveDir}`);
    process.exit(1);
  }

  // Backup warning
  console.log('');
  log('This will:');
  log('  1. Copy original images from Archive/ to Output/');
  log('  2. Strip all EXIF data from the copies');
  log('  3. Write the spreadsheet data as new EXIF into the copies');
  console.log('');
  log('Your originals in Archive/ will NOT be modified.');
  console.log('');

  const confirmed = await confirm('Proceed?');
  if (!confirmed) {
    log('Cancelled.');
    process.exit(0);
  }

  console.log('');
  log('Reading spreadsheet...\n');

  // Read the workbook
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  // Collect all data from all sheets, keyed by FileName
  const fileData = new Map(); // fileName → { tag: value, ... }

  workbook.eachSheet(sheet => {
    // Build 1-indexed header map (ExcelJS columns are 1-based)
    const headers = {};
    let fileNameCol = null;
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const val = String(cell.value || '');
      headers[colNumber] = val;
      if (val === 'FileName') fileNameCol = colNumber;
    });

    if (fileNameCol === null) return; // skip sheets without FileName

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const fileName = String(row.getCell(fileNameCol).value || '').trim();
      if (!fileName) return;

      if (!fileData.has(fileName)) {
        fileData.set(fileName, {});
      }
      const tags = fileData.get(fileName);

      for (const [colStr, header] of Object.entries(headers)) {
        const col = Number(colStr);
        if (header === 'FileName') continue;

        const cellValue = row.getCell(col).value;
        if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
          // ExcelJS can return objects for rich text, hyperlinks, dates, etc.
          if (typeof cellValue === 'object') {
            if (cellValue instanceof Date) {
              tags[header] = cellValue.toISOString();
            } else if (cellValue.richText) {
              tags[header] = cellValue.richText.map(r => r.text).join('');
            } else if (cellValue.text) {
              tags[header] = String(cellValue.text);
            } else if (cellValue.result !== undefined) {
              tags[header] = String(cellValue.result);
            } else {
              tags[header] = JSON.stringify(cellValue);
            }
          } else {
            tags[header] = String(cellValue);
          }
        }
      }
    });
  });

  if (fileData.size === 0) {
    error('No file data found in the spreadsheet.');
    process.exit(1);
  }

  log(`Found ${fileData.size} files in spreadsheet`);
  log('Copying and writing EXIF...\n');

  await mkdir(outputDir, { recursive: true });

  let copied = 0;
  let skipped = 0;
  const fileNames = [...fileData.keys()];

  for (let i = 0; i < fileNames.length; i++) {
    const fileName = fileNames[i];
    const tags = fileData.get(fileName);
    progress(i + 1, fileNames.length, fileName);

    const srcPath = join(archiveDir, fileName);
    const destPath = join(outputDir, fileName);

    // Check source exists
    try {
      await access(srcPath, constants.R_OK);
    } catch {
      progressDone();
      warn(`${fileName} not found in Archive/ — skipping`);
      skipped++;
      continue;
    }

    try {
      // Copy original → Output
      await copyFile(srcPath, destPath);
      // Strip all EXIF and rewrite from spreadsheet
      await stripAndWrite(destPath, tags);
      copied++;
    } catch (err) {
      progressDone();
      warn(`Failed to process ${fileName}: ${err.message}`);
      skipped++;
    }
  }

  progressDone();
  await close();

  console.log('');
  success(`Wrote EXIF to ${copied} files in Output/`);
  if (skipped > 0) {
    warn(`${skipped} files skipped (see warnings above)`);
  }
  process.exit(0);
}
