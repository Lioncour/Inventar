// Script to generate dummy images for testing
const fs = require('fs');
const path = require('path');

// Create dummy images directory
const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

// Generate 40 dummy images with different colors and sizes
const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown', 'gray', 'black'];
const sizes = ['small', 'medium', 'large'];
const rooms = ['bedroom', 'living room', 'kitchen', 'bathroom', 'office', 'garage'];
const items = ['book', 'lamp', 'chair', 'table', 'vase', 'clock', 'picture', 'box', 'cup', 'toy'];

// Create SVG placeholder images
for (let i = 1; i <= 40; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    const item = items[Math.floor(Math.random() * items.length)];
    const price = Math.floor(Math.random() * 500) + 10;
    
    const svgContent = `
<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <rect x="50" y="50" width="200" height="200" fill="${color}" opacity="0.8" rx="10"/>
    <text x="150" y="120" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="white" font-weight="bold">${item}</text>
    <text x="150" y="150" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="white">${size}</text>
    <text x="150" y="180" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="white">$${price}</text>
    <text x="150" y="210" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="white">${room}</text>
</svg>`;

    const filename = `dummy-item-${i.toString().padStart(2, '0')}.svg`;
    const filepath = path.join(imagesDir, filename);
    
    fs.writeFileSync(filepath, svgContent);
    console.log(`Generated ${filename}`);
}

console.log('Generated 40 dummy images successfully!');
