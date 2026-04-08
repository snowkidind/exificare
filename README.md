# Exificare

EXIF data ETL tool — extract image metadata to Excel, edit it, write it back into copies of your images.

## Prerequisites

- **Node.js** (v18 or newer) — this is the only thing you need to install
- **Internet connection** — needed during install to download dependencies (one of them, `exiftool-vendored`, downloads the EXIF processing tool automatically)

That's it. No other software required. Everything else is included.

## Installation

### 1. Install Node.js

Download and install from [https://nodejs.org](https://nodejs.org) (use the LTS version).

To verify it installed correctly, open Terminal and run:

```
node --version
```

You should see something like `v20.20.0`.

### 2. Install Exificare

Make sure you're connected to the internet, then open Terminal and run:

```
cd ~/Desktop/Exificare
npm install
npm link
```

This makes the `exificare` command available from anywhere.

## Usage

Open Terminal and type:

```
exificare
```

You'll see a menu:

```
1) Setup    — create folders and template files
2) Extract  — read EXIF from images into a spreadsheet
3) Template — apply artist info to the spreadsheet
4) Finalize — write spreadsheet data back into image copies
5) Quit
```

### First time setup

1. Choose **Setup** — this creates the folder structure at `~/Desktop/ExificareOutput/`:
   - `Archive/` — put your original images here
   - `Output/` — copies with updated EXIF will go here
   - `Templates/` — contains `DefaultTemplate.xlsx` and `SampleTemplate.xlsx`

2. Copy your images into `Archive/`

3. Open `Templates/DefaultTemplate.xlsx` and fill in column B with your info (see `SampleTemplate.xlsx` for examples)

### Workflow

1. **Extract** — reads EXIF data from your images and creates `Output/exif-data.xlsx`
2. **Template** — applies your artist info from `DefaultTemplate.xlsx` to the spreadsheet (only fills in empty cells)
3. Open `Output/exif-data.xlsx` and make any additional edits
4. **Finalize** — copies your images to `Output/` and writes the spreadsheet data as EXIF metadata

Your originals in `Archive/` are never modified.

## Spreadsheet Sheets

| Sheet | What's in it |
|-------|-------------|
| Main | Artist, title, description, keywords, date |
| Rights | Photographer credit, copyright, licensing |
| Camera & Lens | Make, model, exposure, aperture, ISO |
| GPS | Location coordinates |
| Dates & Times | All date/time tags |
| IPTC & XMP | Editorial metadata |
| File Info | Dimensions, file type, software |
| Other | Everything else (MakerNotes, profiles, etc.) |

## If you move the project folder

The `exificare` command will stop working. To fix it, open Terminal and run:

```
cd <new location>
npm link
```

## Uninstall

```
cd ~/Desktop/Exificare
npm unlink
```
