# Attachments, OCR and vision

Rinari Code prepares every attachment in Rinari Engine before starting a turn.
The engine imports an immutable copy into the artifact store, validates its
type and size, extracts document text, and returns stable source and derived
artifact references. Preparation can be cancelled or retried, and its state is
kept with the session draft across navigation and app restart.

Supported inputs are text and source files, PDF, DOCX, XLSX, PNG, JPEG and
WebP. A turn accepts at most eight files and 50 MiB total; each document is
limited to 25 MiB and images use the engine image limit. PDF preparation reads
at most 20 selected pages and can render up to four selected pages for vision.
OCR work across one preparation request is limited to 20 pages and 120 seconds.

Images can be sent visually when the selected model declares vision. If its
capability is unknown, the composer requires an explicit confirmation. If the
model declares that it lacks vision, use OCR or select another model. Image OCR
sends extracted text instead of image bytes. PDFs can combine extracted text
with selected visual pages and therefore follow the same vision checks.

The CLI equivalents are:

```text
rinari --attach path/to/document.pdf
/attach path/to/image.png
/attach --ocr path/to/image.png
/attach --vision path/to/image.png
```

`--ocr` extracts text. `--vision` explicitly permits a visual send when model
vision capability is unknown; it does not override a model that declares vision
unsupported. Warnings and truncation remain attached to the persisted message,
while previews read bounded data through the engine protocol.

The desktop package includes a checksum-pinned local Tesseract runtime. See
[OCR packaging](ocr-packaging.md) for reproducible build and smoke-test details.

## Validation and follow-up — 2026-09-11

The user confirmed in Code that the selected model receives image content.
Screenshots also confirmed the native file picker and composer thumbnail.

Remaining polish:

- Filter the native file picker to supported attachment formats and localize
  its "All Files" label.
- Allow an explicit vision capability override scoped to provider and model
  through the engine, so verified configurations do not repeatedly require
  confirmation. A successful upload alone must not infer vision support.

Automated validation: engine 1270 passed / 7 skipped, frontend 62 passed,
Rust 36 passed; protocol generation, build and packaged OCR smoke checks passed.
The Windows installer was not rebuilt as part of this validation.
