# AGENTS.md — Master Guidelines for Tauri + Rust Desktop Applications

## Purpose

This document defines the preferred technology stack, libraries, architectural principles, UI/UX rules, security expectations, performance guidelines, and dependency-selection rules for building **modern desktop applications with Tauri 2 + Rust**.

It is intended to guide an LLM or coding agent working on the project.

The application may include any combination of:

- Standard desktop UI
- Dashboards
- Forms
- Tables
- Local databases
- Filesystem access
- REST APIs
- Authentication
- OAuth / OIDC
- Secure credential storage
- Email
- PDF generation or manipulation
- Excel / CSV import and export
- ZIP archives
- Multimedia
- Video playback
- Image viewing/editing
- Audio playback
- Charts
- Search
- Drag and drop
- Native notifications
- Auto updates
- Background processing
- External tools / sidecars

The LLM must use the technologies in this guide **when appropriate for the requested feature**.

Do **not** install or use every dependency by default.

The primary goal is to create software that is:

- Fast
- Maintainable
- Visually polished
- Native-feeling
- Secure
- Scalable
- Easy to extend

---

# 1. Core Technology Stack

Preferred default stack:

- **Tauri 2**
- **Rust**
- **React**
- **TypeScript**
- **Vite**

Unless the existing project already uses another frontend framework, prefer:

```text
Tauri 2
├── Rust backend
└── React + TypeScript + Vite frontend
```

Do not rewrite an existing Vue, Svelte, Solid, or other frontend solely to match this recommendation.

Preserve the existing architecture when reasonable.

---

# 2. General Dependency Rule

The application MUST NOT blindly install every library listed in this document.

Dependencies should be added only when:

1. The requested feature benefits from the library.
2. The project does not already contain an equivalent dependency.
3. The library improves maintainability, UX, reliability, security, or performance.
4. The dependency is compatible with the current stack.

Before adding a dependency:

- Inspect `package.json`.
- Inspect `Cargo.toml`.
- Inspect existing Tauri plugins.
- Inspect the component system.
- Inspect project conventions.
- Reuse existing solutions whenever practical.

Avoid duplicate libraries that solve the same problem.

---

# 3. Recommended Frontend Structure

Prefer feature-oriented organization.

```text
src/
├── app/
├── components/
│   ├── ui/
│   ├── layout/
│   └── common/
├── features/
├── hooks/
├── stores/
├── services/
├── lib/
├── types/
├── config/
└── utils/
```

Do not place business logic directly inside large React components.

Prefer:

```text
Component
    ↓
Hook / Store
    ↓
Frontend Service
    ↓
Tauri Command
    ↓
Rust Service
```

---

# 4. Styling — Tailwind CSS 4

Use **Tailwind CSS 4** as the preferred styling solution.

Use it for:

- Layout
- Grid
- Flexbox
- Spacing
- Typography
- Colors
- Borders
- Radius
- Responsive behavior
- Dark mode
- Interactive states
- Desktop layout composition

Custom CSS is acceptable for complex effects or cases where it is clearer than utility classes.

---

# 5. UI Components — shadcn/ui

Use **shadcn/ui** as the preferred application component system.

Use it when appropriate for:

- Buttons
- Inputs
- Dialogs
- Alert dialogs
- Dropdown menus
- Context menus
- Popovers
- Tooltips
- Tabs
- Sheets
- Drawers
- Selects
- Sliders
- Checkboxes
- Switches
- Cards
- Menus
- Navigation
- Breadcrumbs
- Forms
- Command interfaces

Customize components to match the application's identity.

---

# 6. Accessible UI Primitives — Base UI / Radix UI

Use **Base UI** or **Radix UI** when lower-level accessible primitives are needed.

Prefer shadcn/ui first.

Use primitives directly when a highly customized interaction is required or accessibility behavior would otherwise need to be recreated manually.

Do not manually recreate focus traps, keyboard navigation, menu accessibility, dialog behavior, or popover positioning without a clear reason.

---

# 7. Icons — Lucide React

Use **Lucide React** as the default icon library.

Maintain consistent:

- Icon sizes
- Stroke widths
- Alignment
- Padding
- Visual weight

Avoid mixing icon packs without a strong reason.

---

# 8. Animation — Motion

Use **Motion** via `motion/react` for subtle UI transitions.

Good uses:

- Sidebar transitions
- View transitions
- Dialog opening/closing
- Hover feedback
- Expand/collapse
- Media overlays
- Selection changes
- Drag feedback
- Layout changes

Prefer fast desktop transitions, typically around **100–250 ms**.

Avoid excessive animation.

---

# 9. Global State — Zustand

Use **Zustand** when state must be shared across multiple parts of the application.

Good candidates:

- User preferences
- Selected item
- Sidebar state
- Active workspace
- Player state
- Viewer state
- Queue state
- Search/filter state
- Current folder
- Layout preferences

Do not put all application state into one giant store.

Prefer focused stores by domain.

---

# 10. Forms — React Hook Form

Use **React Hook Form** for medium or complex forms.

Examples:

