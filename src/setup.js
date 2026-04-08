import { join } from 'path';
import { mkdir, access } from 'fs/promises';
import { constants } from 'fs';
import ExcelJS from 'exceljs';
import { log, success, warn } from './utils.js';

export async function runSetup(baseDir) {
  const archiveDir = join(baseDir, 'Archive');
  const outputDir = join(baseDir, 'Output');
  const templateDir = join(baseDir, 'Templates');

  // Create directories
  for (const dir of [baseDir, archiveDir, outputDir, templateDir]) {
    await mkdir(dir, { recursive: true });
  }
  success(`Created folder structure at ${baseDir}`);

  // Create DefaultTemplate.xlsx (empty — user fills this in)
  const defaultPath = join(templateDir, 'DefaultTemplate.xlsx');
  try {
    await access(defaultPath, constants.F_OK);
    warn('DefaultTemplate.xlsx already exists — skipping');
  } catch {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Template');

    // Header row
    const header = sheet.addRow(['Tag Name', 'Your Value']);
    header.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    });

    // Empty rows for the user to fill in
    const tags = [
      'Artist', 'Creator', 'AuthorsPosition',
      'Credit', 'Source',
      'Copyright', 'CopyrightNotice', 'Rights', 'UsageTerms', 'WebStatement',
    ];
    for (const tag of tags) {
      sheet.addRow([tag, '']);
    }

    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 50;

    await wb.xlsx.writeFile(defaultPath);
    success('Created DefaultTemplate.xlsx — fill in column B with your info');
  }

  // Create SampleTemplate.xlsx (with example values to show the format)
  const samplePath = join(templateDir, 'SampleTemplate.xlsx');
  try {
    await access(samplePath, constants.F_OK);
    warn('SampleTemplate.xlsx already exists — skipping');
  } catch {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Template');

    // Header row
    const header = sheet.addRow(['Tag Name', 'Your Value']);
    header.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    });

    // Example data
    const examples = [
      ['Artist',           'Jane Smith'],
      ['Creator',          'Jane Smith'],
      ['AuthorsPosition',  'Visual Artist / Photographer'],
      ['Credit',           'Photo by Jane Smith'],
      ['Source',            'Jane Smith Studio'],
      ['Copyright',         '© 2026 Jane Smith'],
      ['CopyrightNotice',  '© 2026 Jane Smith. All rights reserved.'],
      ['Rights',           'All Rights Reserved'],
      ['UsageTerms',       'For licensing contact jane@example.com'],
      ['WebStatement',     'https://janesmith.com/license'],
      ['Title',            'Sunset Over the Harbor'],
      ['Headline',         'Golden hour at the marina'],
      ['Keywords',         'sunset, harbor, golden hour, landscape'],
      ['Description',      'A warm sunset captured at the city marina during golden hour'],
    ];
    for (const [tag, value] of examples) {
      const row = sheet.addRow([tag, value]);
      // Gray italic to show these are examples
      row.getCell(2).font = { italic: true, color: { argb: 'FF808080' } };
    }

    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 60;

    await wb.xlsx.writeFile(samplePath);
    success('Created SampleTemplate.xlsx — example values for reference (do not apply this)');
  }

  console.log('');
  log('Next steps:');
  log(`  1. Put your images in: ${archiveDir}`);
  log(`  2. Edit DefaultTemplate.xlsx with your info`);
  log('  3. Run exificare again');
}
