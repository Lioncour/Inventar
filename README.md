# Inventar - Personal Item Inventory

A beautiful, modern, and clean single-page web application for managing your personal item inventory with automated image processing.

## Features

- 🖼️ **Automated Image Ingestion**: Automatically detects and processes new images from Google Drive
- 🎨 **Background Removal**: Removes backgrounds from item images for a clean, professional look
- 🤖 **AI-Powered Auto-Tagging**: Automatically generates color and size tags for items
- ✏️ **Manual Tagging**: Add up to 3 additional descriptive tags per item
- 📱 **Responsive Design**: Clean, modern UI that works on all devices
- ♾️ **Infinite Scroll**: Smooth scrolling experience with lazy loading
- 🔍 **Modal Lightbox**: Click any item to view it in detail with all tags
- 🔐 **Admin Panel**: Password-protected interface for manual tag management
- 👕 **33+7 Capsule Wardrobe**: Dedicated clothing inventory with horizontal scrolling categories

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+), Tailwind CSS
- **Backend**: GitHub Actions for automation
- **APIs**: Google Drive API, Remove.bg API, Imagga API
- **Deployment**: GitHub Pages

## Setup Instructions

### 1. Repository Setup

1. Fork or clone this repository
2. Enable GitHub Pages in your repository settings
3. Set the source to "Deploy from a branch" and select "main"

### 2. Google Drive Setup

1. Create a Google Cloud Project
2. Enable the Google Drive API
3. Create a Service Account and download the JSON key
4. Create two folders in Google Drive:
   - **Inventar folder**: For general items (ID: `15qXM2hCZvobiMsP0zHzZdOU1S6BzJRqe`)
   - **33+7 folder**: For clothing items (create new folder and get its ID)
5. Share both folders with your service account email
6. Update the 33+7 folder ID in `process-images.js` (line 22)

### 3. API Keys Setup

1. **Remove.bg API**:
   - Sign up at [remove.bg](https://www.remove.bg/)
   - Get your API key from the dashboard

2. **Imagga API**:
   - Sign up at [imagga.com](https://imagga.com/)
   - Get your API key and secret from the dashboard

### 4. GitHub Secrets

Add the following secrets to your repository (Settings → Secrets and variables → Actions):

- `GOOGLE_DRIVE_FOLDER_ID`: Your Google Drive folder ID
- `GOOGLE_SERVICE_ACCOUNT_KEY`: Your service account JSON key (as a string)
- `REMOVE_BG_API_KEY`: Your Remove.bg API key
- `IMAGGA_API_KEY`: Your Imagga API key
- `IMAGGA_API_SECRET`: Your Imagga API secret

### 5. Admin Panel Access

The admin panel is accessible at `/admin.html` with the default password `admin123`. Change this in the `admin.html` file for security.

## File Structure

```
inventar/
├── index.html              # Main application page
├── admin.html              # Admin panel for manual tagging
├── script.js               # Main application JavaScript
├── items.json              # Database of items
├── process-images.js       # Image processing script
├── package.json            # Node.js dependencies
├── .github/
│   └── workflows/
│       └── process-images.yml  # GitHub Actions workflow
└── images/                 # Processed images directory
```

## How It Works

1. **Automated Workflow**: GitHub Actions runs every hour to check for new images
2. **Image Processing**: New images are downloaded, backgrounds removed, and analyzed
3. **Auto-Tagging**: AI analyzes images to generate color and size tags
4. **Database Update**: New items are added to `items.json`
5. **Deployment**: Changes are automatically deployed to GitHub Pages

## Manual Tagging

1. Navigate to `/admin.html`
2. Enter the admin password
3. Add or edit manual tags for any item
4. Click "Save Changes" to update the item

## Customization

### Styling
- Modify the Tailwind CSS classes in `index.html` and `admin.html`
- Update the custom CSS in the `<style>` sections

### Auto-Tagging
- Modify the `analyzeImage()` function in `process-images.js`
- Add more sophisticated image analysis logic

### Admin Security
- Change the password in `admin.html`
- Implement more robust authentication if needed

## Troubleshooting

### Images Not Processing
- Check that all API keys are correctly set in GitHub Secrets
- Verify the Google Drive folder is shared with the service account
- Check the GitHub Actions logs for error messages

### Admin Panel Not Working
- Ensure you're using the correct password
- Check browser console for JavaScript errors
- Verify `items.json` is accessible

### Styling Issues
- Clear browser cache
- Check that Tailwind CSS is loading correctly
- Verify all CSS classes are valid

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub.
