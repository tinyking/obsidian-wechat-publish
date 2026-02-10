# Agent Instructions for Obsidian WeChat Publish Plugin

This is an Obsidian plugin that converts Markdown to WeChat Official Account formatted HTML.

## Build Commands

```bash
# Install dependencies
npm install

# Development (watch mode - auto-rebuilds on changes)
npm run dev

# Production build (TypeScript check + minified bundle)
npm run build

# Version bump (updates manifest.json and versions.json)
npm run version

# Lint TypeScript files
npx eslint src/main.ts

# Lint all source files
npx eslint ./src/
```

## Code Style Guidelines

### Formatting
- **Indent**: Tabs (width: 4) - see `.editorconfig`
- **Line endings**: LF (Unix-style)
- **Charset**: UTF-8
- **Final newline**: Required

### TypeScript Conventions
- **Target**: ES6 with ESNext modules
- **Strict mode**: Enabled (strictNullChecks, noImplicitAny, noImplicitThis, etc.)
- **No unchecked indexed access**: Enabled - handle potentially undefined values
- **Unknown in catch variables**: Enabled - explicitly type error handling
- Prefer `async/await` over Promise chains
- Use explicit return types on public methods

### Naming Conventions
- **Classes**: PascalCase (e.g., `WechatCopyPlugin`, `WechatSettingTab`)
- **Interfaces**: PascalCase with descriptive names (e.g., `WechatPluginSettings`)
- **Constants**: UPPER_SNAKE_CASE for true constants (e.g., `DEFAULT_CSS`, `DEFAULT_SETTINGS`)
- **Variables/methods**: camelCase
- **Files**: camelCase for modules, descriptive names

### Imports
- Group imports: Obsidian API first, then external libraries, then local modules
- Use single quotes for strings
- Prefer direct named imports from 'obsidian'
- External deps: `markdown-it`, `juice`

### Error Handling
- Use `try/catch` blocks for async operations
- Type check errors before accessing properties: `error instanceof Error`
- Log errors to console for debugging
- Provide user feedback via `new Notice()` with clear messages
- Non-null assertion operator (`!`) allowed when safety is guaranteed

### Plugin Architecture
Keep `src/main.ts` minimal (plugin lifecycle only). Current structure:

```
src/
  main.ts           # Plugin entry point (~350 lines - consider splitting)
```

**Recommended split** if adding features:
- `settings.ts` - Settings interface and defaults
- `converter.ts` - Markdown transformation logic
- `css/` - Theme and styling

### Key Patterns

**Plugin lifecycle**:
```typescript
export default class MyPlugin extends Plugin {
  settings: MySettings;
  
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // Register commands, settings tab, events
  }
}
```

**Add command**:
```typescript
this.addCommand({
  id: 'unique-command-id',  // Stable - never change after release
  name: 'User-facing name',
  editorCallback: async (editor: Editor, view: MarkdownView) => {
    // Command logic
  }
});
```

**Register events safely** (auto-cleanup on unload):
```typescript
this.registerEvent(this.app.workspace.on("file-open", callback));
this.registerDomEvent(window, "resize", handler);
this.registerInterval(window.setInterval(() => {}, 1000));
```

**Settings persistence**:
```typescript
async loadSettings() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
}

async saveSettings() {
  await this.saveData(this.settings);
}
```

### CSS/Styling
- Default theme: "Purple Business" (仿 MDNice)
- Primary color: `rgb(119, 48, 152)` (purple)
- CSS stored in settings as `customCSS` string
- Inline styles using `juice` library for WeChat compatibility
- Settings UI: `.wechat-plugin-textarea` class for large CSS input

### Testing
- No automated tests - manual testing only
- Install for testing: Copy `main.js`, `manifest.json`, `styles.css` to:
  `<Vault>/.obsidian/plugins/obsidian-wechat-publish/`
- Reload Obsidian and enable plugin in Settings → Community plugins

### Release Checklist
1. Update version in `manifest.json` (SemVer)
2. Update `versions.json` with minAppVersion mapping
3. Run `npm run build` to generate `main.js`
4. Create GitHub release with tag matching manifest version
5. Attach `main.js`, `manifest.json`, `styles.css` as release assets

### Constraints & Guidelines
- **Never** change plugin `id` after release (stable API contract)
- Never commit `node_modules/`, `main.js`, or build artifacts to git
- Avoid Node.js/Electron APIs (plugin supports mobile: `isDesktopOnly: false`)
- No network requests without explicit user consent and documentation
- Don't collect vault contents or personal information
- Keep startup lightweight - defer heavy work
- Use stable command IDs - don't rename once released

### ESLint Configuration
- Uses `typescript-eslint` and `eslint-plugin-obsidianmd`
- Ignores: `node_modules/`, `main.js`, `esbuild.config.mjs`, etc.
- Run before committing: `npx eslint src/main.ts`

### Dependencies
- **Runtime**: `obsidian`, `markdown-it`, `juice`
- **Build**: `esbuild`, `typescript`, `@types/*`
- **Lint**: `eslint`, `typescript-eslint`, `eslint-plugin-obsidianmd`
- All runtime deps bundled into `main.js` by esbuild
