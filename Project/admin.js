// ===============================
// Admin Dashboard - Anand Municipal Corporation
// Real-time Administrative Interface
// ===============================

class AdminDashboard {
    constructor() {
        this.socket = null;
        this.charts = {};
        this.currentSection = 'dashboard';
        this.stats = {
            total: 0,
            pending: 0,
            progress: 0,
            resolved: 0
        };
        
        this.init();
    }

    async init() {
        // Check authentication
        await this.checkAdminAuth();
        
        // Initialize Socket.IO connection
        this.initializeSocket();
        
        // Load initial data
        await this.loadDashboardData();
        
        // Initialize charts
        this.initializeCharts();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up auto-refresh
        this.setupAutoRefresh();
        
        console.log('Admin Dashboard initialized successfully');
    }

    async checkAdminAuth() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html?redirect=admin';
            return;
        }

        try {
            const response = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                throw new Error('Authentication failed');
            }
            
            const data = await response.json();
            
            if (!['admin', 'department_head'].includes(data.data.user.role)) {
                alert('Access denied. Admin privileges required.');
                window.location.href = 'index.html';
                return;
            }
            
            this.currentUser = data.data.user;
            this.updateUserProfile();
            
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('token');
            window.location.href = 'login.html?redirect=admin';
        }
    }

    initializeSocket() {
        const token = localStorage.getItem('token');
        if (!token) return;

        this.socket = io(window.location.origin, {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            console.log('Admin dashboard connected to server');
        });

        this.socket.on('notification', (notification) => {
            this.handleRealTimeNotification(notification);
        });

        this.socket.on('issue_updated', (data) => {
            this.handleIssueUpdate(data);
        });

        this.socket.on('new_issue', (issue) => {
            this.handleNewIssue(issue);
        });

        this.socket.on('disconnect', () => {
            console.log('Admin dashboard disconnected from server');
        });
    }

    async loadDashboardData() {
        try {
            // Load issues data
            await this.loadIssuesStats();
            await this.loadRecentIssues();
            await this.loadRecentActivity();
            
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showNotification('Error loading dashboard data', 'error');
        }
    }

    async loadIssuesStats() {
        try {
            const response = await fetch('/api/issues', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (!response.ok) throw new Error('Failed to fetch issues');
            
            const data = await response.json();
            const issues = data.data.issues;
            
            // Calculate stats
            this.stats.total = issues.length;
            this.stats.pending = issues.filter(i => i.status === 'submitted').length;
            this.stats.progress = issues.filter(i => ['acknowledged', 'in_progress'].includes(i.status)).length;
            this.stats.resolved = issues.filter(i => i.status === 'resolved').length;
            
            // Update UI
            this.updateStatsDisplay();
            
        } catch (error) {
            console.error('Failed to load issues stats:', error);
        }
    }

    updateStatsDisplay() {
        document.getElementById('totalIssues').textContent = this.stats.total;
        document.getElementById('pendingIssues').textContent = this.stats.pending;
        document.getElementById('progressIssues').textContent = this.stats.progress;
        document.getElementById('resolvedIssues').textContent = this.stats.resolved;
        document.getElementById('issuesBadge').textContent = this.stats.pending;
    }

    async loadRecentIssues() {
        try {
            const response = await fetch('/api/issues?limit=10&sortBy=createdAt&sortOrder=desc', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (!response.ok) throw new Error('Failed to fetch recent issues');
            
            const data = await response.json();
            this.displayRecentIssues(data.data.issues);
            
        } catch (error) {
            console.error('Failed to load recent issues:', error);
        }
    }

    displayRecentIssues(issues) {
        const tbody = document.getElementById('issuesTableBody');
        if (!tbody) return;

        tbody.innerHTML = issues.map(issue => `
            <tr>
                <td><strong>#${issue.trackingId}</strong></td>
                <td>
                    <span class="category-badge" data-category="${issue.category}">
                        ${issue.category.charAt(0).toUpperCase() + issue.category.slice(1)}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${issue.status.toLowerCase().replace('_', '-')}">
                        ${issue.status.replace('_', ' ')}
                    </span>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${issue.reportedBy.profilePhoto ? 
                            `<img src="${issue.reportedBy.profilePhoto}" alt="${issue.reportedBy.firstName}" 
                                 style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">` :
                            '<i class="fas fa-user-circle" style="font-size: 30px; color: #ccc;"></i>'
                        }
                        <span>${issue.reportedBy.firstName} ${issue.reportedBy.lastName}</span>
                    </div>
                </td>
                <td>${this.formatDate(issue.createdAt)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-sm btn-primary" onclick="viewIssueDetails('${issue._id}')" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-sm btn-success" onclick="updateIssueStatus('${issue._id}', 'resolved')" title="Resolve">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-sm btn-danger" onclick="deleteIssue('${issue._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async loadRecentActivity() {
        // Mock recent activity data
        const activities = [
            {
                type: 'issue_created',
                message: 'New water supply issue reported',
                user: 'John Doe',
                time: new Date(Date.now() - 2 * 60 * 1000),
                icon: 'fas fa-plus-circle',
                color: '#3498db'
            },
            {
                type: 'issue_resolved',
                message: 'Street light issue resolved',
                user: 'Admin User',
                time: new Date(Date.now() - 15 * 60 * 1000),
                icon: 'fas fa-check-circle',
                color: '#27ae60'
            },
            {
                type: 'user_registered',
                message: 'New user registered',
                user: 'Jane Smith',
                time: new Date(Date.now() - 30 * 60 * 1000),
                icon: 'fas fa-user-plus',
                color: '#f39c12'
            },
            {
                type: 'issue_assigned',
                message: 'Drainage issue assigned to field officer',
                user: 'Dept. Head',
                time: new Date(Date.now() - 45 * 60 * 1000),
                icon: 'fas fa-user-tag',
                color: '#9b59b6'
            }
        ];

        this.displayRecentActivity(activities);
    }

    displayRecentActivity(activities) {
        const activityContainer = document.getElementById('recentActivity');
        if (!activityContainer) return;

        activityContainer.innerHTML = activities.map(activity => `
            <div class="activity-item" style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f1f1f1;">
                <div class="activity-icon" style="width: 40px; height: 40px; border-radius: 50%; background: ${activity.color}; color: white; display: flex; align-items: center; justify-content: center;">
                    <i class="${activity.icon}"></i>
                </div>
                <div class="activity-content" style="flex: 1;">
                    <div style="font-weight: 500; color: #2c3e50; font-size: 14px;">${activity.message}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 2px;">by ${activity.user} • ${this.getTimeAgo(activity.time)}</div>
                </div>
            </div>
        `).join('');
    }

    initializeCharts() {
        // Issues Overview Chart
        const ctx = document.getElementById('issuesChart');
        if (ctx) {
            this.charts.issues = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'New Issues',
                        data: [12, 19, 8, 15, 20, 13, 7],
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        tension: 0.4,
                        fill: true
                    }, {
                        label: 'Resolved Issues',
                        data: [8, 15, 12, 18, 15, 10, 9],
                        borderColor: '#27ae60',
                        backgroundColor: 'rgba(39, 174, 96, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }

    setupEventListeners() {
        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                if (section) {
                    this.showSection(section);
                }
            });
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            Object.values(this.charts).forEach(chart => {
                chart.resize();
            });
        });
    }

    setupAutoRefresh() {
        // Refresh dashboard data every 30 seconds
        setInterval(() => {
            if (this.currentSection === 'dashboard') {
                this.loadDashboardData();
            }
        }, 30000);
    }

    showSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
        
        // Update page title
        const titles = {
            dashboard: 'Dashboard',
            issues: 'Issues Management',
            users: 'User Management',
            departments: 'Department Management',
            analytics: 'Analytics',
            notifications: 'Notifications',
            settings: 'Settings'
        };
        
        document.getElementById('pageTitle').textContent = titles[sectionName] || 'Dashboard';
        
        // Show/hide sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });
        
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.style.display = 'block';
        }
        
        this.currentSection = sectionName;
        
        // Load section-specific data
        this.loadSectionData(sectionName);
    }

    async loadSectionData(sectionName) {
        switch (sectionName) {
            case 'issues':
                await this.loadAllIssues();
                break;
            case 'users':
                await this.loadAllUsers();
                break;
            case 'analytics':
                await this.loadAnalytics();
                break;
            // Add more cases as needed
        }
    }

    handleRealTimeNotification(notification) {
        // Update notification count
        const countElement = document.getElementById('notificationCount');
        if (countElement) {
            const currentCount = parseInt(countElement.textContent) || 0;
            countElement.textContent = currentCount + 1;
            countElement.style.display = 'block';
        }

        // Show toast notification
        this.showNotification(notification.title, notification.type || 'info', notification.message);
        
        // Refresh relevant data based on notification type
        if (notification.type === 'issue_created' || notification.type === 'issue_updated') {
            this.loadDashboardData();
        }
    }

    handleIssueUpdate(data) {
        // Update stats
        this.loadIssuesStats();
        
        // Update recent issues table
        this.loadRecentIssues();
        
        // Show update notification
        this.showNotification('Issue Updated', 'info', `Issue ${data.issueId} status changed to ${data.status}`);
    }

    handleNewIssue(issue) {
        // Update stats
        this.stats.total++;
        this.stats.pending++;
        this.updateStatsDisplay();
        
        // Add to recent issues table
        this.addIssueToTable(issue);
        
        // Show notification
        this.showNotification('New Issue', 'info', `New ${issue.category} issue reported`);
    }

    showNotification(title, type = 'info', message = '') {
        const notification = document.createElement('div');
        notification.className = `admin-notification ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        notification.innerHTML = `
            <div class="notification-content">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                    <i class="${icons[type]}" style="color: inherit;"></i>
                    <strong>${title}</strong>
                </div>
                ${message ? `<div style="font-size: 13px; opacity: 0.9;">${message}</div>` : ''}
            </div>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; cursor: pointer; padding: 5px;">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : type === 'warning' ? '#f39c12' : '#3498db'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            z-index: 10001;
            display: flex;
            align-items: flex-start;
            gap: 15px;
            max-width: 400px;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Today';
        if (diffDays === 2) return 'Yesterday';
        if (diffDays <= 7) return `${diffDays - 1} days ago`;
        
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return `${diffDays}d ago`;
    }

    updateUserProfile() {
        if (this.currentUser) {
            const userProfileElements = document.querySelectorAll('.user-profile');
            userProfileElements.forEach(element => {
                const nameElement = element.querySelector('div div:first-child');
                const roleElement = element.querySelector('div div:last-child');
                const avatarElement = element.querySelector('.user-avatar');
                
                if (nameElement) nameElement.textContent = `${this.currentUser.firstName} ${this.currentUser.lastName}`;
                if (roleElement) roleElement.textContent = this.currentUser.role.replace('_', ' ').toUpperCase();
                if (avatarElement && this.currentUser.profilePhoto) {
                    avatarElement.src = this.currentUser.profilePhoto;
                }
            });
        }
    }
}