- Settings
- Application configuration
- User preferences
- Import/export settings
- Metadata editing
- Connection settings
- Login forms
- Profile forms

For tiny forms, local React state is acceptable.

---

# 11. Validation — Zod

Use **Zod** when structured frontend validation is useful.

Prefer it with React Hook Form for:

- Login forms
- Settings
- API configuration
- Import/export options
- User input validation
- Complex nested forms

Do not rely exclusively on frontend validation for security-sensitive data.

Validate again in Rust/backend code.

---

# 12. Toast Notifications — Sonner

Use **Sonner** for transient toast notifications.

Examples:

- Saved successfully
- Import completed
- Folder added
- Export completed
- Error loading file
- Configuration updated
- Copy completed
- Operation cancelled

Do not use toasts for information that should remain permanently visible.

---

# 13. Command Palette — cmdk

Use **cmdk** when implementing a command/search palette.

Preferred shortcut:

```text
Ctrl + K
```

Potential commands:

- Search
- Open file
- Open folder
- Navigate to page
- Toggle sidebar
- Open settings
- Run common actions
- Jump to recent items
- Activate commands

---

# 14. Tables — TanStack Table

Use **TanStack Table** for advanced table interfaces.

Use it for:

- Sorting
- Filtering
- Pagination
- Column visibility
- Row selection
- Column resizing
- Administrative lists
- Detailed metadata

Do not use it for trivial lists.

---

# 15. Virtualization — TanStack Virtual

Use **TanStack Virtual** for large collections.

Examples:

- Thousands of files
- Image galleries
- Video libraries
- Long playlists
- Search results
- Large tables
- Logs

Avoid rendering huge DOM trees.

---

# 16. Charts — Recharts

Use **Recharts** when charts are required.

Appropriate for:

- Line charts
- Bar charts
- Area charts
- Pie charts
- Time series
- Business metrics
- Usage statistics

Do not install it if charts are not required.

---

# 17. Resizable Panels — react-resizable-panels

Use **react-resizable-panels** when users should resize parts of the interface.

Examples:

- Sidebar
- Inspector
- File browser
- Editor panel
- Console
- Preview pane
- Media details
- Playlist panel

Persist panel dimensions when useful.

---

# 18. Drag and Drop — dnd-kit

Use **dnd-kit** for advanced drag-and-drop.

Examples:

- Reordering lists
- Moving items between categories
- Rearranging cards
- Sorting playlists
- Queue items
- Dashboard customization

Use Tauri/browser native file-drop APIs for OS file drops when appropriate.

---

# 19. Desktop UX

Prefer a native-feeling desktop structure:

```text
┌─────────────────────────────────────────────────┐
│ Custom title bar                               │
├──────────────┬──────────────────────────────────┤
│ Sidebar      │          Main content            │
├──────────────┴──────────────────────────────────┤
│ Optional status/player/action bar              │
└─────────────────────────────────────────────────┘
```

Prefer:

- Persistent sidebar
- Keyboard shortcuts
- Context menus
- Search
- Compact layouts
- Tooltips
- Resizable regions
- Native dialogs
- Desktop-friendly information density

Avoid making the app feel like a mobile web page stretched to desktop.

---

# 20. Tauri Window Customization

When beneficial, use Tauri window APIs for:

- Minimize
- Maximize
- Restore
- Close
- Drag region
- Fullscreen

Use a custom title bar only when it materially improves the design.

---

# 21. Window Persistence — tauri-plugin-window-state

Use **tauri-plugin-window-state** when useful to remember:

- Window dimensions
- Position
- Maximized state

Recommended for productivity applications.

---

# 22. Native Dialogs — tauri-plugin-dialog

Use **tauri-plugin-dialog** for:

- File selection
- Folder selection
- Save dialogs

Prefer native OS dialogs for normal desktop workflows.

---

# 23. Filesystem — tauri-plugin-fs

Use **tauri-plugin-fs** when frontend-accessible filesystem functionality is appropriate.

Prefer Rust for heavier operations such as:

- Recursive scans
- Large directory traversal
- Batch renaming
- Indexing
- Hashing
- File watching

---

# 24. Opening External Resources — tauri-plugin-opener

Use **tauri-plugin-opener** to open:

- Files
- Folders
- URLs
- OS-associated resources

Avoid unsafe shell commands for these operations.

---

# 25. External Commands — tauri-plugin-shell

Use **tauri-plugin-shell** only for controlled sidecars or approved external tools.

Examples:

- FFmpeg
- ffprobe
- mpv
- Project-specific CLI tools

Commands must be validated and explicitly scoped.

Never execute arbitrary user-controlled shell strings.

---

# 26. Local Database — SQLite

Use **SQLite** as the preferred embedded database for structured persistent local data.

Examples:

- Settings
- Indexed files
- Metadata
- History
- Favorites
- Collections
- Tags
- Recent items
- Playlists
- Project records
- Offline application data

---

# 27. Tauri SQL — tauri-plugin-sql

Use **tauri-plugin-sql** when it fits the project.

For bulk indexing, heavy transactions, complex database operations, or large jobs, Rust-side database access may be preferable.

