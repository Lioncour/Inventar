const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const PALETTE_RGB = {
    red: [200, 40, 40],
    green: [40, 150, 70],
    blue: [40, 80, 190],
    black: [25, 25, 25],
    white: [245, 245, 245],
    yellow: [230, 200, 50],
    purple: [130, 50, 170],
    orange: [230, 120, 40],
    pink: [230, 110, 160],
    brown: [130, 80, 45],
    gray: [140, 140, 140],
    navy: [20, 40, 90],
    beige: [210, 190, 160]
};

class ImageProcessor {
    constructor() {
        this.drive = null;
        this.itemsFile = 'items.json';
        this.imagesDir = 'images';
        this.existingItems = this.loadExistingItems();
        this.removeBackgroundFn = null;

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

    imglyDistPath() {
        const candidates = [
            path.join(process.cwd(), '.ci-node', 'node_modules', '@imgly', 'background-removal-node', 'dist'),
            path.join(process.cwd(), 'node_modules', '@imgly', 'background-removal-node', 'dist')
        ];
        const found = candidates.find((candidate) => fs.existsSync(candidate));
        if (!found) {
            throw new Error('Could not find @imgly/background-removal-node dist folder');
        }
        return `file://${found.replace(/\\/g, '/')}/`;
    }

    async init() {
        const credentials = this.parseServiceAccountKey(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        if (credentials.client_email) {
            console.log(`Google Drive service account: ${credentials.client_email}`);
        }

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });

        this.drive = google.drive({ version: 'v3', auth });
        fs.mkdirSync(this.imagesDir, { recursive: true });

        const imgly = await import('@imgly/background-removal-node');
        this.removeBackgroundFn = imgly.removeBackground;
        console.log(`Local background-removal model path: ${this.imglyDistPath()}`);
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
        const next = JSON.stringify(this.existingItems, null, 2) + '\n';
        const previous = fs.existsSync(this.itemsFile) ? fs.readFileSync(this.itemsFile, 'utf8') : '';
        if (previous === next) {
            console.log('No item changes to save');
            return;
        }
        fs.writeFileSync(this.itemsFile, next);
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
        try {
            const blob = await this.removeBackgroundFn(imagePath, {
                publicPath: this.imglyDistPath(),
                model: 'medium',
                output: {
                    format: 'image/png',
                    type: 'foreground'
                },
                progress: (key, current, total) => {
                    if (total) {
                        console.log(`Downloading ${key}: ${current}/${total}`);
                    }
                }
            });

            const processedPath = imagePath.replace(/\.[^/.]+$/, '_processed.png');
            const buffer = Buffer.from(await blob.arrayBuffer());
            fs.writeFileSync(processedPath, buffer);
            console.log(`Removed background locally: ${processedPath}`);
            return processedPath;
        } catch (error) {
            console.error('Local background removal failed:', error.message);
            return imagePath;
        }
    }

    nearestPaletteColor(r, g, b) {
        let bestName = 'gray';
        let bestDistance = Infinity;
        for (const [name, [pr, pg, pb]] of Object.entries(PALETTE_RGB)) {
            const distance = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
            if (distance < bestDistance) {
                bestDistance = distance;
                bestName = name;
            }
        }
        return bestName;
    }

    async analyzeImage(imagePath) {
        try {
            const sharp = require('sharp');
            const { data, info } = await sharp(imagePath).ensureAlpha().resize(64, 64, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
            const counts = {};
            let visible = 0;

            for (let i = 0; i < data.length; i += info.channels) {
                const alpha = info.channels > 3 ? data[i + 3] : 255;
                if (alpha < 40) continue;
                visible += 1;
                const name = this.nearestPaletteColor(data[i], data[i + 1], data[i + 2]);
                counts[name] = (counts[name] || 0) + 1;
            }

            const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            if (!visible || ranked.length === 0) return [];

            const [topColor, topCount] = ranked[0];
            const second = ranked[1];
            if (second && second[1] / visible > 0.22 && topCount / visible < 0.55) {
                return ['color:colorful'];
            }
            return [`color:${topColor}`];
        } catch (error) {
            console.warn('Local color analysis skipped:', error.message);
            return [];
        }
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

                        const autoTags = await this.analyzeImage(processedPath);

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
