// ===============================
// Authentication System
// ===============================

let currentUser = null;
let cameraStream = null;
let profilePhotoData = null;

// ===============================
// Utility Functions
// ===============================

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
    
    // Add notification styles if not present
    if (!document.querySelector('.notification-styles')) {
        const style = document.createElement('style');
        style.className = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border-radius: 8px;
                padding: 15px 20px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 1002;
                animation: notificationSlideIn 0.3s ease;
                border-left: 4px solid;
                max-width: 350px;
            }
            .notification-success { border-left-color: #27ae60; color: #27ae60; }
            .notification-error { border-left-color: #e74c3c; color: #e74c3c; }
            .notification-info { border-left-color: #1a5276; color: #1a5276; }
            .notification span { flex: 1; color: #2c3e50; }
            .notification button { background: none; border: none; cursor: pointer; color: #666; padding: 5px; border-radius: 3px; transition: background 0.2s ease; }
            .notification button:hover { background: rgba(0, 0, 0, 0.1); }
            @keyframes notificationSlideIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
            @media (max-width: 768px) { .notification { right: 10px; left: 10px; max-width: none; } }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Toggle password visibility
function togglePassword(inputId) {
    const passwordInput = document.getElementById(inputId);
    const toggleBtn = passwordInput.parentElement.querySelector('.password-toggle i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.classList.remove('fa-eye');
        toggleBtn.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleBtn.classList.remove('fa-eye-slash');
        toggleBtn.classList.add('fa-eye');
    }
}

// Show/hide error messages
function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorDiv = document.getElementById(fieldId + 'Error');
    
    field.classList.add('error');
    field.parentElement.parentElement.classList.add('shake');
    
    if (errorDiv) {
        errorDiv.style.display = 'flex';
        errorDiv.querySelector('span').textContent = message;
    }
    
    // Remove shake animation after it completes
    setTimeout(() => {
        field.parentElement.parentElement.classList.remove('shake');
    }, 500);
}

function hideError(fieldId) {
    const field = document.getElementById(fieldId);
    const errorDiv = document.getElementById(fieldId + 'Error');
    
    field.classList.remove('error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

// Clear all errors
function clearAllErrors() {
    document.querySelectorAll('.form-control').forEach(field => {
        field.classList.remove('error');
    });
    document.querySelectorAll('.error-message').forEach(error => {
        error.style.display = 'none';
    });
}

// ===============================
// Profile Photo Management
// ===============================

// Open file selector
function openFileSelector() {
    document.getElementById('photoInput').click();
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showNotification('Please select a valid image file', 'error');
            return;
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showNotification('Please select an image smaller than 5MB', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            setProfilePhoto(e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

// Open camera for photo capture
function openCamera() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    
    // Check if camera is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showNotification('Camera not supported on this device', 'error');
        return;
    }
    
    modal.style.display = 'flex';
    
    navigator.mediaDevices.getUserMedia({ 
        video: { 
            width: { ideal: 400 }, 
            height: { ideal: 400 },
            facingMode: 'user'
        } 
    })
    .then(stream => {
        cameraStream = stream;
        video.srcObject = stream;
    })
    .catch(err => {
        console.error('Camera access error:', err);
        showNotification('Unable to access camera. Please check permissions.', 'error');
        closeCamera();
    });
}

// Capture photo from camera
function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('photoCanvas');
    const context = canvas.getContext('2d');
    
    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to data URL
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    // Set as profile photo
    setProfilePhoto(photoDataUrl);
    
    // Close camera
    closeCamera();
    
    showNotification('Photo captured successfully!', 'success');
}

// Close camera
function closeCamera() {
    const modal = document.getElementById('cameraModal');
    modal.style.display = 'none';
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

// Set profile photo
function setProfilePhoto(dataUrl) {
    profilePhotoData = dataUrl;
    const preview = document.getElementById('photoPreview');
    const photoSection = document.getElementById('photoSection');
    
    // Update preview
    preview.innerHTML = `<img src="${dataUrl}" alt="Profile photo">`;
    preview.classList.add('has-image');
    preview.classList.add('pulse');
    photoSection.classList.add('active');
    
    // Remove pulse animation after it completes
    setTimeout(() => {
        preview.classList.remove('pulse');
    }, 600);
}

// ===============================
// Form Validation
// ===============================

// Validate email format
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validate phone number format
function validatePhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

// Validate password strength
function validatePassword(password) {
    return {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
}

// Validate registration form
function validateRegistrationForm() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const phone = document.getElementById('phoneNumber').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    let isValid = true;
    clearAllErrors();
    
    // Validate first name
    if (!firstName || firstName.length < 2) {
        showError('firstName', 'First name must be at least 2 characters');
        isValid = false;
    }
    
    // Validate last name
    if (!lastName || lastName.length < 2) {
        showError('lastName', 'Last name must be at least 2 characters');
        isValid = false;
    }
    
    // Validate email
    if (!email) {
        showError('registerEmail', 'Email address is required');
        isValid = false;
    } else if (!validateEmail(email)) {
        showError('registerEmail', 'Please enter a valid email address');
        isValid = false;
    }
    
    // Validate phone
    if (!phone) {
        showError('phoneNumber', 'Phone number is required');
        isValid = false;
    } else if (!validatePhone(phone)) {
        showError('phoneNumber', 'Please enter a valid phone number');
        isValid = false;
    }
    
    // Validate password
    if (!password) {
        showError('registerPassword', 'Password is required');
        isValid = false;
    } else {
        const passwordCheck = validatePassword(password);
        if (!passwordCheck.length) {
            showError('registerPassword', 'Password must be at least 8 characters long');
            isValid = false;
        } else if (!passwordCheck.uppercase || !passwordCheck.lowercase || !passwordCheck.number) {
            showError('registerPassword', 'Password must contain uppercase, lowercase, and number');
            isValid = false;
        }
    }
    
    // Validate password confirmation
    if (!confirmPassword) {
        showError('confirmPassword', 'Please confirm your password');
        isValid = false;
    } else if (password !== confirmPassword) {
        showError('confirmPassword', 'Passwords do not match');
        isValid = false;
    }
    
    // Validate terms agreement
    if (!agreeTerms) {
        showNotification('You must agree to the Terms of Service and Privacy Policy', 'error');
        isValid = false;
    }
    
    return isValid;
}

// Validate login form
function validateLoginForm() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    let isValid = true;
    clearAllErrors();
    
    if (!email) {
        showError('loginEmail', 'Email address is required');
        isValid = false;
    } else if (!validateEmail(email)) {
        showError('loginEmail', 'Please enter a valid email address');
        isValid = false;
    }
    
    if (!password) {
        showError('loginPassword', 'Password is required');
        isValid = false;
    }
    
    return isValid;
}

// ===============================
// User Management
// ===============================

// Save user data to localStorage
function saveUser(userData) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // Check if user already exists
    const existingUser = users.find(user => user.email === userData.email);
    if (existingUser) {
        return { success: false, message: 'User with this email already exists' };
    }
    
    // Add user
    const newUser = {
        id: generateUserId(),
        ...userData,
        registeredAt: new Date().toISOString(),
        lastLogin: null,
        profilePhoto: profilePhotoData
    };
    
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    
    return { success: true, user: newUser };
}

// Generate unique user ID
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Authenticate user login
function authenticateUser(email, password) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        // Update last login
        user.lastLogin = new Date().toISOString();
        const userIndex = users.findIndex(u => u.id === user.id);
        users[userIndex] = user;
        localStorage.setItem('users', JSON.stringify(users));
        
        // Set current user session
        setCurrentUser(user);
        return { success: true, user };
    }
    
    return { success: false, message: 'Invalid email or password' };
}

// Set current user session
function setCurrentUser(user) {
    currentUser = user;
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    
    // Update UI if needed
    updateUserInterface();
}

// Get current user
function getCurrentUser() {
    if (!currentUser) {
        const stored = sessionStorage.getItem('currentUser');
        if (stored) {
            currentUser = JSON.parse(stored);
        }
    }
    return currentUser;
}

// Logout user
function logoutUser() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    updateUserInterface();
}

// Update UI based on user state
function updateUserInterface() {
    const user = getCurrentUser();
    
    // Update auth buttons if on main page
    const authButtons = document.getElementById('authButtons');
    const mobileMenu = document.querySelector('.nav-menu');
    
    if (authButtons) {
        if (user) {
            // User is logged in - show profile
            authButtons.innerHTML = `
                <div class="user-profile">
                    ${user.profilePhoto ? 
                        `<img src="${user.profilePhoto}" alt="${user.firstName}" class="user-avatar">` : 
                        '<i class="fas fa-user-circle" style="font-size: 2rem; color: white;"></i>'
                    }
                    <span class="user-name">${user.firstName} ${user.lastName}</span>
                    <button class="logout-btn" onclick="handleMainPageLogout()">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            `;
            
            // Update mobile menu
            if (mobileMenu) {
                // Remove existing auth buttons from mobile menu
                const existingAuthInMobile = mobileMenu.querySelector('.auth-buttons');
                if (existingAuthInMobile) {
                    existingAuthInMobile.remove();
                }
                
                // Check if user profile already exists in mobile menu
                if (!mobileMenu.querySelector('.user-profile')) {
                    mobileMenu.innerHTML += `
                        <div class="user-profile">
                            ${user.profilePhoto ? 
                                `<img src="${user.profilePhoto}" alt="${user.firstName}" class="user-avatar">` : 
                                '<i class="fas fa-user-circle" style="font-size: 2rem; color: white;"></i>'
                            }
                            <span class="user-name">${user.firstName} ${user.lastName}</span>
                            <button class="logout-btn" onclick="handleMainPageLogout()">
                                <i class="fas fa-sign-out-alt"></i> Logout
                            </button>
                        </div>
                    `;
                }
            }
        } else {
            // User not logged in - show login/register buttons
            authButtons.innerHTML = `
                <button class="auth-btn login" onclick="window.location.href='login.html'">
                    <i class="fas fa-sign-in-alt"></i> Login
                </button>
                <button class="auth-btn register" onclick="window.location.href='register.html'">
                    <i class="fas fa-user-plus"></i> Register
                </button>
            `;
            
            // Update mobile menu
            if (mobileMenu) {
                const existingUserProfile = mobileMenu.querySelector('.user-profile');
                if (existingUserProfile) {
                    existingUserProfile.remove();
                }
                
                // Add auth buttons to mobile menu if they don't exist
                if (!mobileMenu.querySelector('.auth-buttons')) {
                    mobileMenu.innerHTML += `
                        <div class="auth-buttons">
                            <button class="auth-btn login" onclick="window.location.href='login.html'">
                                <i class="fas fa-sign-in-alt"></i> Login
                            </button>
                            <button class="auth-btn register" onclick="window.location.href='register.html'">
                                <i class="fas fa-user-plus"></i> Register
                            </button>
                        </div>
                    `;
                }
            }
        }
    }
}

// Handle logout from main page
function handleMainPageLogout() {
    if (confirm('Are you sure you want to logout?')) {
        logoutUser();
        showNotification('You have been logged out successfully', 'success');
    }
}

// ===============================
// Form Handlers
// ===============================

// Handle registration form submission
function handleRegistration(event) {
    event.preventDefault();
    
    if (!validateRegistrationForm()) {
        return;
    }
    
    const formData = new FormData(event.target);
    const userData = {
        firstName: formData.get('firstName').trim(),
        lastName: formData.get('lastName').trim(),
        email: formData.get('email').trim(),
        phone: formData.get('phone').trim(),
        password: formData.get('password')
    };
    
    // Show loading state
    const submitBtn = document.getElementById('registerBtn');
    const originalText = submitBtn.querySelector('.btn-text').textContent;
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').textContent = 'Creating Account...';
    
    // Simulate registration delay
    setTimeout(() => {
        const result = saveUser(userData);
        
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').textContent = originalText;
        
        if (result.success) {
            // Show success state
            submitBtn.classList.add('success');
            submitBtn.querySelector('.btn-text').innerHTML = '<i class="fas fa-check success-checkmark"></i> Account Created!';
            
            showNotification('Account created successfully! Redirecting to login...', 'success');
            
            // Redirect to login after success
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showNotification(result.message, 'error');
        }
    }, 1500);
}

// Handle login form submission
function handleLogin(event) {
    event.preventDefault();
    
    if (!validateLoginForm()) {
        return;
    }
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    // Show loading state
    const submitBtn = document.getElementById('loginBtn');
    const originalText = submitBtn.querySelector('.btn-text').textContent;
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').textContent = 'Signing In...';
    
    // Simulate login delay
    setTimeout(() => {
        const result = authenticateUser(email, password);
        
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').textContent = originalText;
        
        if (result.success) {
            // Show success state
            submitBtn.classList.add('success');
            submitBtn.querySelector('.btn-text').innerHTML = '<i class="fas fa-check success-checkmark"></i> Welcome Back!';
            
            // Save remember me preference
            if (rememberMe) {
                localStorage.setItem('rememberedUser', email);
            }
            
            showNotification(`Welcome back, ${result.user.firstName}!`, 'success');
            
            // Redirect to main page after success
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } else {
            showNotification(result.message, 'error');
            
            // Shake form on error
            document.querySelector('.auth-container').classList.add('shake');
            setTimeout(() => {
                document.querySelector('.auth-container').classList.remove('shake');
            }, 500);
        }
    }, 1000);
}

// ===============================
// Page Initialization
// ===============================

// Initialize login page
function initializeLoginPage() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Check for remembered user
    const rememberedUser = localStorage.getItem('rememberedUser');
    if (rememberedUser) {
        document.getElementById('loginEmail').value = rememberedUser;
        document.getElementById('rememberMe').checked = true;
    }
    
    // Clear any existing sessions on login page
    sessionStorage.removeItem('currentUser');
}

// Initialize register page
function initializeRegisterPage() {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegistration);
    }
    
    // Add real-time validation
    setupRealTimeValidation();
    
    // Clear any existing sessions on register page
    sessionStorage.removeItem('currentUser');
}