---

# 28. Lightweight Settings — tauri-plugin-store

Use **tauri-plugin-store** for simple local preferences that do not require relational storage.

Examples:

```text
theme
language
sidebarCollapsed
lastFolder
autoUpdate
window preferences
simple feature flags
```

Use SQLite instead for structured, searchable, relational, or high-volume data.

Do not use the store for sensitive secrets.

---

# 29. Serialization — serde / serde_json

Use **serde** and **serde_json** for typed serialization between Rust structures and JSON where appropriate.

Prefer strongly typed structs over generic `Value` payloads when the schema is known.

---

# 30. Async Runtime — Tokio

Use **Tokio** when async Rust work is required.

Typical uses:

- HTTP
- Background jobs
- Process handling
- Database work
- Concurrent I/O

Do not introduce async complexity where synchronous code is simpler and sufficient.

---

# 31. Rust Error Types — thiserror / anyhow

Prefer:

- **thiserror** for structured application/domain errors.
- **anyhow** for internal tooling or boundaries where rich context is more useful than a typed public error.

Do not expose raw internal error chains directly to end users.

---

# 32. HTTP / REST APIs — reqwest

Use **reqwest** as the preferred Rust HTTP client.

Good uses:

- REST APIs
- Authentication requests
- File uploads
- File downloads
- JSON requests
- Multipart forms
- API integrations
- Sensitive requests involving tokens

Preferred architecture:

```text
React
   ↓
Tauri Command
   ↓
ApiService (Rust)
   ↓
reqwest
   ↓
Remote API
```

Prefer Rust + reqwest when authentication, sensitive headers, or substantial API logic is involved.

---

# 33. Frontend HTTP — tauri-plugin-http

Use **tauri-plugin-http** when a direct frontend HTTP integration is justified.

Good cases:

- Simple public requests
- Non-sensitive API calls
- Cases where frontend ownership is architecturally cleaner

Prefer Rust + reqwest when:

- Tokens are involved
- Credentials are involved
- Business logic is sensitive
- Upload/download handling is complex
- Request signing is required

Scope allowed URLs carefully.

---

# 34. Authentication — General Rule

Desktop authentication should normally use secure external-browser flows.

Prefer:

```text
Authorization Code
+
PKCE
```

for OAuth-based desktop login.

Do not embed a confidential OAuth client secret in the desktop app.

---

# 35. OAuth2 — oauth2

Use the Rust **oauth2** crate when OAuth 2.0 flows are required.

Appropriate for providers such as:

- GitHub
- Discord
- Custom OAuth providers
- Other compatible services

Prefer Authorization Code + PKCE for desktop applications.

---

# 36. OpenID Connect — openidconnect

Use **openidconnect** when identity/login requires OIDC.

Good candidates:

- Google
- Microsoft Entra ID
- Keycloak
- Auth0
- Other OIDC providers

Use it when identity claims, ID tokens, discovery, or OIDC validation are needed.

---

# 37. OAuth Callbacks — tauri-plugin-deep-link

Use **tauri-plugin-deep-link** when the application needs URL callbacks such as:

```text
myapp://auth/callback
```

Good uses:

- OAuth/OIDC callbacks
- Open-from-browser actions
- Custom application links

Validate incoming deep-link parameters.

---

# 38. Secure Secret Storage — tauri-plugin-stronghold

Use **tauri-plugin-stronghold** for sensitive local secret storage when appropriate.

Examples:

- Access tokens
- Refresh tokens
- User-provided API keys
- User SMTP credentials
- Sensitive local secrets

Do NOT store secrets in:

```text
localStorage
sessionStorage
plain JSON files
plain configuration files
unprotected SQLite columns
frontend source code
```

Keep secrets out of the frontend whenever practical.

---

# 39. Local Password Hashing — argon2

Use RustCrypto **argon2** with **Argon2id** when the application genuinely needs to hash local passwords.

Use this for local-auth scenarios only.

Do not hash an OAuth provider password locally.

Never store plaintext passwords.

---

# 40. JWT — jsonwebtoken

Use **jsonwebtoken** when JWT parsing, creation, or validation is genuinely required.

Prefer validating security-sensitive remote tokens on a trusted backend when the architecture supports it.

Do not assume that decoding a JWT means it is valid.

Verify signatures and claims.

---

# 41. Authentication Architecture

Prefer:

```text
User
  ↓
System Browser
  ↓
OAuth / OIDC Provider
  ↓
Authorization Code + PKCE
  ↓
Deep Link / Local Callback
  ↓
Rust AuthService
  ↓
Token Exchange
  ↓
Stronghold
```

Do not expose refresh tokens unnecessarily to React.

---

# 42. Email — lettre

Use **lettre** when SMTP functionality is required in Rust.

Good uses:

- User-configured SMTP
- Local enterprise applications
- Applications explicitly designed to send mail through a configured server

If the application uses company-owned credentials, prefer:

```text
Tauri App
   ↓
Application Backend
   ↓
Email Provider / SMTP
```

Do not embed company SMTP passwords, provider API secrets, or private keys into a distributed desktop binary.

