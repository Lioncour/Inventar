const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const COLOR_PALETTE = [
    'red', 'green', 'blue', 'black', 'white', 'yellow',
    'purple', 'orange', 'pink', 'brown', 'gray', 'navy', 'beige'
];

const COLOR_ALIASES = {
    grey: 'gray',
    silver: 'gray',
    gold: 'yellow',
    golden: 'yellow',
    navy: 'blue',
    turquoise: 'blue',
    teal: 'green',
    khaki: 'beige',
    cream: 'white',
    ivory: 'white'
};

const SIZE_WORDS = ['tiny', 'small', 'medium', 'large'];

class ImageProcessor {
    constructor() {
        this.drive = null;
        this.itemsFile = 'items.json';
        this.imagesDir = 'images';
        this.existingItems = this.loadExistingItems();

        this.folders = {
            inventar: {
                id: process.env.INVENTAR_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID || '15qXM2hCZvobiMsP0zHzZdOU1S6BzJRqe',
                type: 'inventar',
                categories: ['color', 'size', 'price', 'room']
            },
            '33plus7': {
                id: process.env.CLOTHING_FOLDER_ID || '1DkEZ1NcOBmg9ljWJ2JKeZ_Hdy5Vc0KNq',
                type: 'clothing',
                categories: ['outerwear', 'accessories', 'bottoms', 'tops', 'shoes']
            }
        };
    }

    parseServiceAccountKey(raw) {
        if (!raw) {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
        }

        try {
            return JSON.parse(raw);
        } catch {
            try {
                return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
            } catch {
                throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON or base64 JSON');
            }
        }
    }

    async init() {
        const credentials = this.parseServiceAccountKey(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });

