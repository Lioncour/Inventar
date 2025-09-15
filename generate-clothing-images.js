const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class ClothingImageGenerator {
    constructor() {
        this.drive = null;
        this.folderId = '1DkEZ1NcOBmg9ljWJ2JKeZ_Hdy5Vc0KNq'; // Your 33+7 folder ID
    }

    async init() {
        // Initialize Google Drive API
        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
            scopes: ['https://www.googleapis.com/auth/drive.file']
        });
        
        this.drive = google.drive({ version: 'v3', auth });
    }

    generateSVGImage(category, item, color, width = 400, height = 400) {
        const colors = {
            black: '#000000',
            white: '#FFFFFF',
            navy: '#1E3A8A',
            gray: '#6B7280',
            beige: '#F5F5DC',
            brown: '#8B4513',
            red: '#DC2626',
            blue: '#2563EB',
            green: '#16A34A',
            yellow: '#EAB308',
            purple: '#9333EA',
            orange: '#EA580C',
            pink: '#EC4899'
        };

        const svgContent = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${colors[color] || '#FFFFFF'};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${colors[color] || '#FFFFFF'};stop-opacity:0.8" />
        </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)" stroke="#E5E7EB" stroke-width="2"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" 
          font-family="Arial, sans-serif" font-size="24" font-weight="bold" 
          fill="#1F2937">${item}</text>
    <text x="50%" y="70%" text-anchor="middle" dominant-baseline="middle" 
          font-family="Arial, sans-serif" font-size="16" 
          fill="#6B7280">${color}</text>
</svg>`.trim();

        return svgContent;
    }

    async uploadImageToDrive(svgContent, fileName) {
        try {
            const fileMetadata = {
                name: fileName,
                parents: [this.folderId]
            };

            const media = {
                mimeType: 'image/svg+xml',
                body: svgContent
            };

            const response = await this.drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });

            console.log(`Uploaded: ${fileName} (ID: ${response.data.id})`);
            return response.data.id;
        } catch (error) {
            console.error(`Error uploading ${fileName}:`, error);
            return null;
        }
    }

    async generateAndUploadClothingImages() {
        try {
            await this.init();
            console.log('Starting clothing image generation...');

            const clothingItems = {
                outerwear: [
                    { name: 'Black Leather Jacket', color: 'black' },
                    { name: 'Navy Blazer', color: 'navy' },
                    { name: 'Gray Cardigan', color: 'gray' },
                    { name: 'Brown Trench Coat', color: 'brown' },
                    { name: 'White Bomber Jacket', color: 'white' },
                    { name: 'Red Hoodie', color: 'red' }
                ],
                accessories: [
                    { name: 'Black Leather Belt', color: 'black' },
                    { name: 'Brown Leather Bag', color: 'brown' },
                    { name: 'Blue Scarf', color: 'blue' },
                    { name: 'Gray Beanie', color: 'gray' },
                    { name: 'Gold Watch', color: 'yellow' },
                    { name: 'Black Sunglasses', color: 'black' }
                ],
                bottoms: [
                    { name: 'Blue Jeans', color: 'blue' },
                    { name: 'Black Trousers', color: 'black' },
                    { name: 'Gray Chinos', color: 'gray' },
                    { name: 'White Shorts', color: 'white' },
                    { name: 'Navy Skirt', color: 'navy' },
                    { name: 'Brown Leggings', color: 'brown' }
                ],
                tops: [
                    { name: 'White T-Shirt', color: 'white' },
                    { name: 'Black Blouse', color: 'black' },
                    { name: 'Blue Shirt', color: 'blue' },
                    { name: 'Gray Sweater', color: 'gray' },
                    { name: 'Red Tank Top', color: 'red' },
                    { name: 'Green Polo', color: 'green' }
                ],
                shoes: [
                    { name: 'Black Sneakers', color: 'black' },
                    { name: 'Brown Boots', color: 'brown' },
                    { name: 'White Flats', color: 'white' },
                    { name: 'Navy Loafers', color: 'navy' },
                    { name: 'Red Heels', color: 'red' },
                    { name: 'Gray Sandals', color: 'gray' }
                ]
            };

            let uploadedCount = 0;
            const totalItems = Object.values(clothingItems).flat().length;

            for (const [category, items] of Object.entries(clothingItems)) {
                console.log(`\nGenerating ${category} items...`);
                
                for (const item of items) {
                    const fileName = `${category}_${item.name.toLowerCase().replace(/\s+/g, '_')}.svg`;
                    const svgContent = this.generateSVGImage(category, item.name, item.color);
                    
                    const fileId = await this.uploadImageToDrive(svgContent, fileName);
                    if (fileId) {
                        uploadedCount++;
                    }
                    
                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            console.log(`\n✅ Successfully uploaded ${uploadedCount}/${totalItems} clothing images to your 33+7 folder!`);
            console.log('The GitHub Action will now process these images automatically.');

        } catch (error) {
            console.error('Error generating clothing images:', error);
            process.exit(1);
        }
    }
}

// Run the generator
const generator = new ClothingImageGenerator();
generator.generateAndUploadClothingImages();