---

# 43. Email Security Rule

If the user configures their own SMTP credentials:

- Store them securely.
- Prefer Stronghold or an OS-backed secure storage mechanism.
- Never log passwords.
- Never expose them unnecessarily to React.

For SaaS-managed transactional email, route sending through the server/backend.

---

# 44. PDF Creation — printpdf

Use **printpdf** when creating new PDF documents from application data.

Good uses:

- Reports
- Quotations
- Invoices
- Certificates
- Printable forms
- Summaries
- Exported documents

Do not add it merely because the app can open PDF files.

---

# 45. PDF Manipulation — lopdf

Use **lopdf** when manipulating existing PDF documents.

Appropriate for:

- Merging
- Splitting
- Modifying PDF objects
- Extracting/rearranging pages
- Low-level PDF manipulation

Do not use it if the requirement is only to generate a new simple PDF.

---

# 46. PDF Rendering / Inspection — pdfium-render

Use **pdfium-render** when the app needs advanced PDF rendering or inspection.

Good uses:

- Render PDF pages to images
- Build a native-like PDF viewer
- Inspect page content
- Extract text
- Work with annotations
- Work with forms
- Generate previews

Remember that Pdfium may introduce native binary/distribution considerations.

Use only when its capabilities are required.

---

# 47. PDF Decision Rule

Choose based on the feature:

```text
Create a new PDF
    → printpdf

Manipulate an existing PDF
    → lopdf

Render / inspect / advanced PDF viewer
    → pdfium-render
```

Do not install all three by default.

---

# 48. Excel Export — rust_xlsxwriter

Use **rust_xlsxwriter** to generate `.xlsx` workbooks.

Good uses:

- Reports
- Export tables
- Financial sheets
- Formatted worksheets
- Formulas
- Multi-sheet workbooks
- Charts where appropriate

Prefer generating Excel files in Rust when the source data is already managed by the backend.

---

# 49. Excel Import — calamine

Use **calamine** when reading spreadsheet files.

Suitable formats include commonly used spreadsheet formats such as:

- XLS
- XLSX
- XLSM
- XLSB
- ODS

Validate imported workbook structure before trusting data.

---

# 50. CSV — csv

Use the Rust **csv** crate for CSV import/export.

Good uses:

- Large data export
- Lightweight spreadsheet interchange
- Bulk import
- Machine-readable reports

Prefer Serde integration where useful.

Handle separators, encodings, headers, and malformed rows gracefully.

---

# 51. ZIP Archives — zip

Use the Rust **zip** crate when ZIP archive creation or extraction is needed.

Good uses:

- Backups
- Export packages
- Project bundles
- Import archives
- Compressing groups of generated files

When extracting archives:

- Validate paths.
- Prevent path traversal / Zip Slip.
- Do not blindly overwrite arbitrary files.

---

# 52. Logging — tracing

Use **tracing** for structured Rust logging and diagnostics.

Good targets:

- Startup
- Database operations
- API calls
- Background jobs
- File scanning
- Import/export
- External processes
- Errors
- Performance diagnostics

Do not log:

- Passwords
- Access tokens
- Refresh tokens
- Private API keys
- Sensitive personal data unless explicitly justified

---

# 53. Tauri Logging — tauri-plugin-log

Use **tauri-plugin-log** when application-level Tauri logging is useful.

Use appropriate log levels:

```text
trace
debug
info
warn
error
```

Avoid noisy logs in production.

---

# 54. Auto Updates — tauri-plugin-updater

Use **tauri-plugin-updater** when the application should support self-updating.

Typical features:

- Check for updates
- Notify user
- Download update
- Install update
- Restart application

Do not implement a custom updater if the official Tauri updater solves the requirement.

Ensure update artifacts are properly signed and distributed securely.

---

# 55. Native Notifications — tauri-plugin-notification

Use **tauri-plugin-notification** for operating-system notifications.

Good uses:

- Export finished
- Processing completed
- Sync finished
- Download completed
- Background operation completed
- User-visible alerts

Do not spam users with notifications for trivial events.

---

# 56. Clipboard — tauri-plugin-clipboard-manager

Use **tauri-plugin-clipboard-manager** when the application needs explicit clipboard integration.

Examples:

- Copy text
- Copy path
- Copy image
- Paste image
- Copy generated output

Avoid reading the clipboard continuously without a clear user-visible reason.

---

# 57. Global Shortcuts — tauri-plugin-global-shortcut

Use **tauri-plugin-global-shortcut** only when shortcuts must work while the app is not focused.

Good uses:

- Push-to-talk
- Quick capture
- Global launcher
- Media controls
- Screenshot utility

Do not register global shortcuts for normal in-app actions.

---

# 58. Single Instance — tauri-plugin-single-instance

Use **tauri-plugin-single-instance** when only one running instance of the application should exist.

Good uses:

- Editors
- Media libraries
- Launchers
- Apps opened via file association or deep link

Forward incoming file/deep-link arguments to the existing instance when appropriate.

---

# 59. Dates — date-fns

Use **date-fns** for non-trivial frontend date manipulation.