        this.drive = google.drive({ version: 'v3', auth });
        fs.mkdirSync(this.imagesDir, { recursive: true });
    }

    loadExistingItems() {
        try {
            if (fs.existsSync(this.itemsFile)) {
                return JSON.parse(fs.readFileSync(this.itemsFile, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading existing items:', error.message);
        }
        return [];
    }

    saveItems() {
        fs.writeFileSync(this.itemsFile, JSON.stringify(this.existingItems, null, 2) + '\n');
        console.log(`Saved ${this.existingItems.length} items`);
    }

    sanitizeFileName(fileName) {
        const ext = path.extname(fileName).toLowerCase() || '.jpg';
        const base = path.basename(fileName, path.extname(fileName))
            .normalize('NFKD')
            .replace(/[^\w-]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .slice(0, 80) || 'image';
        return `${base}${ext}`;
    }

    uniqueFilePath(fileName) {
        const safeName = this.sanitizeFileName(fileName);
        const ext = path.extname(safeName);
        const base = path.basename(safeName, ext);
        let candidate = path.join(this.imagesDir, safeName);
        let index = 1;
        while (fs.existsSync(candidate)) {
            candidate = path.join(this.imagesDir, `${base}_${index}${ext}`);
            index += 1;
        }
        return candidate;
    }

    async getDriveImages(folderType = 'inventar') {
        const folderConfig = this.folders[folderType];
        if (!folderConfig) {
            throw new Error(`Unknown folder type: ${folderType}`);
        }

        const images = [];
        let pageToken;

        try {
            do {
                const response = await this.drive.files.list({
                    q: `'${folderConfig.id}' in parents and mimeType contains 'image/' and trashed = false`,
                    fields: 'nextPageToken, files(id, name, mimeType, createdTime)',
                    orderBy: 'createdTime desc',
                    pageSize: 100,
                    pageToken,
                    supportsAllDrives: true,
                    includeItemsFromAllDrives: true
                });

                images.push(...(response.data.files || []));
                pageToken = response.data.nextPageToken;
            } while (pageToken);

            return images.map((image) => ({
                ...image,
                folderType,
                category: this.detectCategory(image.name, folderConfig.categories)
            }));
        } catch (error) {
            console.error(`Error fetching Google Drive images for ${folderType}:`, error.message);
            return [];
        }
    }

    detectCategory(fileName, availableCategories) {
        const name = fileName.toLowerCase();
        const categoryKeywords = {
            shoes: ['sko', 'shoe', 'shoes', 'sneakers', 'sneaker', 'boots', 'heels', 'flats', 'sandals', 'loafers', 'oxford', 'slippers'],
            bottoms: ['bukse', 'jeans', 'trousers', 'shorts', 'skirt', 'leggings', 'chinos', 'culottes', 'pants'],
            tops: ['genser', 'shirt', 'blouse', 'sweater', 'tank', 'polo', 'tunic', 'crop', 'tee', 't-shirt', 'trøye', 'troye'],
            outerwear: ['jakke', 'jacket', 'coat', 'blazer', 'cardigan', 'hoodie', 'vest', 'trench', 'parka', 'bomber'],
            accessories: ['veske', 'scarf', 'hat', 'belt', 'bag', 'watch', 'necklace', 'bracelet', 'sunglasses', 'gloves']
        };

        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            if (!availableCategories.includes(category)) continue;
            if (keywords.some((keyword) => name.includes(keyword))) {
                return category;
            }
        }

        return availableCategories.includes('tops') ? 'tops' : (availableCategories[0] || 'unknown');
    }

    async downloadImage(fileId, fileName) {
        const response = await this.drive.files.get(
            { fileId, alt: 'media', supportsAllDrives: true },
            { responseType: 'stream' }
        );

        const filePath = this.uniqueFilePath(fileName);
        const writer = fs.createWriteStream(filePath);

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(filePath));
            writer.on('error', reject);
        });
    }

    async removeBackground(imagePath) {
        if (!process.env.REMOVE_BG_API_KEY) {
            console.warn('REMOVE_BG_API_KEY not set; skipping background removal');
            return imagePath;
        }

        try {
            const formData = new FormData();
            formData.append('image_file', fs.createReadStream(imagePath));
            formData.append('size', 'auto');

            const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
                headers: {
                    ...formData.getHeaders(),
                    'X-Api-Key': process.env.REMOVE_BG_API_KEY
                },
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 20 * 1024 * 1024
            });

            const processedPath = imagePath.replace(/\.[^/.]+$/, '_processed.png');
            fs.writeFileSync(processedPath, response.data);
            console.log(`Removed background: ${processedPath}`);
            return processedPath;
        } catch (error) {
            const status = error.response?.status;
            console.error('Background removal failed:', status || error.message);
            return imagePath;
        }
    }

    tagLabel(tag) {
        if (!tag) return '';
        if (typeof tag.tag === 'string') return tag.tag;
        return tag.tag?.en || '';
    }

    normalizeColor(label) {
        const text = label.toLowerCase();
        for (const [alias, mapped] of Object.entries(COLOR_ALIASES)) {
            if (text.includes(alias)) return mapped;
        }
        return COLOR_PALETTE.find((color) => text.includes(color)) || null;
    }

    extractColors(tags) {
        const found = [];
        for (const tag of tags) {
            if ((tag.confidence || 0) < 25) continue;
            const color = this.normalizeColor(this.tagLabel(tag));
            if (color && !found.includes(color)) found.push(color);
        }
        return found;
    }

    async analyzeImage(imagePath, folderType = 'inventar') {
        const fallback = [];

        if (!process.env.IMAGGA_API_KEY || !process.env.IMAGGA_API_SECRET) {
            console.warn('Imagga credentials not set; skipping auto-tagging');
            return fallback;
        }

        try {
            const formData = new FormData();
            formData.append('image', fs.createReadStream(imagePath));

            const response = await axios.post('https://api.imagga.com/v2/tags', formData, {
                headers: {
                    ...formData.getHeaders(),
                    Authorization: `Basic ${Buffer.from(`${process.env.IMAGGA_API_KEY}:${process.env.IMAGGA_API_SECRET}`).toString('base64')}`
                },
                timeout: 60000
            });

            const tags = response.data?.result?.tags || [];
            return folderType === 'clothing'
                ? this.analyzeClothingTags(tags)
                : this.analyzeInventarTags(tags);
        } catch (error) {
            console.error('Image analysis failed:', error.response?.status || error.message);
            return fallback;
        }
    }

    analyzeClothingTags(tags) {
        const autoTags = [];
        const colors = this.extractColors(tags);

        if (colors.length >= 3) {
            autoTags.push('color:colorful');
        } else if (colors.length > 0) {
            autoTags.push(`color:${colors[0]}`);
        }

        const styleKeywords = ['casual', 'formal', 'sporty', 'elegant', 'vintage', 'modern', 'classic', 'trendy'];
        const styleTag = tags.find((tag) => {
            const label = this.tagLabel(tag).toLowerCase();
            return (tag.confidence || 0) > 30 && styleKeywords.some((style) => label.includes(style));
        });

        if (styleTag) {
            const label = this.tagLabel(styleTag).toLowerCase();
            const style = styleKeywords.find((word) => label.includes(word));
            autoTags.push(`style:${style}`);
        }

        return autoTags;
    }

    analyzeInventarTags(tags) {
        const autoTags = [];
        const colors = this.extractColors(tags);

        if (colors.length >= 3) {
            autoTags.push('color:colorful');
        } else if (colors.length > 0) {
            autoTags.push(`color:${colors[0]}`);
        }

        const sizeTag = tags.find((tag) => {
            const label = this.tagLabel(tag).toLowerCase();
            return (tag.confidence || 0) > 30 && SIZE_WORDS.some((size) => label.includes(size));
        });

        if (sizeTag) {
            const label = this.tagLabel(sizeTag).toLowerCase();
            const size = SIZE_WORDS.find((word) => label.includes(word));
            autoTags.push(`size:${size}`);
        }

        return autoTags;
    }

    isAlreadyProcessed(image, folderType) {
        return this.existingItems.some((item) => {
            if (item.folderType && item.folderType !== folderType) return false;
            if (item.driveFileId && item.driveFileId === image.id) return true;

            const existingName = path.basename(item.imageUrl || '');
            const sourceName = item.sourceName || existingName;
            const baseName = image.name.replace(/\.[^/.]+$/, '');
            const existingBase = sourceName.replace(/\.[^/.]+$/, '').replace(/_processed$/, '');

            return sourceName === image.name || existingBase === baseName;
        });
    }

    async processNewImages() {
        try {
            await this.init();

            for (const [folderName, folderConfig] of Object.entries(this.folders)) {
                console.log(`\n=== Processing ${folderName.toUpperCase()} folder ===`);

                const driveImages = await this.getDriveImages(folderName);
                console.log(`Found ${driveImages.length} images in ${folderName}`);

                const newImages = driveImages.filter((image) => !this.isAlreadyProcessed(image, folderConfig.type));
                console.log(`${newImages.length} new images to process in ${folderName}`);

                for (const image of newImages) {
                    try {
                        console.log(`Processing ${folderName} image: ${image.name} (${image.id})`);
                        const downloadedPath = await this.downloadImage(image.id, image.name);

                        const processedName = path.basename(downloadedPath).replace(/\.[^/.]+$/, '_processed.png');
                        const existingProcessedPath = path.join(this.imagesDir, processedName);

                        let processedPath;
                        if (fs.existsSync(existingProcessedPath)) {
                            processedPath = existingProcessedPath;
                        } else {
                            processedPath = await this.removeBackground(downloadedPath);
                        }

                        const autoTags = await this.analyzeImage(processedPath, folderConfig.type);

                        this.existingItems.push({
                            id: new Date().toISOString(),
                            driveFileId: image.id,
                            sourceName: image.name,
                            imageUrl: `images/${path.basename(processedPath)}`,
                            folderType: folderConfig.type,
                            category: image.category,
                            tags: {
                                auto: autoTags,
                                manual: []
                            }
                        });

                        if (downloadedPath !== processedPath && fs.existsSync(downloadedPath)) {
                            fs.unlinkSync(downloadedPath);
                        }

                        console.log(`Added ${folderName} item from ${image.name}`);
                    } catch (error) {
                        console.error(`Error processing ${folderName} image ${image.name}:`, error.message);
                    }
                }
            }

            this.saveItems();
            console.log('\nImage processing completed');
        } catch (error) {
            console.error('Error in processNewImages:', error.message);
            process.exit(1);
        }
    }
}

const processor = new ImageProcessor();
processor.processNewImages();
