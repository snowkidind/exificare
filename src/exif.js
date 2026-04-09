import { ExifTool } from 'exiftool-vendored';

let instance = null;

function getExifTool() {
  if (!instance) {
    instance = new ExifTool({ taskTimeoutMillis: 60000 });
  }
  return instance;
}

// Tags that are read-only (file system / computed / internal) — cannot be written
const READ_ONLY_TAGS = new Set([
  'SourceFile', 'errors', 'Warning',
  'FileName', 'Directory', 'FilePath',
  'FileSize', 'FileType', 'FileTypeExtension', 'MIMEType',
  'FileModifyDate', 'FileAccessDate', 'FileInodeChangeDate',
  'FilePermissions', 'FileNumber',
  'ImageWidth', 'ImageHeight', 'ImageSize',
  'ExifToolVersion', 'ExifVersion',
  'BitsPerSample', 'ColorComponents', 'EncodingProcess',
  'YCbCrSubSampling', 'Megapixels',
  'ThumbnailOffset', 'ThumbnailLength', 'ThumbnailImage',
  'FlashpixVersion', 'ComponentsConfiguration',
  'ExifImageWidth', 'ExifImageHeight',
  'PhotometricInterpretation', 'Compression',
  'FocalLength35efl',
  'CurrentIPTCDigest', 'CodedCharacterSet',
  'ApplicationRecordVersion',
]);

/**
 * Read all EXIF tags from a file. Returns a flat object of tag → value.
 */
export async function readAll(filePath) {
  const et = getExifTool();
  const tags = await et.read(filePath);
  const result = {};
  for (const [key, value] of Object.entries(tags)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'object' && value.constructor?.name === 'ExifDateTime') {
      result[key] = value.toString();
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      const str = value.toString?.();
      result[key] = (str && str !== '[object Object]') ? str : JSON.stringify(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(v =>
        typeof v === 'object' && v !== null ? (v.toString?.() !== '[object Object]' ? v.toString() : JSON.stringify(v)) : String(v)
      ).join(', ');
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

/**
 * Strip all metadata from a file, then write new tags.
 * Uses the vendored exiftool API for both operations.
 */
export async function stripAndWrite(filePath, tags) {
  const et = getExifTool();

  // Read original Orientation before stripping — pixel data stays in sensor
  // orientation, so losing this tag makes images render upside-down / sideways
  const original = await et.read(filePath);
  const originalOrientation = original.Orientation;

  // Strip all existing metadata
  await et.write(filePath, {}, ['-all=', '-overwrite_original']);

  // Filter to writable, non-empty tags
  const cleaned = {};

  // Preserve original Orientation as a fallback (spreadsheet value takes precedence)
  if (originalOrientation !== undefined && originalOrientation !== null) {
    cleaned.Orientation = originalOrientation;
  }

  for (const [key, value] of Object.entries(tags)) {
    if (READ_ONLY_TAGS.has(key)) continue;
    if (value === undefined || value === null || value === '') continue;
    cleaned[key] = value;
  }

  if (Object.keys(cleaned).length > 0) {
    await et.write(filePath, cleaned, ['-overwrite_original']);
  }
}

/**
 * Shut down the exiftool process.
 */
export async function close() {
  if (instance) {
    await instance.end();
    instance = null;
  }
}
