// ===============================
// Modern Municipal Platform Frontend
// Anand Municipal Corporation 2.0
// ===============================

// Global configuration
const CONFIG = {
    API_BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api' 
        : '/api',
    SOCKET_URL: window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : window.location.origin,
    MAPS: {
        DEFAULT_LAT: 22.5645,
        DEFAULT_LNG: 72.9289,
        ZOOM_LEVEL: 13
    },
    CATEGORIES: {
        'roads': 'Roads & Footpaths',
        'water': 'Water Supply',
        'garbage': 'Garbage Collection',
        'streetlights': 'Street Lights',
        'drainage': 'Drainage Issues',
        'parks': 'Parks & Public Spaces',
        'buildings': 'Public Buildings',
        'traffic': 'Traffic Issues',
        'noise': 'Noise Pollution',
        'other': 'Other Issues'
    }
};

// Global state management
const AppState = {
    user: null,
    issues: [],
    notifications: [],
    selectedLocation: null,
    selectedPhotos: [],
    socket: null,
    filters: {
        category: '',
        status: '',
        search: ''
    }
};

// ===============================
// Utility Functions
// ===============================

// API wrapper with authentication
const api = {
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...options.headers
            },
            ...options
        };

        if (options.body && !(options.body instanceof FormData)) {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Auth methods
    auth: {
        async login(email, password) {
            return api.request('/auth/login', {
                method: 'POST',
                body: { email, password }
            });
        },
        
        async register(userData) {
            return api.request('/auth/register', {
                method: 'POST',
                body: userData
            });
        },
        
        async getCurrentUser() {
            return api.request('/auth/me');
        },
        
        async logout() {
            return api.request('/auth/logout', { method: 'POST' });
        }
    },

    // Issues methods
    issues: {
        async getAll(params = {}) {
            const queryString = new URLSearchParams(params).toString();
            return api.request(`/issues?${queryString}`);
        },
        
        async getById(id) {
            return api.request(`/issues/${id}`);
        },
        
        async create(formData) {
            return api.request('/issues', {
                method: 'POST',
                body: formData,
                headers: {} // Let fetch set the headers for FormData
            });
        },
        
        async update(id, data) {
            return api.request(`/issues/${id}`, {
                method: 'PUT',
                body: data
            });
        },
        
        async updateStatus(id, status, notes) {
            return api.request(`/issues/${id}/status`, {
                method: 'PATCH',
                body: { status, notes }
            });
        },
        
        async upvote(id) {
            return api.request(`/issues/${id}/upvote`, {
                method: 'POST'
            });
        }
    }
};

// Modern notification system
class NotificationManager {
    constructor() {
        this.container = this.createContainer();
        this.queue = [];
        this.maxNotifications = 5;
    }

    createContainer() {
        const container = document.createElement('div');
        container.className = 'notification-container';
        container.innerHTML = `
            <style>
                .notification-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    pointer-events: none;
                }
                
                .notification {
                    background: white;
                    border-radius: 12px;
                    padding: 16px 20px;
                    margin-bottom: 12px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    max-width: 400px;
                    pointer-events: all;
                    animation: slideInRight 0.3s ease;
                    border-left: 4px solid;
                    position: relative;
                    overflow: hidden;
                }
                
                .notification.success { border-left-color: #27ae60; }
                .notification.error { border-left-color: #e74c3c; }
                .notification.warning { border-left-color: #f39c12; }
                .notification.info { border-left-color: #3498db; }
                
                .notification-icon {
                    font-size: 20px;
                    margin-top: 2px;
                }
                
                .notification.success .notification-icon { color: #27ae60; }
                .notification.error .notification-icon { color: #e74c3c; }
                .notification.warning .notification-icon { color: #f39c12; }
                .notification.info .notification-icon { color: #3498db; }
                
                .notification-content {
                    flex: 1;
                }
                
                .notification-title {
                    font-weight: 600;
                    font-size: 14px;
                    margin-bottom: 4px;
                    color: #2c3e50;
                }
                
                .notification-message {
                    font-size: 13px;
                    color: #555;
                    line-height: 1.4;
                }
                
                .notification-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    color: #999;
                    cursor: pointer;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: background-color 0.2s;
                }
                
                .notification-close:hover {
                    background-color: rgba(0, 0, 0, 0.1);
                }
                
                .notification-progress {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 3px;
                    background: linear-gradient(90deg, rgba(52, 152, 219, 0.3), rgba(52, 152, 219, 0.8));
                    animation: progressBar 5s linear;
                }
                
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                
                @keyframes progressBar {
                    from { width: 100%; }
                    to { width: 0%; }
                }
                
                @media (max-width: 768px) {
                    .notification-container {
                        left: 10px;
                        right: 10px;
                        top: 10px;
                    }
                    
                    .notification {
                        max-width: none;
                    }
                }
            </style>
        `;
        
        document.body.appendChild(container);
        return container;
    }

    show(type, title, message, duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        notification.innerHTML = `
            <i class="notification-icon ${icons[type] || icons.info}"></i>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
            <div class="notification-progress"></div>
        `;
        
        this.container.appendChild(notification);
        
        // Remove old notifications if too many
        const notifications = this.container.querySelectorAll('.notification');
        if (notifications.length > this.maxNotifications) {
            notifications[0].remove();
        }
        
        // Auto remove after duration
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }

