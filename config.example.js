// Example configuration file for Inventar
// Copy this to config.js and fill in your actual values

const config = {
    // Google Drive Configuration
    googleDrive: {
        inventar: {
            folderId: '15qXM2hCZvobiMsP0zHzZdOU1S6BzJRqe', // Your Inventar folder ID
            serviceAccountKey: 'YOUR_SERVICE_ACCOUNT_JSON_KEY' // JSON as string
        },
        '33plus7': {
            folderId: 'YOUR_33PLUS7_FOLDER_ID', // Or set CLOTHING_FOLDER_ID in GitHub Actions
            serviceAccountKey: 'YOUR_SERVICE_ACCOUNT_JSON_KEY'
        }
    },
    
    // Admin Panel
    admin: {
        password: 'admin123' // Change this for security
    },
    
    // Image Processing
    imageProcessing: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        backgroundRemoval: {
            engine: 'local', // @imgly/background-removal-node in GitHub Actions
            format: 'png'
        }
    },
    
    // UI Configuration
    ui: {
        itemsPerPage: 20,
        infiniteScrollOffset: 100, // pixels from bottom
        modalAnimationDuration: 300 // milliseconds
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
}
