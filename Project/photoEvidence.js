 document.addEventListener('DOMContentLoaded', function() {
            // Elements
            const uploadOption = document.getElementById('uploadOption');
            const cameraOption = document.getElementById('cameraOption');
            const fileInput = document.getElementById('fileInput');
            const previewContainer = document.getElementById('previewContainer');
            const previewArea = document.getElementById('previewArea');
            const cameraView = document.getElementById('cameraView');
            const video = document.getElementById('video');
            const captureBtn = document.getElementById('captureBtn');
            const switchCameraBtn = document.getElementById('switchCameraBtn');
            const imagePreview = document.getElementById('imagePreview');
            const placeholderText = document.getElementById('placeholderText');
            const addPhotoBtn = document.getElementById('addPhotoBtn');
            const cancelBtn = document.getElementById('cancelBtn');
            const photosGrid = document.getElementById('photosGrid');
            const photoCount = document.getElementById('photoCount');
            
            let stream = null;
            let currentFacingMode = 'environment'; // Start with back camera
            const uploadedPhotos = [];
            
            // Upload option click handler
            uploadOption.addEventListener('click', function() {
                fileInput.click();
            });
            
            // File input change handler
            fileInput.addEventListener('change', function(e) {
                if (e.target.files && e.target.files.length > 0) {
                    const files = Array.from(e.target.files);
                    
                    // Check if adding these files would exceed the limit
                    if (uploadedPhotos.length + files.length > 5) {
                        alert('You can only upload up to 5 photos. Please select fewer files.');
                        return;
                    }
                    
                    // Process each file
                    files.forEach(file => {
                        if (file.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onload = function(e) {
                                addPhotoToGrid(e.target.result, file.name);
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                }
            });
            
            // Camera option click handler
            cameraOption.addEventListener('click', function() {
                openCamera();
            });
            
            // Cancel button click handler
            cancelBtn.addEventListener('click', function() {
                closeCamera();
                previewContainer.style.display = 'none';
            });
            
            // Capture button click handler
            captureBtn.addEventListener('click', function() {
                capturePhoto();
            });
            
            // Switch camera button click handler
            switchCameraBtn.addEventListener('click', function() {
                switchCamera();
            });
            
            // Add photo button click handler
            addPhotoBtn.addEventListener('click', function() {
                if (imagePreview.querySelector('img')) {
                    const dataUrl = imagePreview.querySelector('img').src;
                    addPhotoToGrid(dataUrl, `photo-${Date.now()}.jpg`);
                    closeCamera();
                    previewContainer.style.display = 'none';
                }
            });
            
            // Open camera function
            function openCamera() {
                previewContainer.style.display = 'block';
                cameraView.style.display = 'block';
                imagePreview.style.display = 'none';
                placeholderText.style.display = 'none';
                addPhotoBtn.style.display = 'none';
                
                const constraints = {
                    video: { facingMode: currentFacingMode },
                    audio: false
                };
                
                navigator.mediaDevices.getUserMedia(constraints)
                    .then(function(mediaStream) {
                        stream = mediaStream;
                        video.srcObject = stream;
                        video.play();
                    })
                    .catch(function(error) {
                        console.error('Error accessing camera:', error);
                        alert('Unable to access camera. Please check permissions and try again.');
                        previewContainer.style.display = 'none';
                    });
            }
            
            // Close camera function
            function closeCamera() {
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                    stream = null;
                }
                cameraView.style.display = 'none';
                imagePreview.style.display = 'block';
            }
            
            // Switch camera function
            function switchCamera() {
                // Stop current stream
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                
                // Toggle between front and back camera
                currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
                
                // Restart with new facing mode
                openCamera();
            }
            
            // Capture photo function
            function capturePhoto() {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const dataUrl = canvas.toDataURL('image/jpeg');
                
                // Show captured image in preview
                imagePreview.innerHTML = `<img src="${dataUrl}" alt="Captured photo">`;
                imagePreview.style.display = 'block';
                cameraView.style.display = 'none';
                addPhotoBtn.style.display = 'block';
            }
            
            // Add photo to grid function
            function addPhotoToGrid(dataUrl, filename) {
                if (uploadedPhotos.length >= 5) {
                    alert('You can only add up to 5 photos. Please remove one before adding another.');
                    return;
                }
                
                const photoId = Date.now();
                uploadedPhotos.push({
                    id: photoId,
                    dataUrl: dataUrl,
                    filename: filename
                });
                
                // Remove empty state if it exists
                const emptyState = photosGrid.querySelector('.empty-state');
                if (emptyState) {
                    emptyState.remove();
                }
                
                const photoItem = document.createElement('div');
                photoItem.className = 'photo-item';
                photoItem.innerHTML = `
                    <img src="${dataUrl}" alt="Uploaded photo">
                    <div class="photo-actions">
                        <button class="view-btn" data-id="${photoId}"><i class="fas fa-eye"></i></button>
                        <button class="delete-btn" data-id="${photoId}"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                
                photosGrid.appendChild(photoItem);
                updatePhotoCount();
                
                // Add event listeners to the new buttons
                photoItem.querySelector('.view-btn').addEventListener('click', function(e) {
                    e.stopPropagation();
                    viewPhoto(photoId);
                });
                
                photoItem.querySelector('.delete-btn').addEventListener('click', function(e) {
                    e.stopPropagation();
                    deletePhoto(photoId);
                });
            }
            
            // View photo function
            function viewPhoto(photoId) {
                const photo = uploadedPhotos.find(p => p.id === photoId);
                if (photo) {
                    // Create modal for viewing image
                    const modal = document.createElement('div');
                    modal.style.position = 'fixed';
                    modal.style.top = '0';
                    modal.style.left = '0';
                    modal.style.width = '100%';
                    modal.style.height = '100%';
                    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                    modal.style.display = 'flex';
                    modal.style.alignItems = 'center';
                    modal.style.justifyContent = 'center';
                    modal.style.zIndex = '1000';
                    modal.innerHTML = `
                        <div style="position: relative; max-width: 90%; max-height: 90%;">
                            <img src="${photo.dataUrl}" style="max-width: 100%; max-height: 80vh; border-radius: 8px;">
                            <button style="position: absolute; top: -40px; right: 0; background: #333; color: white; border: none; width: 30px; height: 30px; border-radius: 50%;">×</button>
                        </div>
                    `;
                    
                    document.body.appendChild(modal);
                    
                    // Close modal on click
                    modal.addEventListener('click', function() {
                        document.body.removeChild(modal);
                    });
                    
                    // Prevent click on image from closing modal
                    modal.querySelector('img').addEventListener('click', function(e) {
                        e.stopPropagation();
                    });
                }
            }
            
            // Delete photo function
            function deletePhoto(photoId) {
                if (confirm('Are you sure you want to remove this photo?')) {
                    const index = uploadedPhotos.findIndex(p => p.id === photoId);
                    if (index !== -1) {
                        uploadedPhotos.splice(index, 1);
                        
                        // Remove from DOM
                        const photoItem = photosGrid.querySelector(`[data-id="${photoId}"]`).closest('.photo-item');
                        photoItem.remove();
                        
                        // If no photos left, show empty state
                        if (uploadedPhotos.length === 0) {
                            photosGrid.innerHTML = `
                                <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 30px; color: #666;">
                                    <i class="fas fa-images" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                                    <p>No photos added yet. Upload or take photos to add visual evidence.</p>
                                </div>
                            `;
                        }
                        
                        updatePhotoCount();
                    }
                }
            }
            
            // Update photo count function
            function updatePhotoCount() {
                photoCount.textContent = `(${uploadedPhotos.length}/5)`;
            }
        });
    // Additional functionality for continue and back buttons
    const continueButton = document.querySelector('.action-buttons .btn-primary');
    const backButton = document.querySelector('.action-buttons .btn-outline');
    
    if (continueButton) {
        continueButton.addEventListener('click', function() {
            // Save photos to session storage
            sessionStorage.setItem('selectedPhotos', JSON.stringify(uploadedPhotos));
            
            // Return to the report page
            window.location.href = 'index.html#report';
        });
    }
    
    if (backButton) {
        backButton.addEventListener('click', function() {
            window.location.href = 'index.html#report';
        });
    }