// Global admin dashboard instance
let adminDashboard;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    adminDashboard = new AdminDashboard();
});

// Global functions for HTML onclick handlers
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

function toggleNotifications() {
    // Implementation for notification dropdown
    console.log('Toggle notifications dropdown');
}

function toggleUserMenu() {
    // Implementation for user menu dropdown
    console.log('Toggle user menu');
}

function showSection(sectionName) {
    if (adminDashboard) {
        adminDashboard.showSection(sectionName);
    }
}

function updateChart() {
    // Update chart based on selected period
    console.log('Update chart');
}

function refreshActivity() {
    if (adminDashboard) {
        adminDashboard.loadRecentActivity();
    }
}

function sendBulkNotification() {
    // Implementation for bulk notification sending
    alert('Bulk notification feature - to be implemented');
}

function generateReport() {
    // Implementation for report generation
    alert('Report generation feature - to be implemented');
}

async function viewIssueDetails(issueId) {
    try {
        const response = await fetch(`/api/issues/${issueId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch issue details');
        
        const data = await response.json();
        const issue = data.data.issue;
        
        // Create detailed modal
        const modalHTML = `
            <div class="admin-modal-overlay" onclick="closeModal()">
                <div class="admin-modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Issue Details - #${issue.trackingId}</h2>
                        <button onclick="closeModal()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <div class="issue-details-grid">
                            <div class="detail-section">
                                <h3>Basic Information</h3>
                                <div class="detail-item">
                                    <label>Title:</label>
                                    <span>${issue.title}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Category:</label>
                                    <span>${issue.category}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Priority:</label>
                                    <span class="priority-${issue.priority}">${issue.priority.toUpperCase()}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Status:</label>
                                    <select id="statusSelect" onchange="updateIssueStatus('${issue._id}', this.value)">
                                        <option value="submitted" ${issue.status === 'submitted' ? 'selected' : ''}>Submitted</option>
                                        <option value="acknowledged" ${issue.status === 'acknowledged' ? 'selected' : ''}>Acknowledged</option>
                                        <option value="in_progress" ${issue.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                                        <option value="under_review" ${issue.status === 'under_review' ? 'selected' : ''}>Under Review</option>
                                        <option value="resolved" ${issue.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                                        <option value="closed" ${issue.status === 'closed' ? 'selected' : ''}>Closed</option>
                                        <option value="rejected" ${issue.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="detail-section">
                                <h3>Description</h3>
                                <p>${issue.description}</p>
                            </div>
                            
                            <div class="detail-section">
                                <h3>Location</h3>
                                <p><i class="fas fa-map-marker-alt"></i> ${issue.location.address?.formatted || 'Location not specified'}</p>
                                ${issue.location.coordinates ? `
                                    <p><strong>Coordinates:</strong> ${issue.location.coordinates.latitude.toFixed(6)}, ${issue.location.coordinates.longitude.toFixed(6)}</p>
                                ` : ''}
                            </div>
                            
                            ${issue.photos && issue.photos.length > 0 ? `
                                <div class="detail-section">
                                    <h3>Photos (${issue.photos.length})</h3>
                                    <div class="modal-photo-grid">
                                        ${issue.photos.map(photo => `
                                            <img src="${photo.url}" alt="Issue photo" onclick="openPhotoViewer('${photo.url}')">
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-primary" onclick="assignIssue('${issue._id}')">
                            <i class="fas fa-user-tag"></i> Assign
                        </button>
                        <button class="btn-success" onclick="resolveIssue('${issue._id}')">
                            <i class="fas fa-check"></i> Mark Resolved
                        </button>
                        <button class="btn-danger" onclick="deleteIssue('${issue._id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
    } catch (error) {
        console.error('Failed to load issue details:', error);
        adminDashboard.showNotification('Error', 'error', 'Failed to load issue details');
    }
}

async function updateIssueStatus(issueId, newStatus) {
    try {
        const response = await fetch(`/api/issues/${issueId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (!response.ok) throw new Error('Failed to update status');
        
        adminDashboard.showNotification('Success', 'success', 'Issue status updated successfully');
        
        // Refresh data
        adminDashboard.loadDashboardData();
        
        // Close modal if open
        closeModal();
        
    } catch (error) {
        console.error('Failed to update issue status:', error);
        adminDashboard.showNotification('Error', 'error', 'Failed to update issue status');
    }
}

async function deleteIssue(issueId) {
    if (!confirm('Are you sure you want to delete this issue? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/issues/${issueId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to delete issue');
        
        adminDashboard.showNotification('Success', 'success', 'Issue deleted successfully');
        
        // Refresh data
        adminDashboard.loadDashboardData();
        
        // Close modal if open
        closeModal();
        
    } catch (error) {
        console.error('Failed to delete issue:', error);
        adminDashboard.showNotification('Error', 'error', 'Failed to delete issue');
    }
}

function assignIssue(issueId) {
    // Implementation for assigning issues
    alert('Issue assignment feature - to be implemented');
}

function resolveIssue(issueId) {
    updateIssueStatus(issueId, 'resolved');
}

function closeModal() {
    const modal = document.querySelector('.admin-modal-overlay');
    if (modal) {
        modal.remove();
    }
}

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

function closePhotoViewer() {
    const viewer = document.querySelector('.photo-viewer-overlay');
    if (viewer) {
        viewer.remove();
    }
}

async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            localStorage.removeItem('token');
            window.location.href = 'index.html';
            
        } catch (error) {
            console.error('Logout failed:', error);
            // Force logout even if API call fails
            localStorage.removeItem('token');
            window.location.href = 'index.html';
        }
    }
}

// Add CSS styles for modals and admin-specific components
const adminStyles = document.createElement('style');
adminStyles.textContent = `
    .admin-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    }
    
    .admin-modal {
        background: white;
        border-radius: 12px;
        max-width: 800px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 25px;
        border-bottom: 1px solid #eee;
        background: #f8f9fa;
        border-radius: 12px 12px 0 0;
    }
    
    .modal-header h2 {
        margin: 0;
        color: #2c3e50;
    }
    
    .modal-header button {
        background: none;
        border: none;
        font-size: 20px;
        color: #666;
        cursor: pointer;
        padding: 5px;
        border-radius: 50%;
    }
    
    .modal-header button:hover {
        background: rgba(0, 0, 0, 0.1);
    }
    
    .modal-body {
        padding: 25px;
    }
    
    .issue-details-grid {
        display: grid;
        gap: 20px;
    }
    
    .detail-section {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
    }
    
    .detail-section h3 {
        margin-bottom: 15px;
        color: #2c3e50;
        font-size: 16px;
    }
    
    .detail-item {
        display: flex;
        margin-bottom: 10px;
    }
    
    .detail-item label {
        font-weight: 600;
        width: 120px;
        color: #555;
    }
    
    .detail-item span,
    .detail-item select {
        flex: 1;
        color: #2c3e50;
    }
    
    .detail-item select {
        padding: 5px 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
    }
    
    .modal-photo-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 10px;
        margin-top: 10px;
    }
    
    .modal-photo-grid img {
        width: 100%;
        height: 150px;
        object-fit: cover;
        border-radius: 8px;
        cursor: pointer;
        transition: transform 0.3s ease;
    }
    
    .modal-photo-grid img:hover {
        transform: scale(1.05);
    }
    
    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 20px 25px;
        border-top: 1px solid #eee;
        background: #f8f9fa;
        border-radius: 0 0 12px 12px;
    }
    
    .modal-footer button {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 5px;
    }
    
    .btn-primary {
        background: #1a5276;
        color: white;
    }
    
    .btn-success {
        background: #27ae60;
        color: white;
    }
    
    .btn-danger {
        background: #e74c3c;
        color: white;
    }
    
    .photo-viewer-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    }
    
    .photo-viewer {
        position: relative;
        max-width: 90%;
        max-height: 90%;
    }
    
    .photo-viewer img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }
    
    .photo-viewer .close-btn {
        position: absolute;
        top: -40px;
        right: 0;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        width: 35px;
        height: 35px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .content-section {
        display: none;
    }
    
    .content-section.active {
        display: block;
    }
    
    .category-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        background: #e3f2fd;
        color: #1976d2;
    }
    
    .priority-low { color: #4caf50; }
    .priority-medium { color: #ff9800; }
    .priority-high { color: #f44336; }
    .priority-critical { color: #d32f2f; font-weight: bold; }
    
    @keyframes slideInRight {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0); }
    }
    
    @keyframes slideOutRight {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100%); }
    }
`;

document.head.appendChild(adminStyles);
