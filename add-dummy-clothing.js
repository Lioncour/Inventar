const fs = require('fs');

// Read existing items.json
let items = [];
try {
    const data = fs.readFileSync('items.json', 'utf8');
    items = JSON.parse(data);
} catch (error) {
    console.log('No existing items.json found, creating new one');
}

// Generate dummy clothing items
const clothingItems = {
    outerwear: [
        { name: 'Black Leather Jacket', color: 'black', price: 150 },
        { name: 'Navy Blazer', color: 'navy', price: 120 },
        { name: 'Gray Cardigan', color: 'gray', price: 80 },
        { name: 'Brown Trench Coat', color: 'brown', price: 200 },
        { name: 'White Bomber Jacket', color: 'white', price: 100 },
        { name: 'Red Hoodie', color: 'red', price: 60 }
    ],
    accessories: [
        { name: 'Black Leather Belt', color: 'black', price: 40 },
        { name: 'Brown Leather Bag', color: 'brown', price: 80 },
        { name: 'Blue Scarf', color: 'blue', price: 25 },
        { name: 'Gray Beanie', color: 'gray', price: 20 },
        { name: 'Gold Watch', color: 'gold', price: 200 },
        { name: 'Black Sunglasses', color: 'black', price: 50 }
    ],
    bottoms: [
        { name: 'Blue Jeans', color: 'blue', price: 70 },
        { name: 'Black Trousers', color: 'black', price: 60 },
        { name: 'Gray Chinos', color: 'gray', price: 55 },
        { name: 'White Shorts', color: 'white', price: 35 },
        { name: 'Navy Skirt', color: 'navy', price: 45 },
        { name: 'Brown Leggings', color: 'brown', price: 30 }
    ],
    tops: [
        { name: 'White T-Shirt', color: 'white', price: 20 },
        { name: 'Black Blouse', color: 'black', price: 40 },
        { name: 'Blue Shirt', color: 'blue', price: 35 },
        { name: 'Gray Sweater', color: 'gray', price: 50 },
        { name: 'Red Tank Top', color: 'red', price: 15 },
        { name: 'Green Polo', color: 'green', price: 30 }
    ],
    shoes: [
        { name: 'Black Sneakers', color: 'black', price: 90 },
        { name: 'Brown Boots', color: 'brown', price: 120 },
        { name: 'White Flats', color: 'white', price: 60 },
        { name: 'Navy Loafers', color: 'navy', price: 80 },
        { name: 'Red Heels', color: 'red', price: 70 },
        { name: 'Gray Sandals', color: 'gray', price: 40 }
    ]
};

// Generate dummy clothing items
let newItems = [];
let itemId = items.length + 1;

for (const [category, items] of Object.entries(clothingItems)) {
    for (const item of items) {
        const newItem = {
            id: itemId++,
            name: item.name,
            imageUrl: `https://via.placeholder.com/400x400/${item.color === 'navy' ? '1E3A8A' : item.color === 'gold' ? 'FFD700' : item.color}/FFFFFF?text=${encodeURIComponent(item.name)}`,
            folderType: 'clothing',
            category: category,
            tags: {
                auto: [`color:${item.color}`, `price:${item.price}`, `category:${category}`],
                manual: []
            },
            addedDate: new Date().toISOString()
        };
        newItems.push(newItem);
    }
}

// Add new items to existing items
const updatedItems = [...items, ...newItems];

// Write back to items.json
fs.writeFileSync('items.json', JSON.stringify(updatedItems, null, 2));

console.log(`✅ Added ${newItems.length} dummy clothing items to items.json`);
console.log('Categories added:');
Object.keys(clothingItems).forEach(category => {
    const count = clothingItems[category].length;
    console.log(`  - ${category}: ${count} items`);
});

console.log('\n🚀 The 33+7 page will now display these dummy items!');
console.log('You can visit your 33+7 page to see them in action.');
