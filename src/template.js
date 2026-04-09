import { join } from 'path';
import { access } from 'fs/promises';
import { constants } from 'fs';
import ExcelJS from 'exceljs';
import { log, success, warn, error } from './utils.js';

export async function runTemplate(templatePath, baseDir, overwrite) {
  const outputDir = join(baseDir, 'Output');
  const xlsxPath = join(outputDir, 'exif-data.xlsx');

  // Check template exists
  try {
    await access(templatePath, constants.R_OK);
  } catch {
    error(`Template file not found: ${templatePath}`);
    process.exit(1);
  }

  // Check exif-data.xlsx exists
  try {
    await access(xlsxPath, constants.R_OK);
  } catch {
    error(`No exif-data.xlsx found at ${xlsxPath}`);
    error("Run 'exificare extract' first.");
    process.exit(1);
  }

  // Read the template — expecting column A = tag name, column B = value
  const templateWb = new ExcelJS.Workbook();
  await templateWb.xlsx.readFile(templatePath);
  const templateSheet = templateWb.worksheets[0];

  if (!templateSheet) {
    error('Template file has no sheets.');
    process.exit(1);
  }

  const templateValues = new Map();
  templateSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header row
    const tag = String(row.getCell(1).value || '').trim();
    const value = row.getCell(2).value;
    if (tag && value !== null && value !== undefined && value !== '') {
      if (typeof value === 'object') {
        if (value instanceof Date) templateValues.set(tag, value.toISOString());
        else if (value.richText) templateValues.set(tag, value.richText.map(r => r.text).join(''));
        else if (value.text) templateValues.set(tag, String(value.text));
        else templateValues.set(tag, JSON.stringify(value));
      } else {
        templateValues.set(tag, String(value));
      }
    }
  });

  if (templateValues.size === 0) {
    error('Template is empty. Expected column A = tag name, column B = value.');
    process.exit(1);
  }

  log(`Template has ${templateValues.size} fields:`);
  for (const [tag, value] of templateValues) {
    log(`  ${tag} = ${value}`);
  }
  console.log('');

  // Open the exif-data workbook
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  let applied = 0;
  let skipped = 0;

  // For each sheet, check if any template tags match column headers
  workbook.eachSheet(sheet => {
    // Build header map: tag name → column number
    const headerMap = new Map();
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const val = String(cell.value || '');
      if (templateValues.has(val)) {
        headerMap.set(val, colNumber);
      }
    });

    if (headerMap.size === 0) return;

    // Apply template values to each data row
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      for (const [tag, colNumber] of headerMap) {
        const existing = row.getCell(colNumber).value;
        const hasValue = existing !== null && existing !== undefined && existing !== '';

        if (hasValue && !overwrite) {
          skipped++;
          continue;
        }

        row.getCell(colNumber).value = templateValues.get(tag);
        applied++;
      }
    });
  });

  // Save
  await workbook.xlsx.writeFile(xlsxPath);

  console.log('');
  success(`Applied ${applied} values across exif-data.xlsx`);
  if (skipped > 0) {
    warn(`${skipped} cells skipped (already had values — use --overwrite to replace)`);
  }
}