Good uses:

- Formatting
- Relative dates
- Date arithmetic
- Calendar helpers

Do not add it for one simple date string if native APIs are enough.

---

# 60. Rust Backend Responsibilities

Rust should generally own:

- Filesystem operations
- Native integration
- Database-heavy tasks
- HTTP with sensitive credentials
- Authentication token exchange
- Secure secret handling
- PDF/Excel/CSV generation
- Expensive calculations
- Directory scanning
- Hashing
- Media metadata extraction
- Batch processing
- External processes
- Long-running operations
- Performance-critical work

React should generally own:

- Presentation
- Interaction
- Local UI state
- Visual feedback
- Forms
- Navigation
- Component composition

---

# 61. Rust Service Architecture

Prefer focused internal services:

```text
AppService
FileService
DatabaseService
SettingsService
SearchService
AuthService
ApiService
EmailService
PdfService
SpreadsheetService
ArchiveService
NotificationService
UpdateService
ThumbnailService
MediaService
PlayerService
ImportService
ExportService
```

Tauri commands should be thin adapters over internal Rust services where practical.

---

# 62. Error Handling

Handle errors gracefully.

Use:

- Rust `Result`
- Structured errors
- User-friendly frontend messages
- Retry actions
- Fallback UI
- Placeholders
- Logging

Never crash the entire app because one item failed.

---

# 63. Performance

Potentially expensive tasks must not freeze the frontend.

Examples:

- Directory scanning
- Image processing
- Media analysis
- Database indexing
- Hashing
- HTTP transfers
- PDF generation
- Excel import/export
- ZIP creation/extraction
- Thumbnail generation
- FFmpeg processing

Use as appropriate:

- Async Rust tasks
- Worker threads
- Batched processing
- Lazy loading
- Virtualization
- Pagination
- Caching
- Debouncing
- Cancellation

---

# 64. Search

For large datasets:

```text
Input
  ↓
debounce
  ↓
Rust / DB query
  ↓
paged or virtualized results
```

Avoid loading the entire dataset into React just to filter it.

---

# 65. Keyboard Shortcuts

Use desktop keyboard shortcuts when appropriate.

Examples:

```text
Ctrl + K      Command palette
Ctrl + O      Open
Ctrl + S      Save
Ctrl + F      Search
Ctrl + ,      Settings
Esc           Close modal/viewer
Delete        Remove selected item
F11           Fullscreen
```

Avoid conflicting with active text inputs.

---

# 66. Context Menus

Use context menus for desktop workflows.

Example:

```text
Right click item
├── Open
├── Preview
├── Rename
├── Duplicate
├── Add to favorites
├── Show in folder
├── Copy path
├── Properties
└── Delete
```

Prefer shadcn/Base UI/Radix primitives.

---

# 67. Loading and Empty States

Use:

- Skeletons
- Inline spinners
- Progress bars
- Task indicators

Do not block the entire application unnecessarily.

Every major collection should also have a useful empty state.

---

# 68. Themes

Where appropriate, support:

- Light
- Dark
- System

Prefer CSS variables and design tokens.

Avoid scattering hard-coded colors throughout components.

---

# 69. Design System

Use reusable tokens for:

- Backgrounds
- Text
- Muted text
- Borders
- Primary actions
- Destructive actions
- Selection
- Hover state
- Radius
- Shadows
- Spacing

Maintain consistent UI across all modules.

---

# 70. Recommended Visual Direction

Unless the project has its own identity, prefer a modern desktop style inspired by:

- Linear
- Raycast
- VS Code
- Arc
- Modern media applications

Characteristics:

- Clean layouts
- Compact controls
- Subtle borders
- Moderate radius
- Good whitespace
- High information density
- Minimal unnecessary shadows
- Strong typography hierarchy
- Subtle animation

---

# 71. Accessibility

Ensure:

- Keyboard navigation
- Visible focus states
- Semantic controls
- Labels
- Good contrast
- Accessible dialogs
- Accessible menus
- Tooltips for icon-only controls

Prefer established accessible primitives over recreating them manually.

---

# 72. OPTIONAL MULTIMEDIA MODULE

The following dependencies apply only when the application needs multimedia.

They are not mandatory for ordinary Tauri applications.

---

# 73. Video Playback — mpv / libmpv

Use **mpv / libmpv** for advanced local video playback.

Use it when the app needs:

- Broad codec support
- MKV
- Multiple audio tracks
- Subtitle tracks
- Advanced seeking
- Playback speed
- Filters
- Desktop-grade playback
- Screenshots
- Better local media compatibility

The app should normally implement its own player controls.

mpv should act as the playback engine.

---

# 74. Tauri MPV Integration — tauri-plugin-libmpv

Use **tauri-plugin-libmpv** when suitable.

Before relying heavily on it:

- Verify current Tauri compatibility.
- Keep playback abstracted.
- Avoid coupling business logic to plugin-specific APIs.

Prefer an internal abstraction such as:

```text
VideoPlaybackService
```

---

# 75. Media Processing — FFmpeg

Use **FFmpeg** when media processing is required.

