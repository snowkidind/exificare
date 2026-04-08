// Sheet definitions — which EXIF tags belong on which sheet.
// Any tag not listed here goes to Sheet 7 (Other).

export const SHEETS = [
  {
    name: 'Main',
    tags: [
      // Artist identity
      'Artist', 'Creator', 'AuthorsPosition', 'ByLine', 'ByLineTitle',
      // Title & description
      'Title', 'ObjectName', 'Headline',
      'Description', 'ImageDescription', 'Caption-Abstract', 'CaptionAbstract',
      'UserComment',
      // Categorization
      'Keywords', 'Subject', 'Label', 'Rating',
      // Date of creation
      'DateTimeOriginal',
    ],
  },
  {
    name: 'Rights',
    tags: [
      // Photographer credit
      'Credit', 'Source',
      // Copyright & licensing
      'Copyright', 'CopyrightNotice', 'Rights', 'UsageTerms',
      'WebStatement',
    ],
  },
  {
    name: 'Camera & Lens',
    tags: [
      'Make', 'Model', 'LensModel', 'LensMake', 'LensInfo',
      'LensSerialNumber', 'LensID',
      'ExposureTime', 'FNumber', 'ISO', 'FocalLength',
      'FocalLengthIn35mmFormat', 'FocalLength35efl',
      'ShutterSpeedValue', 'ApertureValue', 'BrightnessValue',
      'ExposureCompensation', 'MaxApertureValue', 'MeteringMode',
      'Flash', 'FlashFired', 'FlashReturn', 'FlashMode',
      'WhiteBalance', 'WhiteBalanceMode',
      'ExposureMode', 'ExposureProgram',
      'DigitalZoomRatio', 'SceneCaptureType', 'SceneType',
      'SensitivityType', 'RecommendedExposureIndex',
      'Contrast', 'Saturation', 'Sharpness',
      'GainControl', 'SubjectDistanceRange',
      'LightSource', 'ColorSpace',
      'Orientation',
    ],
  },
  {
    name: 'GPS',
    tags: [
      'GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'GPSAltitudeRef',
      'GPSDateTime', 'GPSSpeed', 'GPSSpeedRef',
      'GPSImgDirection', 'GPSImgDirectionRef',
      'GPSDestLatitude', 'GPSDestLongitude',
      'GPSLatitudeRef', 'GPSLongitudeRef',
      'GPSMapDatum', 'GPSVersionID',
    ],
  },
  {
    name: 'Dates & Times',
    tags: [
      'CreateDate', 'ModifyDate', 'DateTimeOriginal',
      'GPSDateTime', 'FileModifyDate', 'FileAccessDate', 'FileInodeChangeDate',
      'OffsetTime', 'OffsetTimeOriginal', 'OffsetTimeDigitized',
      'SubSecTime', 'SubSecTimeOriginal', 'SubSecTimeDigitized',
      'DateTimeDigitized', 'TimeCreated', 'DateCreated',
    ],
  },
  {
    name: 'IPTC & XMP',
    tags: [
      // Location (IPTC)
      'City', 'Country', 'CountryCode', 'State', 'Location',
      // Editorial
      'Category', 'SupplementalCategories',
      'Urgency', 'SpecialInstructions',
      'WriterEditor', 'CaptionWriter',
      'DateSent', 'TimeSent',
    ],
  },
  {
    name: 'File Info',
    tags: [
      'FileName', 'Directory', 'FilePath',
      'FileSize', 'FileType', 'FileTypeExtension', 'MIMEType',
      'ImageWidth', 'ImageHeight', 'ImageSize',
      'BitsPerSample', 'Compression', 'PhotometricInterpretation',
      'XResolution', 'YResolution', 'ResolutionUnit',
      'EncodingProcess', 'ColorComponents', 'YCbCrSubSampling',
      'ExifImageWidth', 'ExifImageHeight',
      'Software', 'HostComputer',
      'ExifToolVersion', 'ExifVersion',
      'FlashpixVersion', 'ComponentsConfiguration',
      'ThumbnailOffset', 'ThumbnailLength',
      'ThumbnailImage',
    ],
  },
];

// Build a fast lookup: tagName → sheet index
const TAG_TO_SHEET = new Map();
for (let i = 0; i < SHEETS.length; i++) {
  for (const tag of SHEETS[i].tags) {
    TAG_TO_SHEET.set(tag, i);
  }
}

// Tags to completely skip (internal exiftool artifacts, not real EXIF)
const SKIP_TAGS = new Set([
  'SourceFile', 'errors', 'Warning',
]);

const OTHER_INDEX = SHEETS.length;
const TOTAL_BUCKETS = SHEETS.length + 1;

/**
 * Categorize a flat tag object into sheet buckets.
 * Returns an array of objects (one per sheet + Other), each mapping tagName → value.
 * Last index is the "Other" catch-all sheet.
 */
export function categorize(tags) {
  const buckets = Array.from({ length: TOTAL_BUCKETS }, () => ({}));

  for (const [tag, value] of Object.entries(tags)) {
    if (SKIP_TAGS.has(tag)) continue;
    if (tag === 'FileName') continue; // handled as the row key, not a data column

    const sheetIndex = TAG_TO_SHEET.get(tag);
    if (sheetIndex !== undefined) {
      buckets[sheetIndex][tag] = value;
    } else {
      buckets[OTHER_INDEX][tag] = value; // Other
    }
  }

  return buckets;
}

export { TOTAL_BUCKETS };

/**
 * Collect all unique tags across all files for a given sheet index.
 * Returns a sorted array of tag names.
 *
 * For the Main sheet (index 0), ALL defined tags are always included
 * so the user can see every available field even if currently empty.
 */
export function collectColumns(allBuckets, sheetIndex) {
  const tagSet = new Set();
  for (const buckets of allBuckets) {
    for (const tag of Object.keys(buckets[sheetIndex])) {
      tagSet.add(tag);
    }
  }
  // For defined sheets, preserve the defined order, then append any extras
  if (sheetIndex < SHEETS.length) {
    // Main and Rights sheets: always show all defined columns so the user knows what's available
    const alwaysShow = sheetIndex === 0 || sheetIndex === 1;
    const defined = alwaysShow
      ? SHEETS[sheetIndex].tags
      : SHEETS[sheetIndex].tags.filter(t => tagSet.has(t));
    const extras = [...tagSet].filter(t => !SHEETS[sheetIndex].tags.includes(t)).sort();
    return [...defined, ...extras];
  }
  return [...tagSet].sort();
}
