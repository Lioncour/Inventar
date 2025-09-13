# Inventar Setup Guide

## Quick Start

1. **Clone and Deploy**
   ```bash
   git clone <your-repo-url>
   cd inventar
   # Enable GitHub Pages in repository settings
   ```

2. **Test Locally**
   ```bash
   # Option 1: Use the deploy script
   chmod +x deploy.sh
   ./deploy.sh
   
   # Option 2: Use Python
   python -m http.server 8000
   # Open http://localhost:8000
   ```

3. **Set Up APIs** (Required for full functionality)
   - Google Drive API
   - Remove.bg API
   - Imagga API

## File Overview

### Core Files
- `index.html` - Main application interface
- `admin.html` - Admin panel for manual tagging
- `script.js` - Frontend JavaScript logic
- `items.json` - Database of inventory items

### Automation
- `process-images.js` - Image processing script
- `.github/workflows/process-images.yml` - GitHub Actions workflow

### Configuration
- `package.json` - Node.js dependencies
- `config.example.js` - Configuration template
- `.gitignore` - Git ignore rules

### Documentation
- `README.md` - Complete project documentation
- `SETUP_GUIDE.md` - This quick setup guide
- `test-setup.html` - Setup verification page

## Testing the Setup

1. Open `test-setup.html` in your browser
2. Check that all components are working
3. Verify JSON loading and directory access
4. Follow the next steps outlined in the test page

## Default Credentials

- **Admin Panel**: Password is `admin123` (change in admin.html)

## Next Steps

1. Set up Google Cloud Project
2. Configure API keys
3. Add GitHub secrets
4. Upload test images to Google Drive
5. Test the automated workflow

For detailed instructions, see `README.md`.
