# Seva Rotation App

A web application for managing seva (service) task rotations with real-time synchronization across multiple devices.

## Features

- **Task Rotation Management**: Automatically rotate seva assignments
- **Real-time Sync**: Changes sync instantly across all devices via Firebase
- **Admin Controls**: Secure login system for managing assignments
- **Screenshot Functionality**: Take clean screenshots of assignments
- **Cross-device Sharing**: Share assignments via URL or text
- **Responsive Design**: Works perfectly on desktop and mobile devices

## How to Use

1. **View Assignments**: Open the app to see current seva assignments
2. **Admin Login**: Click the login button and use credentials to access admin controls
3. **Rotate Tasks**: Use the "Rotate Assignments" button to rotate tasks
4. **Share**: Use "Share Link" to get a URL that syncs across devices
5. **Screenshot**: Take clean screenshots for sharing or printing

<!-- ## Admin Credentials

- **Username**: `admin`
- **Password**: `seva2024` -->

## Technical Details

- **Frontend**: Pure HTML, CSS, and JavaScript
- **Backend**: Firebase Realtime Database for synchronization
- **Storage**: Local storage with Firebase backup
- **Screenshots**: html2canvas library for clean image generation

## Files

- `index.html` - Main application structure
- `app.js` - Core application logic and Firebase integration
- `styles.css` - Responsive styling and animations

## Setup

1. Clone or download the files
2. Host on any web server (GitHub Pages, Netlify, etc.)
3. The app works immediately with Firebase integration

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Mobile)

---

**Note**: This app is designed for seva task management and includes Gujarati text. All data is synced in real-time across devices using Firebase.
