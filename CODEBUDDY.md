# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## Common Commands

**Install dependencies**
```bash
npm install
```

**Development mode (watch)**
```bash
npm run dev
```
Runs esbuild in watch mode, recompiling `src/main.ts` to `main.js` on changes.

**Production build**
```bash
npm run build
```
Compiles TypeScript, bundles with esbuild, and minifies output to `main.js`.

**Version bump**
```bash
npm run version
```
Updates `manifest.json` and `versions.json`, and stages files for commit.

**Linting**
```bash
npx eslint src/main.ts
```
Run ESLint to check code quality. Configured with TypeScript and Obsidian plugin rules.

## Architecture

This is a single-file Obsidian plugin that converts Markdown to WeChat Official Account formatted HTML. All code resides in `src/main.ts`.

### Core Pipeline

The plugin follows a sequential transformation pipeline when the "Copy to WeChat" command is invoked:

1. **Wiki Link Normalization**: Converts Obsidian-specific wiki link syntax `![[image.png]]` to standard Markdown image syntax `![](image.png)`, handling pipe-separated alt text and URL-encoding filenames with spaces.

2. **Markdown Rendering**: Uses `markdown-it` to convert normalized Markdown to HTML, configured with `html: true`, `breaks: true`, and `linkify: true`.

3. **Image Processing**: Parses the HTML with DOMParser, iterates through `<img>` tags, and converts local image files to Base64 data URIs using Obsidian's vault API. Skips HTTP URLs and existing Base64 data. Resolves file paths using `app.metadataCache.getFirstLinkpathDest()` relative to the current document path.

4. **CSS Injection**: Wraps HTML in a `.wechat-content` div and injects the custom CSS from settings.

5. **CSS Inlining**: Applies `juice` to inline all CSS styles into HTML elements, ensuring compatibility with the WeChat editor's restrictive environment.

6. **Clipboard Copying**: Writes both HTML and plain text to the clipboard using the Clipboard API with `ClipboardItem` objects.

### Key Components

**Settings Management**: The plugin exposes a settings tab with two controls—a "Reset style" button to restore the default purple business CSS theme, and a 20-row textarea for custom CSS editing. Settings are persisted via `loadData()`/`saveData()`.

**Image Handling**: The `readImageToBase64()` method reads binary files from the vault, converts Uint8Array to base64 using `window.btoa()`, and prepends the appropriate MIME type based on file extension (png, jpg/jpeg, gif, webp, svg).

**Default Theme**: The built-in "Purple Business" CSS theme replicates MDNice's styling with centered purple h2 headers with underlines, purple headings, gray text, styled blockquotes with purple borders, bold text with gray underlines, and custom code block styling.

### Technical Constraints

- The plugin requires Obsidian 0.15.0+ and works on both desktop and mobile (`isDesktopOnly: false`).
- Uses `esbuild` for bundling with external dependencies (obsidian, electron, CodeMirror modules, Node builtins) to keep the bundle size manageable.
- TypeScript is configured with strict mode and targets ES6 with ESNext modules.
- No tests are present—testing is done manually by building and copying artifacts to `.obsidian/plugins/obsidian-wechat-publish/`.

### Release Artifacts

The plugin releases three files at the root of the plugin directory:
- `main.js`: Bundled JavaScript from esbuild
- `manifest.json`: Plugin metadata
- `styles.css`: Currently empty but required by Obsidian's plugin loader
