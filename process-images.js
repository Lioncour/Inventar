const { google } = require('googleapis');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

    pythonCmd() {
        return process.env.PYTHON || 'python';
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
        if (credentials.client_email) {
            console.log(`Google Drive service account: ${credentials.client_email}`);
        }

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });

        this.drive = google.drive({ version: 'v3', auth });
        fs.mkdirSync(this.imagesDir, { recursive: true });

        const check = spawnSync(this.pythonCmd(), ['-c', 'import rembg, PIL; print("rembg ready")'], { encoding: 'utf8' });
        if (check.status !== 0) {
            throw new Error(`rembg is not available: ${check.stderr || check.stdout || 'unknown error'}`);
        }
        console.log(`Background removal: rembg ${process.env.BG_MODEL || 'birefnet-general'}`);
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

    removeBackgrounds(jobs) {
        const map = new Map();
        if (jobs.length === 0) return map;

        const args = ['remove-bg.py'];
        for (const job of jobs) {
            args.push(job.input, job.output);
        }

        console.log(`Running BiRefNet on ${jobs.length} image${jobs.length === 1 ? '' : 's'}...`);
        const result = spawnSync(this.pythonCmd(), args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'inherit'],
            env: process.env,
            maxBuffer: 20 * 1024 * 1024
        });

        if (result.status !== 0) {
            throw new Error(result.stderr || 'Background removal process failed');
        }

        const line = (result.stdout || '').split('\n').reverse().find((entry) => entry.startsWith('RESULT '));
        if (!line) {
            throw new Error('Background removal did not return results');
        }

        for (const row of JSON.parse(line.slice(7))) {
            map.set(row.input, row);
        }
        return map;
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
            const pending = [];

            for (const [folderName, folderConfig] of Object.entries(this.folders)) {
                console.log(`\n=== Processing ${folderName.toUpperCase()} folder ===`);

                const driveImages = await this.getDriveImages(folderName);
                console.log(`Found ${driveImages.length} images in ${folderName}`);

                const newImages = driveImages.filter((image) => !this.isAlreadyProcessed(image, folderConfig.type));
                console.log(`${newImages.length} new images to process in ${folderName}`);

                for (const image of newImages) {
                    console.log(`Downloading ${folderName} image: ${image.name} (${image.id})`);
                    const downloadedPath = await this.downloadImage(image.id, image.name);
                    const processedPath = downloadedPath.replace(/\.[^/.]+$/, '_processed.png');
                    pending.push({ image, folderConfig, folderName, downloadedPath, processedPath });
                }
            }

            const cutJobs = pending
                .filter((job) => !fs.existsSync(job.processedPath))
                .map((job) => ({ input: job.downloadedPath, output: job.processedPath }));

            const cutResults = this.removeBackgrounds(cutJobs);

            for (const job of pending) {
                try {
                    const cut = cutResults.get(job.downloadedPath);
                    const processedPath = fs.existsSync(job.processedPath) ? job.processedPath : job.downloadedPath;
                    const autoTags = cut?.ok ? (cut.tags || []) : [];

                    this.existingItems.push({
                        id: new Date().toISOString(),
                        driveFileId: job.image.id,
                        sourceName: job.image.name,
                        imageUrl: `images/${path.basename(processedPath)}`,
                        folderType: job.folderConfig.type,
                        category: job.image.category,
                        tags: {
                            auto: autoTags,
                            manual: []
                        }
                    });

                    if (processedPath !== job.downloadedPath && fs.existsSync(job.downloadedPath)) {
                        fs.unlinkSync(job.downloadedPath);
                    }

                    console.log(`Added ${job.folderName} item from ${job.image.name}`);
                } catch (error) {
                    console.error(`Error finishing ${job.image.name}:`, error.message);
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