Examples:

- Thumbnails
- Preview images
- Preview clips
- Transcoding
- Audio extraction
- Video export
- Frame extraction
- Resizing
- Conversion

Run FFmpeg from Rust or as a controlled sidecar.

---

# 76. Media Metadata — ffprobe

Use **ffprobe** for media inspection.

Useful metadata includes:

- Duration
- Width
- Height
- FPS
- Video codec
- Audio codec
- Bitrate
- Container
- Audio channels
- Sample rate
- Streams
- Subtitle tracks
- HDR metadata

Cache expensive metadata.

---

# 77. Audio — WaveSurfer.js

Use **WaveSurfer.js** when a visual audio player or waveform is required.

Use its optional plugins only when needed:

- **Regions** — selections, loops, marked sections
- **Timeline** — time scale
- **Spectrogram** — spectral visualization

Do not enable heavy plugins by default.

---

# 78. Image Gallery — Yet Another React Lightbox

Use **Yet Another React Lightbox** for polished image viewing.

Optional plugins:

- **Zoom**
- **Fullscreen**
- **Thumbnails**

Use only the plugins required by the viewer.

---

# 79. Custom Image Zoom — react-zoom-pan-pinch

Use **react-zoom-pan-pinch** when a custom viewer needs direct control over:

- Zoom
- Pan
- Fit
- Reset
- Transform state

Do not combine it with YARL Zoom for the same viewer without a clear reason.

---

# 80. Image Metadata — ExifReader

Use **ExifReader** when EXIF/IPTC/XMP metadata is needed.

Examples:

- Camera
- Lens
- ISO
- Aperture
- Shutter speed
- Focal length
- Date
- Orientation
- GPS when intentionally supported

Do not expose sensitive GPS metadata unintentionally.

---

# 81. Image Editing — Konva / react-konva

Use **Konva** with **react-konva** for interactive canvas editing.

Examples:

- Text
- Shapes
- Drawing
- Arrows
- Annotations
- Selection
- Resize handles
- Stickers
- Crop overlays

Do not add Konva for a simple viewer.

---

# 82. Huge Images — OpenSeadragon

Use **OpenSeadragon** only for extremely large images where tiled deep zoom is beneficial.

Examples:

- Gigapixel images
- Large scans
- Maps
- Scientific imagery

Do not use it for ordinary images.

---

# 83. Rust Image Processing — image-rs

Use **image-rs** for backend image processing.

Examples:

- Read image dimensions
- Resize
- Generate thumbnails
- Generate previews
- Convert formats
- Basic transformations

Prefer Rust for large batch jobs.

---

# 84. WebP — image-webp

Use **image-webp** only when dedicated WebP functionality is actually required beyond the current image stack.

---

# 85. Multimedia Cache Strategy

Do not load full originals unnecessarily.

For images:

```text
Original
   ├── Thumbnail: 256–512 px
   ├── Preview:   1280–1920 px
   └── Original:  only when required
```

For video, cache where appropriate:

- Poster thumbnail
- Timeline thumbnails
- Metadata
- Optional preview clip

Use deterministic, collision-safe cache keys.

---

# 86. Large Media Libraries

For large libraries:

- Use SQLite indexing.
- Use TanStack Virtual.
- Cache thumbnails.
- Lazy-load images.
- Batch backend work.
- Avoid loading all metadata at once.
- Debounce search.
- Use incremental scanning.
- Handle deleted/moved files gracefully.

Design for tens of thousands of items, not only small collections.

---

# 87. Master Library Matrix

| Requirement | Preferred Tool |
|---|---|
| Desktop framework | Tauri 2 |
| Native/backend code | Rust |
| Frontend | React |
| Type safety | TypeScript |
| Build tooling | Vite |
| Styling | Tailwind CSS 4 |
| UI components | shadcn/ui |
| UI primitives | Base UI / Radix UI |
| Icons | Lucide React |
| Animations | Motion |
| Shared state | Zustand |
| Forms | React Hook Form |
| Validation | Zod |
| Toasts | Sonner |
| Command palette | cmdk |
| Advanced tables | TanStack Table |
| Virtualization | TanStack Virtual |
| Charts | Recharts |
| Resizable panels | react-resizable-panels |
| Drag & drop | dnd-kit |
| Local database | SQLite |
| Tauri database integration | tauri-plugin-sql |
| Lightweight settings | tauri-plugin-store |
| Serialization | serde / serde_json |
| Async runtime | Tokio |
| Structured errors | thiserror |
| Internal error context | anyhow |
| HTTP / REST | reqwest |
| Frontend HTTP | tauri-plugin-http |
| OAuth2 | oauth2 |
| OpenID Connect | openidconnect |
| OAuth callbacks / app links | tauri-plugin-deep-link |
| Secure secrets | tauri-plugin-stronghold |
| Local password hashing | argon2 |
| JWT | jsonwebtoken |
| SMTP email | lettre |
| Create PDF | printpdf |
| Manipulate PDF | lopdf |
| Render / inspect PDF | pdfium-render |
| Export Excel | rust_xlsxwriter |
| Import Excel | calamine |
| CSV | csv |
| ZIP | zip |
| Logging | tracing |
| Tauri logging | tauri-plugin-log |
| Auto updates | tauri-plugin-updater |
| Native notifications | tauri-plugin-notification |
| Clipboard | tauri-plugin-clipboard-manager |
| Global shortcuts | tauri-plugin-global-shortcut |
| Single instance | tauri-plugin-single-instance |
| Frontend dates | date-fns |
| Filesystem | tauri-plugin-fs |
| Native dialogs | tauri-plugin-dialog |
| External sidecars | tauri-plugin-shell |
| Open files/URLs | tauri-plugin-opener |
| Window persistence | tauri-plugin-window-state |
| Video playback | mpv / libmpv |
| Tauri MPV bridge | tauri-plugin-libmpv |
| Media processing | FFmpeg |
| Media inspection | ffprobe |
| Audio waveform | WaveSurfer.js |
| Audio regions | WaveSurfer Regions |
| Audio timeline | WaveSurfer Timeline |
| Spectrogram | WaveSurfer Spectrogram |
| Image gallery | Yet Another React Lightbox |
| Image gallery zoom | YARL Zoom |
| Image fullscreen | YARL Fullscreen |
| Image thumbnails | YARL Thumbnails |
| Custom image zoom/pan | react-zoom-pan-pinch |
| Image metadata | ExifReader |
| Canvas image editor | Konva / react-konva |
| Deep zoom | OpenSeadragon |
| Rust image processing | image-rs |
| WebP-specific support | image-webp |

