const TAG_OVERRIDES_KEY = 'inventar_tag_overrides';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function loadTagOverrides() {
    try {
        return JSON.parse(localStorage.getItem(TAG_OVERRIDES_KEY) || '{}');
    } catch {
        return {};
    }
}

function applyTagOverrides(items) {
    const overrides = loadTagOverrides();
    return items.map((item) => {
        const override = overrides[item.id];
        if (!override) return item;
        return {
            ...item,
            tags: {
                auto: item.tags?.auto || [],
                manual: Array.isArray(override.manual) ? override.manual : (item.tags?.manual || [])
            }
        };
    });
}

class InventarApp {
    constructor() {
        this.items = [];
        this.filteredItems = [];
        this.searchQuery = '';
        this.activeFilters = {
            color: [],
            size: [],
            room: [],
            price: []
        };

        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadItems();
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const pill = e.target.closest('.filter-pill');
            if (!pill) return;

            if (pill.id === 'clearAllFilters') {
                this.clearAllFilters();
            } else {
                this.toggleFilterPill(pill);
            }
        });

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.trim().toLowerCase();
                this.filterItems();
            });
        }

        document.getElementById('aboutBtn').addEventListener('click', () => {
            this.openAboutModal();
        });

        document.querySelectorAll('.close').forEach((btn) => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        document.getElementById('itemModal').addEventListener('click', (e) => {
            if (e.target.id === 'itemModal') this.closeModal();
        });

        document.getElementById('aboutModal').addEventListener('click', (e) => {
            if (e.target.id === 'aboutModal') this.closeAboutModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllModals();
        });
    }

    async loadItems() {
        try {
            this.showLoading(true);
            const response = await fetch('items.json', { cache: 'no-store' });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const allItems = await response.json();
            this.items = applyTagOverrides(allItems.filter((item) => item.folderType === 'inventar'));
            this.filterItems();
            this.showLoading(false);
        } catch (error) {
            console.error('Error loading items:', error);
            this.showError('Failed to load inventory. Please try again.');
            this.showLoading(false);
        }
    }

    getTagValue(item, tagType) {
        const allTags = [...(item.tags?.auto || []), ...(item.tags?.manual || [])];
        const tag = allTags.find((t) => t.toLowerCase().startsWith(`${tagType.toLowerCase()}:`));
        return tag ? tag.split(':').slice(1).join(':').trim().toLowerCase() : null;
    }

    itemSearchText(item) {
        const tags = [...(item.tags?.auto || []), ...(item.tags?.manual || [])].join(' ');
        return `${item.imageUrl || ''} ${item.sourceName || ''} ${item.category || ''} ${tags}`.toLowerCase();
    }

    renderItems() {
        const gridContainer = document.getElementById('gridContainer');
        gridContainer.innerHTML = '';

        this.filteredItems.forEach((item) => this.createGridItem(item, gridContainer));
        this.updateItemCount();

        const hasItems = this.items.length > 0;
        const hasMatches = this.filteredItems.length > 0;
        this.showEmptyState(!hasMatches, hasItems);
    }

    createGridItem(item, container) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'grid-item cursor-pointer group';
        itemDiv.innerHTML = `
            <div class="aspect-square overflow-hidden">
                <img
                    src="${escapeHtml(item.imageUrl)}"
                    alt="${escapeHtml(this.displayName(item))}"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                    onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='"
                >
            </div>
        `;

        itemDiv.addEventListener('click', () => this.openModal(item));
        container.appendChild(itemDiv);
    }

    displayName(item) {
        if (item.name) return item.name;
        const fileName = (item.sourceName || item.imageUrl || '').split('/').pop() || 'Item';
        return fileName.replace(/_processed/g, '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    }

    openModal(item) {
        const modal = document.getElementById('itemModal');
        const modalContent = document.getElementById('modalContent');
        const autoTags = item.tags?.auto || [];
        const manualTags = item.tags?.manual || [];
        const allTags = [...autoTags, ...manualTags];

        modalContent.innerHTML = `
            <div class="p-2">
                <div class="mb-6">
                    <img
                        src="${escapeHtml(item.imageUrl)}"
                        alt="${escapeHtml(this.displayName(item))}"
                        class="w-full h-auto max-h-[70vh] object-contain rounded-lg shadow-lg"
                    >
                </div>
                ${allTags.length > 0 ? `
                    <div class="mb-4">
                        <h3 class="text-lg font-semibold text-gray-900 mb-3">Tags</h3>
                        <div class="flex flex-wrap gap-2">
                            ${autoTags.map((tag) => `<span class="tag auto">${escapeHtml(tag)}</span>`).join('')}
                            ${manualTags.map((tag) => `<span class="tag manual">${escapeHtml(tag)}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('itemModal').style.display = 'none';
        this.unlockBodyIfNoModals();
    }

    openAboutModal() {
        document.getElementById('aboutModal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeAboutModal() {
        document.getElementById('aboutModal').style.display = 'none';
        this.unlockBodyIfNoModals();
    }

    closeAllModals() {
        this.closeModal();
        this.closeAboutModal();
    }

    unlockBodyIfNoModals() {
        const itemOpen = document.getElementById('itemModal').style.display === 'block';
        const aboutOpen = document.getElementById('aboutModal').style.display === 'block';
        if (!itemOpen && !aboutOpen) {
            document.body.style.overflow = 'auto';
        }
    }

    toggleFilterPill(pill) {
        const type = pill.dataset.type;
        const value = pill.dataset.value;
        if (!type || !value || !this.activeFilters[type]) return;

        if (this.activeFilters[type].includes(value)) {
            this.activeFilters[type] = this.activeFilters[type].filter((v) => v !== value);
            pill.classList.remove('active');
            pill.setAttribute('aria-pressed', 'false');
        } else {
            this.activeFilters[type].push(value);
            pill.classList.add('active');
            pill.setAttribute('aria-pressed', 'true');
        }

        this.filterItems();
    }

    clearAllFilters() {
        this.activeFilters = { color: [], size: [], room: [], price: [] };
        this.searchQuery = '';

        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';

        document.querySelectorAll('.filter-pill').forEach((pill) => {
            if (pill.id !== 'clearAllFilters') {
                pill.classList.remove('active');
                pill.setAttribute('aria-pressed', 'false');
            }
        });

        this.filterItems();
    }

    filterItems() {
        this.filteredItems = this.items.filter((item) => this.itemMatchesFilters(item));
        this.renderItems();
    }

    itemMatchesFilters(item) {
        if (this.searchQuery && !this.itemSearchText(item).includes(this.searchQuery)) {
            return false;
        }

        if (this.activeFilters.color.length > 0) {
            const itemColor = this.getTagValue(item, 'color');
            if (!itemColor || !this.activeFilters.color.some((color) => itemColor.includes(color))) {
                return false;
            }
        }

        if (this.activeFilters.size.length > 0) {
            const itemSize = this.getTagValue(item, 'size');
            if (!itemSize || !this.activeFilters.size.includes(itemSize)) {
                return false;
            }
        }

        if (this.activeFilters.room.length > 0) {
            const itemRoom = this.getTagValue(item, 'room');
            if (!itemRoom || !this.activeFilters.room.includes(itemRoom.replace(/\s+/g, ''))) {
                return false;
            }
        }

        if (this.activeFilters.price.length > 0) {
            const itemPrice = this.getTagValue(item, 'price');
            if (!itemPrice || !this.activeFilters.price.includes(itemPrice)) {
                return false;
            }
        }

        return true;
    }

    updateItemCount() {
        const countElement = document.getElementById('itemCount');
        const total = this.items.length;
        const shown = this.filteredItems.length;
        const filtering = this.searchQuery || Object.values(this.activeFilters).some((values) => values.length > 0);

        countElement.textContent = filtering
            ? `${shown} of ${total} items`
            : `${total} item${total !== 1 ? 's' : ''}`;
    }

    showLoading(show) {
        document.getElementById('loadingState').style.display = show ? 'flex' : 'none';
        document.getElementById('gridContainer').style.display = show ? 'none' : 'grid';
        if (show) document.getElementById('emptyState').style.display = 'none';
    }

    showEmptyState(show, hasItems = false) {
        const emptyState = document.getElementById('emptyState');
        const title = emptyState.querySelector('h3');
        const copy = emptyState.querySelector('p');

        if (show && hasItems) {
            title.textContent = 'No matching items';
            copy.textContent = 'Try clearing filters or searching for something else.';
        } else {
            title.textContent = 'No items found';
            copy.textContent = 'Add some images to your Google Drive folder to get started.';
        }

        emptyState.style.display = show ? 'block' : 'none';
        document.getElementById('gridContainer').style.display = show ? 'none' : 'grid';
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        errorDiv.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                <span>${escapeHtml(message)}</span>
                <button type="button" class="ml-4 text-white hover:text-gray-200" aria-label="Dismiss">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        errorDiv.querySelector('button').addEventListener('click', () => errorDiv.remove());
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new InventarApp();
});
