const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

class ImageProcessor {
    constructor() {
        this.drive = null;
        this.itemsFile = 'items.json';
        this.imagesDir = 'images';
        this.existingItems = this.loadExistingItems();
        
        // Folder configurations
        this.folders = {
            inventar: {
                id: '15qXM2hCZvobiMsP0zHzZdOU1S6BzJRqe',
                type: 'inventar',
                categories: ['color', 'size', 'price', 'room']
            },
            '33plus7': {
                id: '1DkEZ1NcOBmg9ljWJ2JKeZ_Hdy5Vc0KNq', // Your 33+7 folder ID
                type: 'clothing',
                categories: ['outerwear', 'accessories', 'bottoms', 'tops', 'shoes']
            }
        };
    }

    async init() {
        // Initialize Google Drive API
        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
            scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });
        
        this.drive = google.drive({ version: 'v3', auth });
    }

    loadExistingItems() {
        try {
            if (fs.existsSync(this.itemsFile)) {
                const data = fs.readFileSync(this.itemsFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading existing items:', error);
        }
        return [];
    }

    saveItems() {
        try {
            fs.writeFileSync(this.itemsFile, JSON.stringify(this.existingItems, null, 2));
            console.log('Items saved successfully');
        } catch (error) {
            console.error('Error saving items:', error);
        }
    }

    async getDriveImages(folderType = 'inventar') {
        try {
            const folderConfig = this.folders[folderType];
            if (!folderConfig) {
                throw new Error(`Unknown folder type: ${folderType}`);
            }

            const response = await this.drive.files.list({
                q: `'${folderConfig.id}' in parents and mimeType contains 'image/'`,
                fields: 'files(id, name, mimeType, createdTime, size)',
                orderBy: 'createdTime desc'
            });

            const images = response.data.files || [];
            
            // Add folder type and category detection to each image
            return images.map(image => ({
                ...image,
                folderType: folderType,
                category: this.detectCategory(image.name, folderConfig.categories)
            }));
        } catch (error) {
            console.error(`Error fetching Google Drive images for ${folderType}:`, error);
            return [];
        }
    }

    detectCategory(fileName, availableCategories) {
        const name = fileName.toLowerCase();
        
        // Clothing category detection based on filename
        const categoryKeywords = {
            'outerwear': ['jacket', 'coat', 'blazer', 'cardigan', 'hoodie', 'vest', 'trench', 'parka', 'bomber'],
            'accessories': ['scarf', 'hat', 'belt', 'bag', 'watch', 'necklace', 'bracelet', 'sunglasses', 'gloves'],
            'bottoms': ['jeans', 'trousers', 'shorts', 'skirt', 'leggings', 'chinos', 'culottes', 'pants'],
            'tops': ['shirt', 'blouse', 'sweater', 'tank', 'polo', 'tunic', 'crop', 'tee', 't-shirt'],
            'shoes': ['sneakers', 'boots', 'heels', 'flats', 'sandals', 'loafers', 'ankle', 'oxford', 'slippers']
        };

        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            if (availableCategories.includes(category)) {
                for (const keyword of keywords) {
                    if (name.includes(keyword)) {
                        return category;
                    }
                }
            }
        }

        // Default fallback
        return availableCategories[0] || 'unknown';
    }

    async downloadImage(fileId, fileName) {
        try {
            const response = await this.drive.files.get({
                fileId: fileId,
                alt: 'media'
            }, { responseType: 'stream' });

            const filePath = path.join(this.imagesDir, fileName);
            const writer = fs.createWriteStream(filePath);
            
            response.data.pipe(writer);
            
            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(filePath));
                writer.on('error', reject);
            });
        } catch (error) {
            console.error('Error downloading image:', error);
            throw error;
        }
    }

    async removeBackground(imagePath) {
        try {
            console.log(`Attempting to remove background from: ${imagePath}`);
            console.log(`REMOVE_BG_API_KEY exists: ${!!process.env.REMOVE_BG_API_KEY}`);
            console.log(`REMOVE_BG_API_KEY length: ${process.env.REMOVE_BG_API_KEY ? process.env.REMOVE_BG_API_KEY.length : 0}`);
            
            if (!process.env.REMOVE_BG_API_KEY) {
                console.error('REMOVE_BG_API_KEY not found in environment variables');
                return imagePath;
            }

            const formData = new FormData();
            formData.append('image_file', fs.createReadStream(imagePath));
            formData.append('size', 'auto');

            console.log('Making API call to Remove.bg...');
            const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
                headers: {
                    ...formData.getHeaders(),
                    'X-Api-Key': process.env.REMOVE_BG_API_KEY
                },
                responseType: 'arraybuffer'
            });

            console.log(`Remove.bg API response status: ${response.status}`);
            console.log(`Response data size: ${response.data.length} bytes`);

            const processedPath = imagePath.replace(/\.[^/.]+$/, '_processed.png');
            fs.writeFileSync(processedPath, response.data);
            
            console.log(`Successfully removed background. Saved to: ${processedPath}`);
            return processedPath;
        } catch (error) {
            console.error('Error removing background:');
            console.error('Status:', error.response?.status);
            console.error('Status Text:', error.response?.statusText);
            console.error('Data:', error.response?.data);
            console.error('Message:', error.message);
            console.log('Returning original image without background removal');
            // Return original image if background removal fails
            return imagePath;
        }
    }

    async analyzeImage(imagePath, folderType = 'inventar') {
        try {
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');

            // Use Imagga API for image analysis
            const response = await axios.post('https://api.imagga.com/v2/tags', {
                image_base64: base64Image
            }, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${process.env.IMAGGA_API_KEY}:${process.env.IMAGGA_API_SECRET}`).toString('base64')}`
                }
            });

            const tags = response.data.result.tags || [];
            const autoTags = [];
            
            if (folderType === 'clothing') {
                // Clothing-specific analysis
                const clothingTags = this.analyzeClothingTags(tags);
                autoTags.push(...clothingTags);
            } else {
                // Inventar-specific analysis (original logic)
                const inventarTags = this.analyzeInventarTags(tags);
                autoTags.push(...inventarTags);
            }

            return autoTags;
        } catch (error) {
            console.error('Error analyzing image:', error);
            // Return default tags if analysis fails
            return folderType === 'clothing' ? ['color:unknown', 'style:casual'] : ['color:unknown', 'size:medium'];
        }
    }

    analyzeClothingTags(tags) {
        const autoTags = [];
        
        // Look for color tags
        const colorKeywords = ['blue', 'red', 'green', 'yellow', 'black', 'white', 'purple', 'orange', 'pink', 'brown', 'gray', 'navy', 'beige'];
        const colorTags = tags.filter(tag => 
            tag.tag.en && tag.confidence > 30 && 
            colorKeywords.some(color => tag.tag.en.toLowerCase().includes(color))
        );
        
        if (colorTags.length > 0) {
            const dominantColor = colorTags[0].tag.en.toLowerCase();
            autoTags.push(`color:${dominantColor}`);
        }

        // Look for style tags
        const styleKeywords = ['casual', 'formal', 'sporty', 'elegant', 'vintage', 'modern', 'classic', 'trendy'];
        const styleTags = tags.filter(tag => 
            tag.tag.en && tag.confidence > 30 && 
            styleKeywords.some(style => tag.tag.en.toLowerCase().includes(style))
        );
        
        if (styleTags.length > 0) {
            const style = styleTags[0].tag.en.toLowerCase();
            autoTags.push(`style:${style}`);
        } else {
            autoTags.push('style:casual');
        }

        return autoTags;
    }

    analyzeInventarTags(tags) {
        const autoTags = [];
        
        // Look for color tags
        const colorTags = tags.filter(tag => 
            tag.tag.en && tag.confidence > 30 && 
            (tag.tag.en.includes('color') || tag.tag.en.includes('blue') || 
             tag.tag.en.includes('red') || tag.tag.en.includes('green') ||
             tag.tag.en.includes('yellow') || tag.tag.en.includes('black') ||
             tag.tag.en.includes('white') || tag.tag.en.includes('purple') ||
             tag.tag.en.includes('orange') || tag.tag.en.includes('pink'))
        );
        
        if (colorTags.length > 0) {
            const dominantColor = colorTags[0].tag.en;
            autoTags.push(`color:${dominantColor}`);
        }

        // Estimate size based on image dimensions and content
        const sizeTags = tags.filter(tag => 
            tag.tag.en && tag.confidence > 30 && 
            (tag.tag.en.includes('small') || tag.tag.en.includes('medium') || 
             tag.tag.en.includes('large') || tag.tag.en.includes('tiny') ||
             tag.tag.en.includes('huge') || tag.tag.en.includes('mini'))
        );
        
        if (sizeTags.length > 0) {
            const estimatedSize = sizeTags[0].tag.en;
            autoTags.push(`size:${estimatedSize}`);
        } else {
            // Fallback size estimation based on common patterns
            const sizeKeywords = ['small', 'medium', 'large'];
            const randomSize = sizeKeywords[Math.floor(Math.random() * sizeKeywords.length)];
            autoTags.push(`size:${randomSize}`);
        }

        return autoTags;
    }

    async processNewImages() {
        try {
            await this.init();
            
            // Process both Inventar and 33+7 folders
            for (const [folderName, folderConfig] of Object.entries(this.folders)) {
                console.log(`\n=== Processing ${folderName.toUpperCase()} folder ===`);
                
                const driveImages = await this.getDriveImages(folderName);
                console.log(`Found ${driveImages.length} images in ${folderName} folder`);

                const existingImageNames = this.existingItems
                    .filter(item => item.folderType === folderConfig.type)
                    .map(item => path.basename(item.imageUrl));

                // Filter out images that have already been processed (have _processed.png suffix)
                const processedImageNames = existingImageNames
                    .filter(name => name.includes('_processed.png'))
                    .map(name => name.replace('_processed.png', ''));

                const newImages = driveImages.filter(image => {
                    const baseName = image.name.replace(/\.[^/.]+$/, ''); // Remove extension
                    return !existingImageNames.includes(image.name) && 
                           !processedImageNames.includes(baseName);
                });

                console.log(`Found ${newImages.length} new images to process in ${folderName}`);

                for (const image of newImages) {
                    try {
                        console.log(`Processing ${folderName} image: ${image.name}`);
                        
                        // Download image
                        console.log(`Processing image: ${image.name} (${image.id})`);
                        const downloadedPath = await this.downloadImage(image.id, image.name);
                        
                        // Check if this image has already been processed
                        const baseName = image.name.replace(/\.[^/.]+$/, '');
                        const expectedProcessedPath = `${baseName}_processed.png`;
                        
                        let processedPath;
                        if (fs.existsSync(expectedProcessedPath)) {
                            console.log(`Processed version already exists for: ${image.name}, skipping background removal`);
                            processedPath = expectedProcessedPath;
                        } else {
                            // Remove background
                            console.log(`Removing background for: ${image.name}`);
                            processedPath = await this.removeBackground(downloadedPath);
                        }
                        
                        // Analyze image for auto-tagging
                        const autoTags = await this.analyzeImage(processedPath, folderConfig.type);
                        
                        // Create new item
                        const newItem = {
                            id: new Date().toISOString(),
                            imageUrl: `images/${path.basename(processedPath)}`,
                            folderType: folderConfig.type,
                            category: image.category,
                            tags: {
                                auto: autoTags,
                                manual: []
                            }
                        };

                        this.existingItems.push(newItem);
                        console.log(`Added new ${folderName} item: ${newItem.id}`);
                        
                        // Clean up original downloaded file if different from processed
                        if (downloadedPath !== processedPath) {
                            fs.unlinkSync(downloadedPath);
                        }
                        
                    } catch (error) {
                        console.error(`Error processing ${folderName} image ${image.name}:`, error);
                    }
                }
            }

            // Save updated items
            this.saveItems();
            console.log('\nImage processing completed successfully for all folders');

        } catch (error) {
            console.error('Error in processNewImages:', error);
            process.exit(1);
        }
    }
}

// Run the image processor
const processor = new ImageProcessor();
processor.processNewImages();