---

# 88. Usage Examples

## Normal Settings Page

Use:

```text
React
Tailwind
shadcn/ui
React Hook Form
Zod
Sonner
tauri-plugin-store
```

Do not add multimedia dependencies.

---

## Login with Google / Microsoft

Use as needed:

```text
openidconnect
oauth2
tauri-plugin-deep-link
reqwest
tauri-plugin-stronghold
```

Do not store tokens in localStorage.

---

## REST API Client

Use:

```text
reqwest
serde
thiserror
```

Add authentication modules only when required.

---

## Email Client / SMTP Feature

Use:

```text
lettre
tauri-plugin-stronghold
```

only if SMTP is configured by the user or securely managed.

For application-owned transactional email, use a backend API.

---

## PDF Report Export

Use:

```text
printpdf
tauri-plugin-dialog
```

Add `lopdf` or `pdfium-render` only if manipulation or rendering is required.

---

## Excel Import / Export

Use:

```text
rust_xlsxwriter
calamine
tauri-plugin-dialog
```

Use only the read/write side actually required.

---

## Dashboard

Use as needed:

```text
shadcn/ui
Recharts
TanStack Table
Lucide
Motion
```

Use TanStack Virtual only for large datasets.

---

## File Manager

Use as needed:

```text
Tauri
Rust filesystem
tauri-plugin-dialog
tauri-plugin-opener
TanStack Virtual
dnd-kit
Context menus
```

---

## Image Library

Use as needed:

```text
TanStack Virtual
Yet Another React Lightbox
ExifReader
image-rs
SQLite
```

Add `react-konva` only if editing/annotation is required.

---

## Video Library

Use as needed:

```text
mpv / libmpv
FFmpeg
ffprobe
SQLite
TanStack Virtual
```

Do not use FFmpeg merely because the project contains videos.

---

## Audio Editor

Use as needed:

```text
WaveSurfer.js
Regions
Timeline
FFmpeg
```

Add Spectrogram only if specifically useful.

---

# 89. Dependency Decision Process

Before installing a dependency, ask:

```text
1. Does the project already solve this?
2. Is the dependency actually required?
3. Is there already a suitable dependency?
4. Is the task better implemented in Rust?
5. Does the library create unnecessary maintenance?
6. Does it overlap with another dependency?
7. Is it compatible with current project versions?
8. Does it increase the attack surface?
9. Does it require native binaries or special distribution handling?
```

If unnecessary, do not add it.

---

# 90. Avoid Reinvention

Prefer stable libraries for:

- Dialog accessibility
- Focus traps
- Dropdown positioning
- Command palettes
- Advanced tables
- Virtualization
- Drag and drop
- OAuth/OIDC flows
- Secure secret storage
- Excel parsing
- PDF rendering
- Image zoom
- Audio waveforms

Do not rebuild complex primitives without a clear reason.

---

# 91. Avoid Dependency Bloat

Do not add a third-party package for trivial operations such as:

- Basic string formatting
- Boolean toggles
- Simple array mapping
- Tiny utility functions
- Basic CSS transitions

Balance reuse with dependency discipline.

---

# 92. Security

The LLM must:

- Use Tauri capabilities carefully.
- Avoid overly broad filesystem permissions.
- Avoid unrestricted shell access.
- Validate paths from the frontend.
- Validate process arguments.
- Never interpolate raw user input into shell commands.
- Keep sensitive native logic in Rust.
- Avoid exposing secrets to the frontend.
- Store tokens and credentials securely.
- Validate imported files.
- Verify remote TLS.
- Avoid logging secrets.
- Verify update signatures.
- Treat external files as untrusted input.

