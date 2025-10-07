const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY || 'demo',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'demo',
});

// Upload image buffer to Cloudinary
const uploadToCloudinary = (buffer, folder = 'general') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `anand-municipal/${folder}`,
        resource_type: 'auto',
        quality: 'auto:good',
        fetch_format: 'auto',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// Delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

// Generate optimized image URL
const getOptimizedUrl = (publicId, options = {}) => {
  const {
    width = 'auto',
    height = 'auto',
    crop = 'fill',
    quality = 'auto:good',
    format = 'auto'
  } = options;

  return cloudinary.url(publicId, {
    width,
    height,
    crop,
    quality,
    fetch_format: format
  });
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  getOptimizedUrl,
  cloudinary
};
