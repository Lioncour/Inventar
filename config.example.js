// Example configuration file for Inventar
// Copy this to config.js and fill in your actual values

const config = {
    // Google Drive Configuration
    googleDrive: {
        folderId: '15qXM2hCZvobiMsP0zHzZdOU1S6BzJRqe', // Your specific folder ID
        serviceAccountKey: 'YOUR_SERVICE_ACCOUNT_JSON_KEY' // JSON as string
    },
    
    // API Keys
    apis: {
        removeBg: {
            apiKey: 'YOUR_REMOVE_BG_API_KEY'
        },
        imagga: {
            apiKey: 'YOUR_IMAGGA_API_KEY',
            apiSecret: 'YOUR_IMAGGA_API_SECRET'
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
            size: 'auto', // auto, preview, full
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