---

# 93. Sensitive Data Rule

The following must NEVER be stored casually:

```text
Passwords
Access tokens
Refresh tokens
SMTP passwords
Private API keys
OAuth secrets
Database credentials
Private signing keys
```

Do not place them in:

```text
localStorage
sessionStorage
frontend source code
plain JSON
plain text files
logs
Git repositories
```

Prefer:

```text
Stronghold
OS secure storage
Backend-managed secrets
Environment/configuration only in trusted server environments
```

---

# 94. Path Handling

Use Rust path types:

```text
std::path::Path
std::path::PathBuf
```

Do not manually concatenate filesystem paths as strings.

Paths may contain:

- Spaces
- Unicode
- Accents
- Long filenames
- Platform-specific separators

---

# 95. Cross-Platform Behavior

Unless the project is explicitly Windows-only, consider:

- Windows
- macOS
- Linux

Isolate platform-specific code when needed.

---

# 96. Windows Considerations

For Windows-focused apps, consider:

- DPI scaling
- Multi-monitor restoration
- File associations
- Explorer integration
- Long paths
- Custom title bar behavior
- Native dialogs
- Taskbar behavior

Test at common DPI scales:

```text
100%
125%
150%
```

---

# 97. Maintainability

Prefer:

```text
small components
focused services
typed interfaces
clear state ownership
predictable data flow
```

Avoid:

```text
giant components
giant Zustand stores
giant Rust command modules
duplicated utilities
untyped payloads
magic strings everywhere
```

---

# 98. Type Safety

Prefer strong types across the Tauri boundary.

Use:

- TypeScript interfaces/types in frontend
- Rust structs in backend
- Predictable Tauri command payloads

Avoid arbitrary JSON blobs when a stable typed model is practical.

---

# 99. Logging

Use logging for useful operational information such as:

- Startup
- Database errors
- File scanning
- API failures
- Authentication failures without secrets
- Background jobs
- External process errors
- Import/export
- Native integrations

Do not spam logs with trivial UI events.

---

# 100. Configuration

Centralize configuration.

Examples:

```text
src/config/
src-tauri/src/config/
```

Possible values:

- Cache sizes
- Thumbnail dimensions
- File types
- Default layout
- Feature flags
- API base URLs
- Binary paths
- Timeout values

Do not hardcode environment-dependent values throughout the application.

---

# 101. Feature Flags

For large optional modules, consider feature flags.

Examples:

- Video
- Audio
- Image editing
- PDF tools
- Spreadsheet tools
- AI
- Experimental features

Avoid forcing heavy optional functionality into every build when modularity is practical.

---

# 102. Testing

Prioritize high-value tests.

Rust:

- Path handling
- Database services
- API client logic
- Authentication state handling
- File filtering
- Metadata parsing
- Cache keys
- PDF/Excel transformations
- Business rules

Frontend:

- Critical workflows
- Complex state logic
- Important form validation

Do not optimize for arbitrary coverage percentages.

---

# 103. UI Consistency

Before creating a new component:

1. Search existing components.
2. Reuse current patterns.
3. Reuse design tokens.
4. Reuse shadcn components where appropriate.
5. Create a new visual pattern only when justified.

Avoid multiple slightly different versions of the same button, card, toolbar, or modal.

---

# 104. Final Rules for the Coding LLM

The LLM MUST:

1. Inspect the existing project before changing architecture.
2. Preserve working patterns unless change is justified.
3. Use libraries from this guide only when their feature is required.
4. Avoid unnecessary dependencies.
5. Prefer Rust for native, sensitive, or heavy work.
6. Prefer React for presentation and interaction.
7. Keep the UI responsive.
8. Favor desktop UX over web-page UX.
9. Use virtualization for large collections.
10. Use SQLite for structured local persistence when appropriate.
11. Use Store only for simple preferences.
12. Keep secrets out of the frontend and plain storage.
13. Prefer Authorization Code + PKCE for desktop OAuth.
14. Keep external tools behind internal abstractions.
15. Validate filesystem and process inputs.
16. Avoid arbitrary shell execution.
17. Reuse existing components and dependencies.
18. Maintain consistent visual design.
19. Keep components and services focused.
20. Avoid giant files and giant global stores.
21. Handle errors gracefully.
22. Use caching where processing is expensive.
23. Treat imported files and network data as untrusted.
24. Avoid embedding company-owned secrets in distributed binaries.
25. Optimize only where complexity is justified.

---

# 105. Core Philosophy

The libraries in this document form a **preferred toolbox**, not a mandatory dependency list.

Use this process:

```text
Requirement
    ↓
Inspect existing project
    ↓
Choose simplest suitable tool
    ↓
Reuse existing dependency if possible
    ↓
Add preferred library only when beneficial
    ↓
Implement clean abstraction
```

The final application should feel like a real desktop product:

- Fast
- Cohesive
- Native-feeling
- Attractive
- Responsive
- Maintainable
- Secure
- Reliable

Use the tools described here according to the needs of each feature.
