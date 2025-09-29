class InventarApp {
    constructor() {
        this.items = [];
        this.filteredItems = [];
        this.currentPage = 0;
        this.itemsPerPage = 20;
        this.isLoading = false;
        this.hasMoreItems = true;
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
        this.setupInfiniteScroll();
        this.resetGridContainerStyles();
    }

    setupEventListeners() {
        // Filter pill clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-pill')) {
                if (e.target.id === 'clearAllFilters') {
                    this.clearAllFilters();
                } else {
                    this.toggleFilterPill(e.target);
                }
            }
        });

        // About modal
        document.getElementById('aboutBtn').addEventListener('click', () => {
            this.openAboutModal();
        });

        // Modal close events
        const itemModal = document.getElementById('itemModal');
        const aboutModal = document.getElementById('aboutModal');
        const filterModal = document.getElementById('filterModal');
        const closeBtns = document.querySelectorAll('.close');
        
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal();
                this.closeAboutModal();
                this.closeFilterModal();
            });
        });

        itemModal.addEventListener('click', (e) => {
            if (e.target === itemModal) {
                this.closeModal();
            }
        });

        aboutModal.addEventListener('click', (e) => {
            if (e.target === aboutModal) {
                this.closeAboutModal();
            }
        });

        filterModal.addEventListener('click', (e) => {
            if (e.target === filterModal) {
                this.closeFilterModal();
            }
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeAboutModal();
                this.closeFilterModal();
            }
        });
    }

    async loadItems() {
        try {
            this.showLoading(true);
            const response = await fetch('items.json');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const allItems = await response.json();
            // Filter to only show inventar items, not clothing items
            this.items = allItems.filter(item => item.folderType === 'inventar');
            this.filteredItems = [...this.items];
            this.currentPage = 0;
            this.hasMoreItems = this.items.length > 0;
            
            this.updateItemCount();
            this.filterItems();
            this.showLoading(false);
            
            if (this.items.length === 0) {
                this.showEmptyState(true);
            }
        } catch (error) {
            console.error('Error loading items:', error);
            this.showError('Failed to load inventory. Please try again.');
            this.showLoading(false);
        }
    }

    async refreshItems() {
        this.items = [];
        this.filteredItems = [];
        this.currentPage = 0;
        this.hasMoreItems = true;
        document.getElementById('gridContainer').innerHTML = '';
        await this.loadItems();
    }

    getTagValue(item, tagType) {
        const allTags = [...(item.tags.auto || []), ...(item.tags.manual || [])];
        const tag = allTags.find(t => t.toLowerCase().startsWith(tagType.toLowerCase() + ':'));
        return tag ? tag.split(':')[1] : null;
    }

    renderItems() {
        const gridContainer = document.getElementById('gridContainer');
        gridContainer.innerHTML = ''; // Clear existing items
        
        const startIndex = this.currentPage * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredItems.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            const item = this.filteredItems[i];
            this.createGridItem(item, gridContainer);
        }
        
        this.currentPage++;
        this.hasMoreItems = endIndex < this.filteredItems.length;
    }

    createGridItem(item, container) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'grid-item cursor-pointer group';
        itemDiv.innerHTML = `
            <div class="aspect-square overflow-hidden">
                <img 
                    src="${item.imageUrl}" 
                    alt="Item ${item.id}"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                    onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='"
                >
            </div>
        `;
        
        itemDiv.addEventListener('click', () => {
            this.openModal(item);
        });
        
        container.appendChild(itemDiv);
    }

    openModal(item) {
        const modal = document.getElementById('itemModal');
        const modalContent = document.getElementById('modalContent');
        
        const allTags = [...(item.tags.auto || []), ...(item.tags.manual || [])];
        
        modalContent.innerHTML = `
            <div class="p-2">
                <div class="mb-6">
                    <img 
                        src="${item.imageUrl}" 
                        alt="Item"
                        class="w-full h-auto max-h-[80vh] object-contain rounded-lg shadow-lg"
                        onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='"
                    >
                </div>
                
                ${allTags.length > 0 ? `
                    <div class="mb-4">
                        <h3 class="text-lg font-semibold text-gray-900 mb-3">Tags</h3>
                        <div class="flex flex-wrap gap-2">
                            ${(item.tags.auto || []).map(tag => 
                                `<span class="tag auto">${tag}</span>`
                            ).join('')}
                            ${(item.tags.manual || []).map(tag => 
                                `<span class="tag manual">${tag}</span>`
                            ).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        const modal = document.getElementById('itemModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    openAboutModal() {
        const modal = document.getElementById('aboutModal');
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeAboutModal() {
        const modal = document.getElementById('aboutModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    openFilterModal() {
        const modal = document.getElementById('filterModal');
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        this.updateFilterOptions();
    }

    closeFilterModal() {
        const modal = document.getElementById('filterModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    toggleFilterOption(option) {
        const type = option.dataset.type;
        const value = option.dataset.value;
        
        if (this.activeFilters[type].includes(value)) {
            this.activeFilters[type] = this.activeFilters[type].filter(v => v !== value);
            option.classList.remove('active');
        } else {
            this.activeFilters[type].push(value);
            option.classList.add('active');
        }
    }

    toggleFilterPill(pill) {
        const type = pill.dataset.type;
        const value = pill.dataset.value;
        
        if (this.activeFilters[type].includes(value)) {
            this.activeFilters[type] = this.activeFilters[type].filter(v => v !== value);
            pill.classList.remove('active');
        } else {
            this.activeFilters[type].push(value);
            pill.classList.add('active');
        }
        
        this.filterItems();
    }

    updateFilterOptions() {
        // Update filter option states based on active filters
        document.querySelectorAll('.filter-option').forEach(option => {
            const type = option.dataset.type;
            const value = option.dataset.value;
            
            if (this.activeFilters[type].includes(value)) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }

    applyFilters() {
        this.filterItems();
        this.closeFilterModal();
    }

    clearAllFilters() {
        this.activeFilters = {
            color: [],
            size: [],
            room: [],
            price: []
        };
        
        // Update UI - clear both old filter options and new filter pills
        document.querySelectorAll('.filter-option').forEach(option => {
            option.classList.remove('active');
        });
        
        document.querySelectorAll('.filter-pill').forEach(pill => {
            if (pill.id !== 'clearAllFilters') {
                pill.classList.remove('active');
            }
        });
        
        // Reset grid container styles before filtering to prevent overlay
        this.resetGridContainerStyles();
        this.filterItems();
    }

    filterItems() {
        const gridContainer = document.getElementById('gridContainer');
        
        // Add filtering animation
        gridContainer.style.opacity = '0.5';
        gridContainer.style.transform = 'scale(0.98)';
        
        setTimeout(() => {
            this.filteredItems = this.items.filter(item => {
                return this.itemMatchesFilters(item);
            });
            
            this.currentPage = 0;
            this.hasMoreItems = this.filteredItems.length > 0;
            
            this.renderItems();
            this.updateActiveFiltersDisplay();
            
            // Complete animation - ensure opacity is fully reset
            gridContainer.style.opacity = '1';
            gridContainer.style.transform = 'scale(1)';
            
            // Double-check that opacity is reset after a short delay
            setTimeout(() => {
                gridContainer.style.opacity = '1';
                gridContainer.style.transform = 'scale(1)';
            }, 50);
        }, 200);
    }

    itemMatchesFilters(item) {
        const allTags = [...(item.tags.auto || []), ...(item.tags.manual || [])];
        
        // Check color filter
        if (this.activeFilters.color.length > 0) {
            const itemColor = this.getTagValue(item, 'color');
            if (!itemColor || !this.activeFilters.color.includes(itemColor.toLowerCase())) {
                return false;
            }
        }
        
        // Check size filter
        if (this.activeFilters.size.length > 0) {
            const itemSize = this.getTagValue(item, 'size');
            if (!itemSize || !this.activeFilters.size.includes(itemSize.toLowerCase())) {
                return false;
            }
        }
        
        // Check room filter
        if (this.activeFilters.room.length > 0) {
            const itemRoom = this.getTagValue(item, 'room');
            if (!itemRoom || !this.activeFilters.room.includes(itemRoom.toLowerCase())) {
                return false;
            }
        }
        
        // Check price filter
        if (this.activeFilters.price.length > 0) {
            const itemPrice = parseFloat(this.getTagValue(item, 'price')) || 0;
            let priceMatches = false;
            
            for (const priceRange of this.activeFilters.price) {
                if (priceRange === '0-25' && itemPrice >= 0 && itemPrice <= 25) priceMatches = true;
                else if (priceRange === '25-50' && itemPrice > 25 && itemPrice <= 50) priceMatches = true;
                else if (priceRange === '50-100' && itemPrice > 50 && itemPrice <= 100) priceMatches = true;
                else if (priceRange === '100-200' && itemPrice > 100 && itemPrice <= 200) priceMatches = true;
                else if (priceRange === '200+' && itemPrice > 200) priceMatches = true;
            }
            
            if (!priceMatches) return false;
        }
        
        return true;
    }

    updateActiveFiltersDisplay() {
        const activeFiltersDiv = document.getElementById('activeFilters');
        const filterChipsDiv = document.getElementById('filterChips');
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');
        
        // Clear existing chips
        filterChipsDiv.innerHTML = '';
        
        // Check if any filters are active
        const hasActiveFilters = Object.values(this.activeFilters).some(filters => filters.length > 0);
        
        if (hasActiveFilters) {
            activeFiltersDiv.style.display = 'block';
            clearFiltersBtn.style.display = 'inline-block';
            
            // Add filter chips
            Object.entries(this.activeFilters).forEach(([type, values]) => {
                values.forEach(value => {
                    const chip = document.createElement('div');
                    chip.className = 'filter-chip';
                    chip.innerHTML = `
                        ${type}: ${value}
                        <span class="remove" data-type="${type}" data-value="${value}">&times;</span>
                    `;
                    
                    // Add remove functionality
                    chip.querySelector('.remove').addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.removeFilter(type, value);
                    });
                    
                    filterChipsDiv.appendChild(chip);
                });
            });
        } else {
            activeFiltersDiv.style.display = 'none';
            clearFiltersBtn.style.display = 'none';
        }
    }

    removeFilter(type, value) {
        this.activeFilters[type] = this.activeFilters[type].filter(v => v !== value);
        this.filterItems();
    }


    setupInfiniteScroll() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && this.hasMoreItems && !this.isLoading) {
                    this.loadMoreItems();
                }
            });
        }, {
            rootMargin: '100px'
        });

        // Create a sentinel element for infinite scroll
        const sentinel = document.createElement('div');
        sentinel.id = 'scrollSentinel';
        sentinel.className = 'h-4';
        document.getElementById('gridContainer').appendChild(sentinel);
        observer.observe(sentinel);
    }

    async loadMoreItems() {
        if (this.isLoading || !this.hasMoreItems) return;
        
        this.isLoading = true;
        
        // Simulate a small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const gridContainer = document.getElementById('gridContainer');
        const startIndex = this.currentPage * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredItems.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            const item = this.filteredItems[i];
            this.createGridItem(item, gridContainer);
        }
        
        this.currentPage++;
        this.hasMoreItems = endIndex < this.filteredItems.length;
        this.isLoading = false;
    }

    updateItemCount() {
        const countElement = document.getElementById('itemCount');
        countElement.textContent = `${this.items.length} item${this.items.length !== 1 ? 's' : ''}`;
    }

    showLoading(show) {
        const loadingState = document.getElementById('loadingState');
        const gridContainer = document.getElementById('gridContainer');
        
        if (show) {
            loadingState.style.display = 'flex';
            gridContainer.style.display = 'none';
        } else {
            loadingState.style.display = 'none';
            gridContainer.style.display = 'grid';
        }
    }

    showEmptyState(show) {
        const emptyState = document.getElementById('emptyState');
        const gridContainer = document.getElementById('gridContainer');
        
        if (show) {
            emptyState.style.display = 'block';
            gridContainer.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            gridContainer.style.display = 'grid';
        }
    }

    resetGridContainerStyles() {
        const gridContainer = document.getElementById('gridContainer');
        if (gridContainer) {
            gridContainer.style.opacity = '1';
            gridContainer.style.transform = 'scale(1)';
        }
    }

    showError(message) {
        // Create a simple error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        errorDiv.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new InventarApp();
});
