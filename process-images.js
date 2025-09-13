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

    async getDriveImages() {
        try {
        const response = await this.drive.files.list({
            q: `'15qXM2hCZvobiMsP0zHzZdOU1S6BzJRqe' in parents and mimeType contains 'image/'`,
                fields: 'files(id, name, mimeType, createdTime, size)',
                orderBy: 'createdTime desc'
            });

            return response.data.files || [];
        } catch (error) {
            console.error('Error fetching Google Drive images:', error);
            return [];
        }
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
            const formData = new FormData();
            formData.append('image_file', fs.createReadStream(imagePath));
            formData.append('size', 'auto');

            const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
                headers: {
                    ...formData.getHeaders(),
                    'X-Api-Key': process.env.REMOVE_BG_API_KEY
                },
                responseType: 'arraybuffer'
            });

            const processedPath = imagePath.replace(/\.[^/.]+$/, '_processed.png');
            fs.writeFileSync(processedPath, response.data);
            
            return processedPath;
        } catch (error) {
            console.error('Error removing background:', error);
            // Return original image if background removal fails
            return imagePath;
        }
    }

    async analyzeImage(imagePath) {
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
            
            // Extract color and size information
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
        } catch (error) {
            console.error('Error analyzing image:', error);
            // Return default tags if analysis fails
            return ['color:unknown', 'size:medium'];
        }
    }

    async processNewImages() {
        try {
            await this.init();
            
            const driveImages = await this.getDriveImages();
            console.log(`Found ${driveImages.length} images in Google Drive`);

            const existingImageNames = this.existingItems.map(item => 
                path.basename(item.imageUrl)
            );

            const newImages = driveImages.filter(image => 
                !existingImageNames.includes(image.name)
            );

            console.log(`Found ${newImages.length} new images to process`);

            for (const image of newImages) {
                try {
                    console.log(`Processing image: ${image.name}`);
                    
                    // Download image
                    const downloadedPath = await this.downloadImage(image.id, image.name);
                    
                    // Remove background
                    const processedPath = await this.removeBackground(downloadedPath);
                    
                    // Analyze image for auto-tagging
                    const autoTags = await this.analyzeImage(processedPath);
                    
                    // Create new item
                    const newItem = {
                        id: new Date().toISOString(),
                        imageUrl: `images/${path.basename(processedPath)}`,
                        tags: {
                            auto: autoTags,
                            manual: []
                        }
                    };

                    this.existingItems.push(newItem);
                    console.log(`Added new item: ${newItem.id}`);
                    
                    // Clean up original downloaded file if different from processed
                    if (downloadedPath !== processedPath) {
                        fs.unlinkSync(downloadedPath);
                    }
                    
                } catch (error) {
                    console.error(`Error processing image ${image.name}:`, error);
                }
            }

            // Save updated items
            this.saveItems();
            console.log('Image processing completed successfully');

        } catch (error) {
            console.error('Error in processNewImages:', error);
            process.exit(1);
        }
    }
}

// Run the image processor
const processor = new ImageProcessor();
processor.processNewImages();