    success(title, message, duration) {
        this.show('success', title, message, duration);
    }

    error(title, message, duration) {
        this.show('error', title, message, duration);
    }

    warning(title, message, duration) {
        this.show('warning', title, message, duration);
    }

    info(title, message, duration) {
        this.show('info', title, message, duration);
    }
}

// Initialize notification manager
const notify = new NotificationManager();

// WebSocket connection manager
class SocketManager {
    constructor() {
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect() {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            this.socket = io(CONFIG.SOCKET_URL, {
                auth: { token },
                transports: ['websocket', 'polling']
            });

            this.socket.on('connect', () => {
                console.log('Connected to server');
                this.reconnectAttempts = 0;
                AppState.socket = this.socket;
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
                AppState.socket = null;
            });

            this.socket.on('notification', (notification) => {
                this.handleNotification(notification);
            });

            this.socket.on('issue_updated', (data) => {
                this.handleIssueUpdate(data);
            });

            this.socket.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
                this.handleReconnect();
            });

        } catch (error) {
            console.error('Failed to connect to socket:', error);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            AppState.socket = null;
        }
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
                this.reconnectAttempts++;
                console.log(`Reconnection attempt ${this.reconnectAttempts}`);
                this.connect();
            }, Math.pow(2, this.reconnectAttempts) * 1000);
        }
    }

    handleNotification(notification) {
        AppState.notifications.unshift(notification);
        
        // Show toast notification
        const type = notification.priority === 'urgent' ? 'warning' : 'info';
        notify.show(type, notification.title, notification.message);
        
        // Update notification badge if exists
        this.updateNotificationBadge();
    }

    handleIssueUpdate(data) {
        // Update issue in state
        const issueIndex = AppState.issues.findIndex(issue => issue._id === data.issueId);
        if (issueIndex > -1) {
            AppState.issues[issueIndex].status = data.status;
        }
        
        // Refresh issues display if on issues page
        if (window.location.pathname.includes('issues') || document.getElementById('issuesGrid')) {
            loadIssues();
        }
    }

    updateNotificationBadge() {
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            const unreadCount = AppState.notifications.filter(n => !n.isRead).length;
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = unreadCount > 0 ? 'block' : 'none';
        }
    }
}

// Initialize socket manager
const socketManager = new SocketManager();

// ===============================
// Authentication Management
// ===============================

// Check authentication status
async function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        AppState.user = null;
        updateAuthUI();
        return false;
    }

    try {
        const response = await api.auth.getCurrentUser();
        AppState.user = response.data.user;
        updateAuthUI();
        socketManager.connect();
        return true;
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        AppState.user = null;
        updateAuthUI();
        return false;
    }
}

// Update UI based on authentication state
function updateAuthUI() {
    const authButtons = document.getElementById('authButtons');
    if (!authButtons) return;

    if (AppState.user) {
        authButtons.innerHTML = `
            <div class="user-profile">
                ${AppState.user.profilePhoto ? 
                    `<img src="${AppState.user.profilePhoto}" alt="${AppState.user.firstName}" class="user-avatar">` : 
                    '<i class="fas fa-user-circle" style="font-size: 2rem; color: white;"></i>'
                }
                <span class="user-name">${AppState.user.firstName} ${AppState.user.lastName}</span>
                <div class="notification-wrapper">
                    <button class="notification-btn" onclick="toggleNotifications()">
                        <i class="fas fa-bell"></i>
                        <span class="notification-badge" style="display: none;">0</span>
                    </button>
                </div>
                <button class="logout-btn" onclick="handleLogout()">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        `;
        
        // Update notification badge
        socketManager.updateNotificationBadge();
    } else {
        authButtons.innerHTML = `
            <button class="auth-btn login" onclick="window.location.href='login.html'">
                <i class="fas fa-sign-in-alt"></i> Login
            </button>
            <button class="auth-btn register" onclick="window.location.href='register.html'">
                <i class="fas fa-user-plus"></i> Register
            </button>
        `;
    }
}

// Handle logout
async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await api.auth.logout();
            localStorage.removeItem('token');
            AppState.user = null;
            socketManager.disconnect();
            updateAuthUI();
            notify.success('Success', 'You have been logged out successfully');
        } catch (error) {
            console.error('Logout failed:', error);
            notify.error('Error', 'Failed to logout');
        }
    }
}

// ===============================
// Issue Management
// ===============================

// Load and display issues
async function loadIssues(params = {}) {
    try {
        const response = await api.issues.getAll({
            ...AppState.filters,
            ...params
        });
        
        AppState.issues = response.data.issues;
        displayIssues(response.data.issues, response.data.pagination);
    } catch (error) {
        console.error('Failed to load issues:', error);
        notify.error('Error', 'Failed to load issues');
    }
}

