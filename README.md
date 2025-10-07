# FatGPT

A simple browser extension that allows you to adjust the conversation width in ChatGPT for a better reading experience.

## Features

- 🖱️ **Click to adjust**: Use the popup to set your preferred conversation width
- ⌨️ **Keyboard shortcuts**:
  - `Alt + ]` to make conversations wider
  - `Alt + [` to make conversations narrower
- 💾 **Remembers your preference**: Saves your width setting across sessions
- 🔄 **Easy reset**: Quickly return to ChatGPT's default width

## Development

This extension supports multiple browsers with dedicated build processes for each platform.

### Project Structure

The extension maintains separate manifest files for different browsers:

- `manifests/manifest.chrome.json` - Chrome/Chromium-based browsers
- `manifests/manifest.firefox.json` - Firefox/Mozilla-based browsers

### Build Commands

Build for all supported browsers:

```bash
npm run build
```

Build for specific browsers:

```bash
npm run build:chrome   # Builds Chrome version to dist/chrome/
npm run build:firefox  # Builds Firefox version to dist/firefox/
```

Create distribution packages:

```bash
npm run zip:chrome     # Creates dist/fatgpt-chrome.zip
npm run zip:firefox    # Creates dist/fatgpt-firefox.zip
```

## Installation for Local Development

### Chrome

1. Download or clone this repository
2. Run `npm run build:chrome` to build the Chrome version
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the `dist/chrome/` folder
6. The FatGPT icon will appear in your toolbar

### Firefox

1. Download or clone this repository
2. Run `npm run build:firefox` to build the Firefox version
3. Open Firefox and go to `about:debugging`
4. Click "This Firefox" in the sidebar
5. Click "Load Temporary Add-on"
6. Navigate to the `dist/firefox/` folder and select `manifest.json`
7. The FatGPT icon will appear in your toolbar

## Usage

- Click the FatGPT icon in your browser toolbar to open the width adjustment popup
- Use the slider or input field to set your preferred conversation width
- Or use keyboard shortcuts: `Alt + ]` (wider) and `Alt + [` (narrower)

Works on both `chatgpt.com` and `chat.openai.com`.