// Setup real-time validation for registration form
function setupRealTimeValidation() {
    // Email validation
    const emailField = document.getElementById('registerEmail');
    if (emailField) {
        emailField.addEventListener('blur', function() {
            if (this.value.trim() && !validateEmail(this.value.trim())) {
                showError('registerEmail', 'Please enter a valid email address');
            } else {
                hideError('registerEmail');
            }
        });
    }
    
    // Phone validation
    const phoneField = document.getElementById('phoneNumber');
    if (phoneField) {
        phoneField.addEventListener('input', function() {
            // Format phone number as user types
            let value = this.value.replace(/\D/g, '');
            if (value.length > 0) {
                if (value.length <= 3) {
                    value = value;
                } else if (value.length <= 6) {
                    value = value.slice(0, 3) + '-' + value.slice(3);
                } else {
                    value = value.slice(0, 3) + '-' + value.slice(3, 6) + '-' + value.slice(6, 10);
                }
                this.value = value;
            }
        });
        
        phoneField.addEventListener('blur', function() {
            if (this.value.trim() && !validatePhone(this.value.trim())) {
                showError('phoneNumber', 'Please enter a valid phone number');
            } else {
                hideError('phoneNumber');
            }
        });
    }
    
    // Password strength validation
    const passwordField = document.getElementById('registerPassword');
    if (passwordField) {
        passwordField.addEventListener('input', function() {
            if (this.value.length > 0) {
                const strength = validatePassword(this.value);
                const weaknesses = [];
                
                if (!strength.length) weaknesses.push('at least 8 characters');
                if (!strength.uppercase) weaknesses.push('uppercase letter');
                if (!strength.lowercase) weaknesses.push('lowercase letter');
                if (!strength.number) weaknesses.push('number');
                
                if (weaknesses.length > 0) {
                    showError('registerPassword', `Password needs: ${weaknesses.join(', ')}`);
                } else {
                    hideError('registerPassword');
                }
            }
        });
    }
    
    // Confirm password validation
    const confirmPasswordField = document.getElementById('confirmPassword');
    if (confirmPasswordField) {
        confirmPasswordField.addEventListener('input', function() {
            const password = document.getElementById('registerPassword').value;
            if (this.value.length > 0 && this.value !== password) {
                showError('confirmPassword', 'Passwords do not match');
            } else {
                hideError('confirmPassword');
            }
        });
    }
}

