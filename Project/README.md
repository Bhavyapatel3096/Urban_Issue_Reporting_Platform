# Anand Municipal Corporation - Citizen Engagement Platform

A comprehensive web application for citizens to report municipal issues, track their resolution status, and contribute to better urban management in Anand, Gujarat.

## 🚀 Features

- **Issue Reporting**: Comprehensive form to report various municipal issues
- **Location Mapping**: Interactive map integration using Leaflet.js for precise location pinpointing
- **Photo Evidence**: Upload multiple photos or take pictures using device camera
- **Real-time Tracking**: Track issue status with unique tracking IDs
- **Mobile Responsive**: Fully responsive design that works on all devices
- **Data Persistence**: Local storage for offline data management

## 📁 Project Structure

```
Project/
├── index.html              # Main homepage with issue reporting form
├── photoEvidence.html      # Photo upload and camera interface
├── pinPoint.html          # Interactive map for location selection
├── try.html              # Alternative main page (duplicate - can be removed)
├── main.css              # Extracted main stylesheet
├── photoEvidence.css     # Styles for photo evidence page
├── pinPoint.css         # Styles for map/location page
├── try.js               # Main JavaScript functionality
├── photoEvidence.js     # Photo handling and camera functionality
├── pinPoint.js         # Map and location handling
└── README.md           # Project documentation
```

## 🛠️ Technologies Used

- **HTML5**: Semantic markup and modern web standards
- **CSS3**: Modern styling with CSS Grid, Flexbox, and CSS Variables
- **JavaScript (ES6+)**: Interactive functionality and API integration
- **Leaflet.js**: Interactive maps and location services
- **Font Awesome**: Modern icon library
- **OpenStreetMap**: Map tiles and geocoding services

## 🏗️ Setup Instructions

1. **Clone or Download** the project files to your local machine
2. **Open** `index.html` in a modern web browser
3. **No server required** - runs completely client-side

## 🎯 How to Use

### Reporting an Issue
1. Navigate to the "Report Issue" section
2. Select an issue category from the dropdown
3. Provide a detailed description (minimum 10 characters)
4. **Optional**: Click "Choose Location" to pinpoint exact location on map
5. **Optional**: Click "Upload Photos" to add visual evidence
6. Submit the form to receive a tracking ID

### Tracking Issues
1. Navigate to the "Check Status" section
2. Enter your tracking ID (format: AMC####)
3. Click "Check Status" to view issue details

### Location Selection
- **Click on Map**: Most accurate method - click directly on the map
- **Detect Location**: Use GPS to automatically detect your location
- **Search Address**: Search for locations by address or landmark

### Photo Evidence
- **Upload Files**: Select multiple images from your device
- **Take Photos**: Use device camera to capture images in real-time
- **Maximum 5 photos** per issue report

## 🔧 Technical Features

### Data Management
- **Local Storage**: Issues saved locally for persistence
- **Session Storage**: Temporary data for cross-page functionality
- **Real-time Updates**: Dynamic issue list updates

### Form Validation
- **Required Fields**: Category and description validation
- **Error Handling**: Visual feedback for validation errors
- **User Feedback**: Success and error messages

### Mobile Optimization
- **Responsive Design**: Works on phones, tablets, and desktops
- **Touch-friendly**: Large tap targets and mobile navigation
- **Progressive Enhancement**: Core functionality works without JavaScript

## 🐛 Recent Bug Fixes

✅ **Fixed CSS variable duplications** - Removed duplicate CSS variable declarations
✅ **Fixed duplicate icons** - Removed duplicate map marker icons in footer
✅ **Added missing form fields** - Added issue description field to the report form
✅ **Fixed JavaScript errors** - Resolved undefined variables and duplicate event listeners
✅ **Enhanced map functionality** - Added proper Leaflet CSS import and fixed map initialization
✅ **Improved form validation** - Added comprehensive validation with error styling
✅ **Enhanced mobile experience** - Improved navigation and responsive design
✅ **Integrated components** - Connected photo evidence and map pages with main form

## 🚀 Performance Optimizations

- **External CSS**: Extracted inline styles to separate CSS files
- **Optimized Images**: Using appropriate image sizes and formats
- **Efficient DOM Manipulation**: Minimized DOM queries and updates
- **Clean Code**: Removed unused code and comments

## 🌐 Browser Compatibility

- **Modern Browsers**: Chrome 60+, Firefox 60+, Safari 12+, Edge 79+
- **Mobile Browsers**: iOS Safari, Chrome Mobile, Samsung Internet
- **Progressive Enhancement**: Basic functionality in older browsers

## 📱 Mobile Features

- **Responsive Navigation**: Collapsible mobile menu
- **Touch Gestures**: Map interaction optimized for touch
- **Camera Access**: Direct camera integration for photo capture
- **Optimized Forms**: Mobile-friendly form layouts

## 🔒 Security Considerations

- **Client-side Only**: No server-side dependencies
- **Local Data**: All data stored locally (no external transmission)
- **Safe External APIs**: Using trusted services (OpenStreetMap, Nominatim)

## 🚀 Future Enhancements

- **Backend Integration**: Connect to municipal database
- **Real-time Notifications**: Push notifications for status updates
- **Advanced Analytics**: Issue statistics and reporting
- **Multi-language Support**: Gujarati and Hindi language options
- **Offline Functionality**: Service worker for offline capabilities

## 📞 Support

For technical support or questions about the Municipal Corporation services:
- **Phone**: +91 2692 256 300
- **Email**: info@anandmc.gov.in
- **Address**: Municipal Corporation Building, Anand, Gujarat 388001

---
*© 2023 Anand Municipal Corporation. All rights reserved.*
