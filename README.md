# FatGPT

A browser extension that allows you to adjust the conversation width in ChatGPT for a better reading experience. Perfect for wide monitors or when you prefer narrower text columns.

## ✨ Features

- 🖱️ **Click to adjust**: Use the popup slider to set your preferred conversation width
- ⌨️ **Keyboard shortcuts**:
  - `Alt + ]` to make conversations wider
  - `Alt + [` to make conversations narrower
  - `Alt + 0` to reset to ChatGPT's default width
  - `Alt + M` to maximize width
- 💾 **Remembers your preference**: Saves your width setting across sessions
- 🔄 **Customizable shortcuts**: Configure your own keyboard shortcuts
- 🌐 **Works everywhere**: Compatible with both `chatgpt.com` and `chat.openai.com`

## 📦 Installation

### From Extension Stores (Recommended)

**Chrome Web Store:**

1. Visit the [FatGPT Chrome Extension](https://chrome.google.com/webstore) _(coming soon)_
2. Click "Add to Chrome"
3. The FatGPT icon will appear in your toolbar

**Firefox Add-ons:**

1. Visit the [FatGPT Firefox Add-on](https://addons.mozilla.org) _(coming soon)_
2. Click "Add to Firefox"
3. The FatGPT icon will appear in your toolbar

## 🚀 Usage

1. **Click the FatGPT icon** in your browser toolbar to open the width adjustment popup
2. **Use the slider** or input field to set your preferred conversation width
3. **Or use keyboard shortcuts**:
   - `Alt + ]` to make wider
   - `Alt + [` to make narrower
   - `Alt + 0` to reset to default
   - `Alt + M` to maximize width
4. **Customize shortcuts** in the popup settings if needed

Your preference is automatically saved and will persist across browser sessions.

### Manual Installation (Development)

If you want to install the development version:

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

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Support & Issues

If you encounter any issues or have feature requests:

1. Check the [Issues](https://github.com/kstencell/fatgpt/issues) page
2. Create a new issue if needed
3. Provide clear details about your browser version and the problem

## 🛠️ Development

This extension supports multiple browsers with dedicated build processes for each platform.

### Project Structure

```
fatgpt/
├── content.js              # Main extension logic
├── popup.html              # Extension popup interface
├── popup.js                # Popup functionality
├── package.json            # Build configuration
├── manifests/
│   ├── manifest.chrome.json
│   └── manifest.firefox.json
└── icons/                  # Extension icons
```

### Build Commands

```bash
# Install dependencies
npm install

# Build for all browsers
npm run build

# Build for specific browsers
npm run build:chrome   # → dist/chrome/
npm run build:firefox  # → dist/firefox/

# Create distribution packages
npm run zip:chrome     # → dist/fatgpt-chrome.zip
npm run zip:firefox    # → dist/fatgpt-firefox.zip
```