// Display issues in the grid
function displayIssues(issues, pagination) {
    const issuesGrid = document.getElementById('issuesGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (!issuesGrid) return;

    if (issues.length === 0) {
        if (emptyState) {
            emptyState.style.display = 'block';
        }
        issuesGrid.innerHTML = '';
        return;
    }

    if (emptyState) {
        emptyState.style.display = 'none';
    }

    issuesGrid.innerHTML = issues.map(issue => createIssueCard(issue)).join('');
    
    // Add pagination if provided
    if (pagination) {
        displayPagination(pagination);
    }
}

// Create individual issue card HTML
function createIssueCard(issue) {
    const statusColors = {
        'submitted': '#f39c12',
        'acknowledged': '#3498db',
        'in_progress': '#2980b9',
        'under_review': '#9b59b6',
        'resolved': '#27ae60',
        'closed': '#34495e',
        'rejected': '#e74c3c'
    };

    const priorityIcons = {
        'low': 'fas fa-arrow-down',
        'medium': 'fas fa-minus',
        'high': 'fas fa-arrow-up',
        'critical': 'fas fa-exclamation-triangle'
    };

    return `
        <div class="issue-card" data-issue-id="${issue._id}" onclick="viewIssue('${issue._id}')">
            <div class="issue-header">
                <div class="issue-category">
                    <i class="fas fa-tag"></i>
                    ${CONFIG.CATEGORIES[issue.category] || issue.category}
                </div>
                <div class="issue-priority" data-priority="${issue.priority}">
                    <i class="${priorityIcons[issue.priority]}"></i>
                </div>
            </div>
            
            ${issue.photos && issue.photos.length > 0 ? `
                <div class="issue-image">
                    <img src="${issue.photos[0].url}" alt="Issue photo" loading="lazy">
                    ${issue.photos.length > 1 ? `<span class="photo-count">+${issue.photos.length - 1}</span>` : ''}
                </div>
            ` : ''}
            
            <div class="issue-content">
                <h3 class="issue-title">${issue.title}</h3>
                <p class="issue-description">${issue.description.substring(0, 150)}${issue.description.length > 150 ? '...' : ''}</p>
                
                <div class="issue-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${issue.location.address?.formatted || 'Location not specified'}</span>
                </div>
            </div>
            
            <div class="issue-footer">
                <div class="issue-meta">
                    <span class="issue-id">#${issue.trackingId}</span>
                    <span class="issue-date">${formatDate(issue.createdAt)}</span>
                </div>
                
                <div class="issue-stats">
                    <button class="stat-btn ${issue.isUpvoted ? 'active' : ''}" onclick="toggleUpvote(event, '${issue._id}')">
                        <i class="fas fa-thumbs-up"></i>
                        <span>${issue.upvoteCount || 0}</span>
                    </button>
                    <span class="stat-item">
                        <i class="fas fa-eye"></i>
                        ${issue.views || 0}
                    </span>
                </div>
                
                <div class="issue-status" style="background-color: ${statusColors[issue.status]}">
                    ${issue.status.replace('_', ' ').toUpperCase()}
                </div>
            </div>
        </div>
    `;
}

// Handle issue form submission
async function handleIssueSubmission(event) {
    event.preventDefault();
    
    if (!AppState.user) {
        notify.warning('Authentication Required', 'Please login to report an issue');
        window.location.href = 'login.html';
        return;
    }

    const form = event.target;
    const formData = new FormData();
    
    // Basic form data
    formData.append('title', form.issueTitle?.value || form.issueCategory?.value + ' Issue');
    formData.append('description', form.issueDescription.value);
    formData.append('category', form.issueCategory.value);
    
    // Location data
    if (AppState.selectedLocation) {
        formData.append('location', JSON.stringify(AppState.selectedLocation));
    }
    
    // Photo uploads
    if (AppState.selectedPhotos && AppState.selectedPhotos.length > 0) {
        AppState.selectedPhotos.forEach((photo, index) => {
            formData.append('photos', photo, `photo-${index}.jpg`);
        });
    }
    
    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    
    try {
        const response = await api.issues.create(formData);
        
        notify.success('Success!', `Issue reported successfully. Tracking ID: ${response.data.issue.trackingId}`);
        
        // Reset form and state
        form.reset();
        AppState.selectedLocation = null;
        AppState.selectedPhotos = [];
        updateLocationDisplay();
        updatePhotoDisplay();
        
        // Refresh issues list
        if (document.getElementById('issuesGrid')) {
            loadIssues();
        }
        
    } catch (error) {
        console.error('Issue submission failed:', error);
        notify.error('Submission Failed', error.message || 'Failed to submit issue');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// ===============================
// Location Management
// ===============================

// Update location display in form
function updateLocationDisplay() {
    const locationDisplay = document.getElementById('locationDisplay');
    const locationWrapper = document.getElementById('locationWrapper');
    
    if (!locationDisplay || !locationWrapper) return;
    
    if (AppState.selectedLocation) {
        document.getElementById('selectedAddress').textContent = AppState.selectedLocation.address?.formatted || 'Selected location';
        document.getElementById('selectedLat').textContent = AppState.selectedLocation.coordinates.latitude.toFixed(6);
        document.getElementById('selectedLng').textContent = AppState.selectedLocation.coordinates.longitude.toFixed(6);
        locationDisplay.style.display = 'block';
    } else {
        locationDisplay.style.display = 'none';
    }
}

// Handle location selection
function handleLocationSelection(location) {
    AppState.selectedLocation = location;
    updateLocationDisplay();
    notify.success('Location Selected', 'Location has been added to your report');
}

// ===============================
// Photo Management
// ===============================

// Update photo display in form
function updatePhotoDisplay() {
    const photoPreview = document.getElementById('photoPreview');
    const photoThumbnails = document.getElementById('photoThumbnails');
    
    if (!photoPreview || !photoThumbnails) return;
    
    if (AppState.selectedPhotos.length > 0) {
        photoThumbnails.innerHTML = AppState.selectedPhotos.map((photo, index) => `
            <div class="photo-thumbnail">
                <img src="${URL.createObjectURL(photo)}" alt="Photo ${index + 1}">
                <button class="remove-photo" onclick="removePhoto(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
        photoPreview.style.display = 'block';
    } else {
        photoPreview.style.display = 'none';
        photoThumbnails.innerHTML = '';
    }
}

// Handle photo selection
function handlePhotoSelection(files) {
    const maxPhotos = 5;
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    
    Array.from(files).forEach(file => {
        if (AppState.selectedPhotos.length >= maxPhotos) {
            notify.warning('Photo Limit', `Maximum ${maxPhotos} photos allowed`);
            return;
        }
        
        if (file.size > maxFileSize) {
            notify.error('File Too Large', `${file.name} is too large. Maximum size is 10MB`);
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            notify.error('Invalid File', `${file.name} is not a valid image file`);
            return;
        }
        
        AppState.selectedPhotos.push(file);
    });
    
    updatePhotoDisplay();
    notify.success('Photos Added', `${files.length} photo(s) added to your report`);
}

// Remove photo from selection
function removePhoto(index) {
    AppState.selectedPhotos.splice(index, 1);
    updatePhotoDisplay();
    notify.info('Photo Removed', 'Photo removed from your report');
}

// ===============================
// Utility Functions
// ===============================

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Toggle upvote on issue
async function toggleUpvote(event, issueId) {
    event.stopPropagation();
    
    if (!AppState.user) {
        notify.warning('Authentication Required', 'Please login to upvote issues');
        return;
    }
    
    try {
        const response = await api.issues.upvote(issueId);
        
        // Update button state
        const button = event.currentTarget;
        const countSpan = button.querySelector('span');
        
        if (response.data.isUpvoted) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
        
        countSpan.textContent = response.data.upvoteCount;
        
    } catch (error) {
        console.error('Upvote failed:', error);
        notify.error('Action Failed', 'Failed to update upvote');
    }
}

// View individual issue
function viewIssue(issueId) {
    // This would typically navigate to a detailed issue view
    // For now, we'll show a simple modal or redirect
    window.open(`/issue/${issueId}`, '_blank');
}

// Search functionality
function handleSearch(event) {
    const searchTerm = event.target.value;
    AppState.filters.search = searchTerm;
    
    // Debounce search
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
        loadIssues();
    }, 300);
}

// Filter functionality
function handleFilter(type, value) {
    AppState.filters[type] = value;
    loadIssues();
}

// ===============================
// Mobile Menu Management
// ===============================

function toggleMobileMenu() {
    const nav = document.querySelector('.nav-menu');
    const menuBtn = document.querySelector('.mobile-menu-btn');
    
    nav.classList.toggle('active');
    menuBtn.classList.toggle('active');
    
    // Prevent body scroll when menu is open
    document.body.classList.toggle('menu-open', nav.classList.contains('active'));
}

// ===============================
// Page Initialization
// ===============================

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Municipal Platform 2.0 Initializing...');
    
    // Check authentication status
    await checkAuth();
    
    // Load issues if we're on the main page
    if (document.getElementById('issuesGrid')) {
        loadIssues();
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize mobile menu
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        const nav = document.querySelector('.nav-menu');
        const menuBtn = document.querySelector('.mobile-menu-btn');
        
        if (nav && nav.classList.contains('active') && 
            !nav.contains(e.target) && !menuBtn.contains(e.target)) {
            toggleMobileMenu();
        }
    });
    
    console.log('Municipal Platform 2.0 Ready!');
});

// Set up event listeners
function setupEventListeners() {
    // Issue form submission
    const issueForm = document.getElementById('issueForm');
    if (issueForm) {
        issueForm.addEventListener('submit', handleIssueSubmission);
    }
    
    // Photo input change
    const photoInput = document.getElementById('issuePhotos');
    if (photoInput) {
        photoInput.addEventListener('change', (e) => {
            handlePhotoSelection(e.target.files);
        });
    }
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    
    // Filter dropdowns
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            handleFilter('category', e.target.value);
        });
    }
    
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            handleFilter('status', e.target.value);
        });
    }
}

// Export functions for global access
window.AppState = AppState;
window.api = api;
window.notify = notify;
window.handleLocationSelection = handleLocationSelection;
window.handlePhotoSelection = handlePhotoSelection;
window.removePhoto = removePhoto;
window.toggleUpvote = toggleUpvote;
window.viewIssue = viewIssue;
window.handleLogout = handleLogout;
window.toggleMobileMenu = toggleMobileMenu;

// ===============================
// Dynamic Issues List
// ===============================
const issuesGrid = document.getElementById("issuesGrid");
const issueForm = document.getElementById("issueForm");
const emptyState = document.getElementById("emptyState");

// Load saved issues from localStorage
function loadIssues() {
    const saved = JSON.parse(localStorage.getItem("issues")) || [];
    
    // Clear the grid
    issuesGrid.innerHTML = "";
    
    if (saved.length === 0) {
        showEmptyState();
    } else {
        hideEmptyState();
        saved.forEach(issue => {
            addIssueCard(issue, false); // render only, don't save again
        });
    }
}

// Show empty state when no issues exist
function showEmptyState() {
    const emptyStateHTML = `
        <div class="empty-state" id="emptyState" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #666; animation: fadeIn 0.5s ease-in;">
            <i class="fas fa-clipboard-list" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;"></i>
            <h3 style="margin-bottom: 10px; color: var(--dark);">No Issues Reported Yet</h3>
            <p style="margin-bottom: 20px;">Be the first to report a municipal issue and help improve Anand!</p>
            <a href="#report" class="btn btn-primary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px;">
                <i class="fas fa-plus"></i> Report Your First Issue
            </a>
        </div>
    `;
    issuesGrid.innerHTML = emptyStateHTML;
}

// Hide empty state when issues exist
function hideEmptyState() {
    const emptyState = issuesGrid.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
}

// Function to create & insert dynamic issue card
function addIssueCard(issue, save = true) {
    // Hide empty state when adding first issue
    hideEmptyState();
    
    const card = document.createElement("div");
    card.className = "issue-card";
    card.style.animation = "slideIn 0.5s ease-out";
    card.dataset.issueId = issue.id;
    
    // Determine image source - use first photo, user profile photo, or placeholder
    let imageSource;
    if (issue.photos && issue.photos.length > 0) {
        imageSource = issue.photos[0].dataUrl;
    } else if (issue.userProfilePhoto) {
        imageSource = issue.userProfilePhoto;
    } else if (typeof getUserProfilePhoto === 'function' && getUserProfilePhoto()) {
        imageSource = getUserProfilePhoto();
    } else {
        imageSource = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80';
    }
    
    // Format time display
    const timeAgo = getTimeAgo(issue.timestamp || Date.now());
    
    // Create status dropdown for status management
    const statusDropdown = `
        <select class="status-selector" data-issue-id="${issue.id}" onchange="updateIssueStatus('${issue.id}', this.value)">
            <option value="Pending" ${issue.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="In Progress" ${issue.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Resolved" ${issue.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
        </select>
    `;

    card.innerHTML = `
        <div class="issue-image">
            <img src="${imageSource}" alt="${issue.category} issue" loading="lazy">
            ${issue.photos && issue.photos.length > 1 ? `<div class="photo-count"><i class="fas fa-images"></i> ${issue.photos.length}</div>` : ''}
        </div>
        <div class="issue-content">
            <div class="issue-header">
                <span class="issue-status status-${issue.status.toLowerCase().replace(" ", "-")}">${issue.status}</span>
                <div class="issue-actions">
                    <button class="action-btn view-btn" onclick="viewIssueDetails('${issue.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteIssue('${issue.id}')" title="Delete Issue">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <h3 class="issue-title">${issue.category}</h3>
            <p class="issue-description">${truncateText(issue.description, 100)}</p>
            ${issue.location && issue.location !== 'Location not specified' ? `
                <div class="issue-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${truncateText(issue.location, 50)}</span>
                </div>
            ` : ''}
            <div class="issue-meta">
                <span><i class="fas fa-clock"></i> ${timeAgo}</span>
                <span><i class="fas fa-hashtag"></i>AMC${issue.id}</span>
            </div>
            ${issue.userInfo ? `
                <div class="user-info">
                    ${issue.userProfilePhoto ? `<img src="${issue.userProfilePhoto}" alt="User" class="user-avatar-small">` : '<i class="fas fa-user"></i>'}
                    <span class="user-label">Reported by:</span>
                    <span>${issue.userInfo.name}</span>
                </div>
            ` : ''}
        </div>
    `;

    // Add hover effects and animations
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-5px)';
        this.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.15)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = 'var(--shadow)';
    });

    issuesGrid.prepend(card); // newest on top

    // Save to localStorage
    if (save) {
        const saved = JSON.parse(localStorage.getItem("issues")) || [];
        saved.unshift(issue); // Add to beginning for newest first
        localStorage.setItem("issues", JSON.stringify(saved));
    }
}

// Form validation function
function validateForm() {
    const category = document.getElementById("issueCategory").value;
    const description = document.getElementById("issueDescription").value.trim();
    
    let isValid = true;
    let errorMessage = "";
    
    // Remove previous error styling
    document.querySelectorAll('.form-control').forEach(field => {
        field.classList.remove('error');
    });
    
    if (!category) {
        document.getElementById("issueCategory").classList.add('error');
        errorMessage += "• Please select an issue category\n";
        isValid = false;
    }
    
    if (!description || description.length < 10) {
        document.getElementById("issueDescription").classList.add('error');
        errorMessage += "• Please provide a detailed description (at least 10 characters)\n";
        isValid = false;
    }
    
    if (!isValid) {
        alert("❌ Please fix the following errors:\n\n" + errorMessage);
    }
    
    return isValid;
}

// Hook into form submission
if (issueForm) {
    issueForm.addEventListener("submit", function(e) {
        e.preventDefault();
        submitIssueForm();
    });
}

// Integration functionality
function updateLocationDisplay() {
    const locationData = JSON.parse(sessionStorage.getItem('selectedLocation') || '{}');
    const locationDisplay = document.getElementById('locationDisplay');
    
    if (locationData.address) {
        document.getElementById('selectedAddress').textContent = locationData.address;
        document.getElementById('selectedLat').textContent = locationData.latitude;
        document.getElementById('selectedLng').textContent = locationData.longitude;
        locationDisplay.style.display = 'block';
        document.getElementById('chooseLocationBtn').style.display = 'none';
    }
}

function updatePhotoDisplay() {
    const photos = JSON.parse(sessionStorage.getItem('selectedPhotos') || '[]');
    const photoPreview = document.getElementById('photoPreview');
    const photoThumbnails = document.getElementById('photoThumbnails');
    
    if (photos.length > 0) {
        photoThumbnails.innerHTML = '';
        photos.forEach(photo => {
            const thumbnail = document.createElement('div');
            thumbnail.className = 'photo-thumbnail';
            thumbnail.innerHTML = `<img src="${photo.dataUrl}" alt="${photo.filename}">`;
            photoThumbnails.appendChild(thumbnail);
        });
        photoPreview.style.display = 'block';
    }
}

// Add event listeners for Choose Location and Change Location buttons
if (document.getElementById('chooseLocationBtn')) {
    document.getElementById('chooseLocationBtn').addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = 'pinPoint.html';
    });
}

if (document.getElementById('changeLocationBtn')) {
    document.getElementById('changeLocationBtn').addEventListener('click', function(e) {
        e.preventDefault();
        sessionStorage.removeItem('selectedLocation');
        window.location.href = 'pinPoint.html';
    });
}

// Add event listener for Upload Photos button
if (document.getElementById('uploadPhotosBtn')) {
    document.getElementById('uploadPhotosBtn').addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = 'photoEvidence.html';
    });
}

// Add event listener for Change Photos button
if (document.getElementById('changePhotosBtn')) {
    document.getElementById('changePhotosBtn').addEventListener('click', function(e) {
        e.preventDefault();
        sessionStorage.removeItem('selectedPhotos');
        window.location.href = 'photoEvidence.html';
    });
}

// Check for saved data on page load
window.addEventListener('load', function() {
    updateLocationDisplay();
    updatePhotoDisplay();
});

// Mobile navigation functionality
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navMenu = document.querySelector('.nav-menu');

if (mobileMenuBtn && navMenu) {
    mobileMenuBtn.addEventListener('click', function() {
        navMenu.classList.toggle('active');
        const icon = mobileMenuBtn.querySelector('i');
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
    });
    
    // Close menu when clicking on nav links
    navMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function() {
            navMenu.classList.remove('active');
            const icon = mobileMenuBtn.querySelector('i');
            icon.classList.add('fa-bars');
            icon.classList.remove('fa-times');
        });
    });
}

// Status tracking functionality
const statusInput = document.querySelector('.status-input input');
const statusButton = document.querySelector('.status-input button');

if (statusButton && statusInput) {
    statusButton.addEventListener('click', function() {
        const trackingId = statusInput.value.trim();
        
        if (!trackingId) {
            showNotification('Please enter a tracking ID', 'error');
            return;
        }
        
        // Search for the issue in localStorage
        const saved = JSON.parse(localStorage.getItem('issues') || '[]');
        const cleanTrackingId = trackingId.replace(/^(#|AMC)/i, ''); // Remove # or AMC prefix if present
        const issue = saved.find(i => i.id === cleanTrackingId);
        
        if (issue) {
            displayStatusResult(issue);
            statusInput.value = ''; // Clear input after successful search
        } else {
            showStatusNotFound(trackingId);
        }
    });
    
    // Allow Enter key to trigger search
    statusInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            statusButton.click();
        }
    });
}

// ===============================
// Utility Functions
// ===============================

// Generate unique tracking ID
function generateTrackingId() {
    return Math.floor(Math.random() * 9000 + 1000).toString();
}

// Truncate text with ellipsis
function truncateText(text, maxLength) {
    if (text && text.length > maxLength) {
        return text.substring(0, maxLength) + '...';
    }
    return text || '';
}

// Calculate time ago from timestamp
function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

// ===============================
// Issue Management Functions
// ===============================

// Update issue status
function updateIssueStatus(issueId, newStatus) {
    const saved = JSON.parse(localStorage.getItem('issues') || '[]');
    const issueIndex = saved.findIndex(issue => issue.id === issueId);
    
    if (issueIndex !== -1) {
        saved[issueIndex].status = newStatus;
        saved[issueIndex].lastUpdated = Date.now();
        localStorage.setItem('issues', JSON.stringify(saved));
        
        // Update the status badge in the DOM
        const card = document.querySelector(`[data-issue-id="${issueId}"]`);
        if (card) {
            const statusBadge = card.querySelector('.issue-status');
            statusBadge.className = `issue-status status-${newStatus.toLowerCase().replace(" ", "-")}`;
            statusBadge.textContent = newStatus;
        }
        
        showNotification(`Issue #AMC${issueId} status updated to: ${newStatus}`, 'success');
    }
}

// View issue details in modal
function viewIssueDetails(issueId) {
    const saved = JSON.parse(localStorage.getItem('issues') || '[]');
    const issue = saved.find(i => i.id === issueId);
    
    if (!issue) {
        showNotification('Issue not found', 'error');
        return;
    }
    
    // Create modal HTML
    const modalHTML = `
        <div class="issue-modal-overlay" onclick="closeIssueModal()">
            <div class="issue-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h2>Issue Details</h2>
                    <button class="close-btn" onclick="closeIssueModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-content">
                    <div class="issue-detail-grid">
                        <div class="detail-item">
                            <label>Tracking ID:</label>
                            <span class="tracking-id">#AMC${issue.id}</span>
                        </div>
                        <div class="detail-item">
                            <label>Category:</label>
                            <span>${issue.category}</span>
                        </div>
                        <div class="detail-item">
                            <label>Status:</label>
                            <span class="issue-status status-${issue.status.toLowerCase().replace(" ", "-")}">${issue.status}</span>
                        </div>
                        <div class="detail-item full-width">
                            <label>Description:</label>
                            <p>${issue.description}</p>
                        </div>
                        <div class="detail-item full-width">
                            <label>Location:</label>
                            <p><i class="fas fa-map-marker-alt"></i> ${issue.location}</p>
                        </div>
                        <div class="detail-item">
                            <label>Reported:</label>
                            <span>${issue.time}</span>
                        </div>
                        ${issue.photos && issue.photos.length > 0 ? `
                            <div class="detail-item full-width">
                                <label>Photo Evidence (${issue.photos.length}):</label>
                                <div class="modal-photo-grid">
                                    ${issue.photos.map(photo => `
                                        <img src="${photo.dataUrl}" alt="${photo.filename}" onclick="openPhotoViewer('${photo.dataUrl}')">
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Inject modal into body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
}

// Close issue modal
function closeIssueModal() {
    const modal = document.querySelector('.issue-modal-overlay');
    if (modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
    }
}

// Open photo viewer
function openPhotoViewer(imageUrl) {
    const viewerHTML = `
        <div class="photo-viewer-overlay" onclick="closePhotoViewer()">
            <div class="photo-viewer">
                <button class="close-btn" onclick="closePhotoViewer()">
                    <i class="fas fa-times"></i>
                </button>
                <img src="${imageUrl}" alt="Full size photo">
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', viewerHTML);
}

// Close photo viewer
function closePhotoViewer() {
    const viewer = document.querySelector('.photo-viewer-overlay');
    if (viewer) {
        viewer.remove();
    }
}

// Delete issue
function deleteIssue(issueId) {
    if (confirm('Are you sure you want to delete this issue? This action cannot be undone.')) {
        const saved = JSON.parse(localStorage.getItem('issues') || '[]');
        const filteredIssues = saved.filter(issue => issue.id !== issueId);
        localStorage.setItem('issues', JSON.stringify(filteredIssues));
        
        // Remove card from DOM
        const card = document.querySelector(`[data-issue-id="${issueId}"]`);
        if (card) {
            card.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                card.remove();
                // Show empty state if no issues left
                if (filteredIssues.length === 0) {
                    showEmptyState();
                }
            }, 300);
        }
        
        showNotification(`Issue #AMC${issueId} deleted successfully`, 'success');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Display detailed status result in styled modal
function displayStatusResult(issue) {
    // Get the main image - first photo or placeholder
    const mainImage = (issue.photos && issue.photos.length > 0) 
        ? issue.photos[0].dataUrl 
        : 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80';
    
    const timeAgo = getTimeAgo(issue.timestamp || Date.now());
    
    const statusModalHTML = `
        <div class="status-modal-overlay" onclick="closeStatusModal()">
            <div class="status-modal" onclick="event.stopPropagation()">
                <div class="status-modal-header">
                    <div class="status-header-content">
                        <h2><i class="fas fa-search"></i> Issue Status</h2>
                        <span class="issue-status status-${issue.status.toLowerCase().replace(" ", "-")}">${issue.status}</span>
                    </div>
                    <button class="close-btn" onclick="closeStatusModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="status-modal-body">
                    <div class="status-issue-image">
                        <img src="${mainImage}" alt="${issue.category} issue" onclick="openPhotoViewer('${mainImage}')">
                        ${issue.photos && issue.photos.length > 1 ? `
                            <div class="status-photo-count">
                                <i class="fas fa-images"></i> ${issue.photos.length} photos
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="status-issue-details">
                        <div class="status-tracking-id">
                            <h3><i class="fas fa-hashtag"></i> #AMC${issue.id}</h3>
                            <p class="tracking-subtitle">Tracking ID</p>
                        </div>
                        
                        <div class="status-info-grid">
                            <div class="status-info-item">
                                <i class="fas fa-tag"></i>
                                <div>
                                    <label>Category</label>
                                    <span>${issue.category}</span>
                                </div>
                            </div>
                            
                            <div class="status-info-item">
                                <i class="fas fa-clock"></i>
                                <div>
                                    <label>Reported</label>
                                    <span>${timeAgo}</span>
                                    <small>${issue.time}</small>
                                </div>
                            </div>
                            
                            <div class="status-info-item full-width">
                                <i class="fas fa-align-left"></i>
                                <div>
                                    <label>Description</label>
                                    <p>${issue.description}</p>
                                </div>
                            </div>
                            
                            ${issue.location && issue.location !== 'Location not specified' ? `
                                <div class="status-info-item full-width">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <div>
                                        <label>Location</label>
                                        <span>${issue.location}</span>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        
                        ${issue.photos && issue.photos.length > 1 ? `
                            <div class="status-photo-gallery">
                                <h4><i class="fas fa-images"></i> All Photos (${issue.photos.length})</h4>
                                <div class="status-photo-grid">
                                    ${issue.photos.map((photo, index) => `
                                        <div class="status-photo-item" onclick="openPhotoViewer('${photo.dataUrl}')">
                                            <img src="${photo.dataUrl}" alt="Photo ${index + 1}">
                                            <div class="photo-overlay">
                                                <i class="fas fa-expand"></i>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="status-modal-footer">
                    <button class="btn btn-outline" onclick="closeStatusModal()">
                        <i class="fas fa-times"></i> Close
                    </button>
                    <button class="btn btn-primary" onclick="copyTrackingId('AMC${issue.id}')">
                        <i class="fas fa-copy"></i> Copy Tracking ID
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', statusModalHTML);
    document.body.style.overflow = 'hidden';
}

// Display error for tracking ID not found
function showStatusNotFound(trackingId) {
    const errorModalHTML = `
        <div class="status-modal-overlay" onclick="closeStatusModal()">
            <div class="status-modal error-modal" onclick="event.stopPropagation()">
                <div class="status-modal-header error-header">
                    <div class="status-header-content">
                        <h2><i class="fas fa-exclamation-triangle"></i> Issue Not Found</h2>
                    </div>
                    <button class="close-btn" onclick="closeStatusModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="status-modal-body error-body">
                    <div class="error-icon">
                        <i class="fas fa-search"></i>
                    </div>
                    <h3>Tracking ID Not Found</h3>
                    <p>We couldn't find an issue with tracking ID: <strong>${trackingId}</strong></p>
                    
                    <div class="error-suggestions">
                        <h4>Please check:</h4>
                        <ul>
                            <li><i class="fas fa-check"></i> The tracking ID is entered correctly</li>
                            <li><i class="fas fa-check"></i> You're using the complete ID (e.g., AMC1234)</li>
                            <li><i class="fas fa-check"></i> The issue was submitted through this platform</li>
                        </ul>
                    </div>
                    
                    <div class="error-actions">
                        <p>Need help? <a href="#contact">Contact our support team</a> or <a href="#report">report a new issue</a>.</p>
                    </div>
                </div>
                
                <div class="status-modal-footer">
                    <button class="btn btn-outline" onclick="closeStatusModal()">
                        <i class="fas fa-times"></i> Close
                    </button>
                    <button class="btn btn-primary" onclick="closeStatusModal(); document.getElementById('status').querySelector('input').focus();">
                        <i class="fas fa-search"></i> Try Again
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', errorModalHTML);
    document.body.style.overflow = 'hidden';
}

// Close status modal
function closeStatusModal() {
    const modal = document.querySelector('.status-modal-overlay');
    if (modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
    }
}

// Copy tracking ID to clipboard
function copyTrackingId(trackingId) {
    navigator.clipboard.writeText(trackingId).then(() => {
        showNotification('Tracking ID copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = trackingId;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Tracking ID copied to clipboard!', 'success');
    });
}

// Enhanced form submission with better data handling
function submitIssueForm() {
    if (!validateForm()) {
        return false;
    }

    const category = document.getElementById("issueCategory").value;
    const description = document.getElementById("issueDescription").value.trim();
    
    // Get location data from session storage
    const locationData = JSON.parse(sessionStorage.getItem('selectedLocation') || '{}');
    const location = locationData.address || "Location not specified";
    
    // Get photos from session storage
    const photos = JSON.parse(sessionStorage.getItem('selectedPhotos') || '[]');

    // Get user profile photo if available
    let userProfilePhoto = null;
    if (typeof getUserProfilePhoto === 'function') {
        userProfilePhoto = getUserProfilePhoto();
    }
    
    // Get user information if logged in
    let userInfo = null;
    if (typeof getCurrentUser === 'function') {
        const currentUser = getCurrentUser();
        if (currentUser) {
            userInfo = {
                id: currentUser.id,
                name: `${currentUser.firstName} ${currentUser.lastName}`,
                email: currentUser.email
            };
        }
    }

    // Generate unique issue object
    const issue = {
        id: generateTrackingId(),
        category,
        description,
        location,
        coordinates: locationData,
        status: "Pending",
        photos: photos,
        userProfilePhoto: userProfilePhoto,
        userInfo: userInfo,
        timestamp: Date.now(),
        time: new Date().toLocaleString(),
        lastUpdated: Date.now()
    };

    // Add to issues list
    addIssueCard(issue, true);
    
    // Reset form and clear session data
    document.getElementById('issueForm').reset();
    sessionStorage.removeItem('selectedLocation');
    sessionStorage.removeItem('selectedPhotos');
    
    // Reset UI elements
    const locationDisplay = document.getElementById('locationDisplay');
    const chooseLocationBtn = document.getElementById('chooseLocationBtn');
    const photoPreview = document.getElementById('photoPreview');
    
    if (locationDisplay) locationDisplay.style.display = 'none';
    if (chooseLocationBtn) chooseLocationBtn.style.display = 'block';
    if (photoPreview) photoPreview.style.display = 'none';
    
    // Show success message
    showNotification(`✅ Issue submitted successfully! Tracking ID: #AMC${issue.id}`, 'success');
    
    // Scroll to status section to see the new issue
    setTimeout(() => {
        document.getElementById('status').scrollIntoView({ behavior: 'smooth' });
    }, 500);
    
    return true;
}

// ===============================
// Initialize Application
// ===============================

// Load issues on page load
loadIssues();