// ===============================
// Integration with Main Platform
// ===============================

// Update issue cards to show user profile photos
function updateIssueCardsWithUserPhotos() {
    const user = getCurrentUser();
    if (!user || !user.profilePhoto) return;
    
    // Update any placeholder images in issue cards with user profile photo
    const issueCards = document.querySelectorAll('.issue-card');
    issueCards.forEach(card => {
        const img = card.querySelector('.issue-image img');
        if (img && img.src.includes('placeholder') || img.src.includes('unsplash')) {
            img.src = user.profilePhoto;
        }
    });
}

// Get user profile photo for issue submission
function getUserProfilePhoto() {
    const user = getCurrentUser();
    return user && user.profilePhoto ? user.profilePhoto : null;
}

// ===============================
// Initialize on Page Load
// ===============================

// Initialize authentication system
function initializeAuth() {
    // Load current user if exists
    getCurrentUser();
    
    // Update UI based on authentication state
    updateUserInterface();
    
    // Update issue cards with profile photos
    setTimeout(updateIssueCardsWithUserPhotos, 100);
}

// Auto-initialize if not on auth pages
if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
    document.addEventListener('DOMContentLoaded', initializeAuth);
}

// ===============================
// Global Functions for Integration
// ===============================

// Check if user is logged in
function isUserLoggedIn() {
    return getCurrentUser() !== null;
}

// Get user full name
function getUserFullName() {
    const user = getCurrentUser();
    return user ? `${user.firstName} ${user.lastName}` : 'Anonymous User';
}

// Get user email
function getUserEmail() {
    const user = getCurrentUser();
    return user ? user.email : null;
}

// Login user (for external integration)
function loginUser(email, password) {
    return authenticateUser(email, password);
}

// Logout (alias for logoutUser)
function logout() {
    logoutUser();
}

// Register user (for external integration)
function registerUser(userData) {
    return saveUser(userData);
}
