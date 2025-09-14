class InventarApp {
    constructor() {
        this.items = [];
        this.currentPage = 0;
        this.itemsPerPage = 20;
        this.isLoading = false;
        this.hasMoreItems = true;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadItems();
        this.setupInfiniteScroll();
    }

    setupEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshItems();
        });

        // Modal close events
        const modal = document.getElementById('itemModal');
        const closeBtn = document.querySelector('.close');
        
        closeBtn.addEventListener('click', () => {
            this.closeModal();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
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
            
            this.items = await response.json();
            this.currentPage = 0;
            this.hasMoreItems = this.items.length > 0;
            
            this.updateItemCount();
            this.renderItems();
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
        this.currentPage = 0;
        this.hasMoreItems = true;
        document.getElementById('gridContainer').innerHTML = '';
        await this.loadItems();
    }

    renderItems() {
        const gridContainer = document.getElementById('gridContainer');
        const startIndex = this.currentPage * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.items.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            const item = this.items[i];
            this.createGridItem(item, gridContainer);
        }
        
        this.currentPage++;
        this.hasMoreItems = endIndex < this.items.length;
    }

    createGridItem(item, container) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'grid-item cursor-pointer group';
        itemDiv.innerHTML = `
            <div class="aspect-square bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
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
        
        this.renderItems();
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
