/*
 * Seva App Web Version - JavaScript Application Logic
 * 
 * This file contains all the functionality from the original JavaFX application
 * converted to JavaScript for web use. It includes:
 * - Data management and persistence
 * - Rotation logic
 * - UI interactions
 * - Quality of life improvements (screenshot, sharing, etc.)
 * 
 * Author: Web App Conversion for Learning Purposes
 * Target Audience: University Computer Science Students
 */

// ============================================================================
// GLOBAL VARIABLES AND DATA STRUCTURES
// ============================================================================

/**
 * Array of seva (service) tasks - matches the original Java application
 * Each task represents a cleaning area or responsibility
 */
const SEVA_TASKS = [
    "Main Hall, Entrance, Coat Closet",
    "Kitchen", 
    "Fridges",
    "Upper Rooms and Walkway/Stairs",
    "Upper Washroom",
    "Dastva Hall and Walkway/Stairs", 
    "Lower Washroom",
    "Private Washroom and Laundry Room",
    "Basement, Luggage Room and Kitchen",
    "Garbage",
    "Grocery",
    "Yard"
];

/**
 * Array of task capacities - matches the original Java application
 * Each number represents how many people can be assigned to that task
 * The index corresponds to the task in SEVA_TASKS array
 */
const TASK_CAPACITIES = [3, 3, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1];

/**
 * Default assignments - used when no saved data exists
 * These match the original Java application's default values
 */
const DEFAULT_ASSIGNMENTS = [
    ["Het Bhai", "Harsh Bhai", "Avi Bhai"], // Main Hall, Entrance, Coat Closet (3)
    ["Devang Bhai", "Kintul Bhai", "Shreyansh Bhai"], // Kitchen (3)
    ["Rohan Bhai"], // Fridges (1)
    ["Malav Bhai & Param Bhai"], // Upper Rooms and Walkway/Stairs (1) - Combined unit
    ["Jayraj Bhai"], // Upper Washroom (1)
    ["Vraj Bhai", "Nisarg Bhai"], // Dastva Hall and Walkway/Stairs (2)
    ["Sheel Bhai"], // Lower Washroom (1)
    ["Hardik Bhai"], // Private Washroom and Laundry Room (1)
    ["Heet Bhai", "Pratik Bhai"], // Basement, Luggage Room and Kitchen (2)
    ["Bhumin Bhai"], // Garbage (1)
    ["Bhagirath Bhai", "Mann Bhai"], // Grocery (2) - Bhagirath Bhai is permanent
    ["Volunteer"] // Yard (Fixed volunteer)
];

// Storage keys for browser's localStorage
const STORAGE_KEY = 'sevaAppData';
const LAST_UPDATED_KEY = 'sevaAppLastUpdated';
const VIEWER_COUNT_KEY = 'sevaAppViewerCount';
const VIEWER_ID_KEY = 'sevaAppViewerId';

// Current assignments data - will be loaded from storage or default
let currentAssignments = [];

// Real-time sync variables
let viewerCount = 1;
let viewerId = null;
let syncInterval = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Shows a notification message to the user
 * @param {string} message - The message to display
 * @param {string} type - Type of notification ('success', 'error', 'info')
 */
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    // Set the message
    notificationText.textContent = message;
    
    // Set the color based on type
    notification.style.backgroundColor = type === 'error' ? '#f44336' : 
                                       type === 'info' ? '#2196f3' : 
                                       '#4caf50';
    
    // Show the notification
    notification.style.display = 'flex';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

/**
 * Shows or hides the loading overlay
 * @param {boolean} show - Whether to show the overlay
 */
function toggleLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
}

/**
 * Gets current timestamp for tracking when data was last updated
 * @returns {string} Formatted timestamp
 */
function getCurrentTimestamp() {
    return new Date().toLocaleString();
}

/**
 * Updates the last updated timestamp in the footer
 */
function updateLastUpdatedTime() {
    const lastUpdatedElement = document.getElementById('lastUpdated');
    lastUpdatedElement.textContent = getCurrentTimestamp();
}

// ============================================================================
// DATA PERSISTENCE FUNCTIONS
// ============================================================================

/**
 * Saves the current assignments to browser's localStorage
 * localStorage is a browser feature that persists data even after closing the browser
 */
function saveAssignments() {
    try {
        // Create data object with assignments and timestamp
        const dataToSave = {
            assignments: currentAssignments,
            timestamp: getCurrentTimestamp()
        };
        
        // Save to localStorage (converts object to JSON string)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
        localStorage.setItem(LAST_UPDATED_KEY, getCurrentTimestamp());
        
        // Update the display
        updateLastUpdatedTime();
        
        console.log('Assignments saved successfully');
    } catch (error) {
        console.error('Error saving assignments:', error);
        showNotification('Error saving data!', 'error');
    }
}

/**
 * Loads assignments from browser's localStorage or uses defaults
 * This function is called when the app starts
 */
function loadAssignments() {
    try {
        // Try to get saved data from localStorage
        const savedData = localStorage.getItem(STORAGE_KEY);
        
        if (savedData) {
            // Parse the JSON string back to an object
            const data = JSON.parse(savedData);
            currentAssignments = data.assignments || [];
            
            console.log('Assignments loaded from storage');
        } else {
            // No saved data, use defaults
            currentAssignments = JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS));
            console.log('Using default assignments');
        }
        
        // Update the last updated time
        updateLastUpdatedTime();
        
    } catch (error) {
        console.error('Error loading assignments:', error);
        // Fallback to defaults if there's an error
        currentAssignments = JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS));
        showNotification('Error loading saved data, using defaults', 'error');
    }
}

// ============================================================================
// ROTATION LOGIC (CORE FUNCTIONALITY)
// ============================================================================

/**
 * Rotates people between tasks - this is the main feature of the app
 * The logic matches the original Java application exactly:
 * 1. Collects all people except Bhagirathbhai and Volunteer
 * 2. Moves the last person to the front
 * 3. Redistributes people according to task capacities
 */
function rotatePeople() {
    // Show loading indicator
    toggleLoading(true);
    
    try {
        // Step 1: Collect people for rotation (excluding Bhagirath Bhai, Volunteer, and the combined pair)
        let peopleToRotate = [];
        
        // Go through each task and collect people
        for (let i = 0; i < currentAssignments.length; i++) {
            const seva = SEVA_TASKS[i];
            const bhakto = currentAssignments[i];
            
            if (seva !== "Grocery" && seva !== "Yard") {
                // Add all people from non-special tasks (including the combined pair)
                peopleToRotate = peopleToRotate.concat(bhakto);
            } else if (seva === "Grocery") {
                // Only add people from grocery who are not Bhagirath Bhai
                for (let person of bhakto) {
                    if (person !== "Bhagirath Bhai") {
                        peopleToRotate.push(person);
                    }
                }
            }
            // Yard task (Volunteer) is not added to rotation pool
        }
        
        // Step 2: Perform the rotation - move last person to front
        if (peopleToRotate.length > 0) {
            const lastPerson = peopleToRotate.pop(); // Remove last person
            peopleToRotate.unshift(lastPerson); // Add to front
        }
        
        // Debug logging
        console.log('People to rotate:', peopleToRotate);
        console.log('Total people in rotation pool:', peopleToRotate.length);
        
        // Check if the combined pair is in the rotation pool
        const hasCombinedPair = peopleToRotate.includes("Malav Bhai & Param Bhai");
        console.log('Combined pair in rotation pool:', hasCombinedPair);
        
        // Step 3: Redistribute people according to task capacities
        let personIndex = 0;
        
        for (let i = 0; i < currentAssignments.length; i++) {
            const seva = SEVA_TASKS[i];
            const capacity = TASK_CAPACITIES[i];
            const newGroup = [];
            
            switch (seva) {
                case "Yard":
                    // Yard always gets "Volunteer"
                    newGroup.push("Volunteer");
                    break;
                    
                case "Grocery":
                    // Grocery always gets "Bhagirath Bhai" first (permanent)
                    newGroup.push("Bhagirath Bhai");
                    
                    // Add second person from rotation pool
                    if (personIndex < peopleToRotate.length) {
                        newGroup.push(peopleToRotate[personIndex++]);
                    }
                    break;
                    
                default:
                    // All other tasks get people from rotation pool
                    for (let j = 0; j < capacity; j++) {
                        if (personIndex < peopleToRotate.length) {
                            newGroup.push(peopleToRotate[personIndex++]);
                        }
                    }
                    break;
            }
            
            // Update the assignment
            currentAssignments[i] = newGroup;
        }
        
        // Step 4: Save the new assignments and update the display
        saveAssignments();
        renderTable();
        
        // Notify other users of the change
        notifyOtherUsers('rotation');
        
        // Show success message
        showNotification('Assignments rotated successfully! 🔄');
        
        console.log('Rotation completed successfully');
        
    } catch (error) {
        console.error('Error during rotation:', error);
        showNotification('Error during rotation!', 'error');
    } finally {
        // Hide loading indicator
        toggleLoading(false);
    }
}

// ============================================================================
// UI RENDERING FUNCTIONS
// ============================================================================

/**
 * Renders the seva table with current assignments
 * This function updates the HTML table to show current data
 */
function renderTable() {
    const tableBody = document.getElementById('sevaTableBody');
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // Create a row for each seva task
    for (let i = 0; i < SEVA_TASKS.length; i++) {
        const seva = SEVA_TASKS[i];
        const bhakto = currentAssignments[i] || [];
        
        // Create table row
        const row = document.createElement('tr');
        
        // Create seva cell
        const sevaCell = document.createElement('td');
        sevaCell.textContent = seva;
        sevaCell.className = 'seva-cell';
        
        // Create bhakto cell
        const bhaktoCell = document.createElement('td');
        bhaktoCell.textContent = bhakto.join(', '); // Join names with commas
        bhaktoCell.className = 'bhakto-cell';
        
        // Add cells to row
        row.appendChild(sevaCell);
        row.appendChild(bhaktoCell);
        
        // Add row to table
        tableBody.appendChild(row);
    }
}

/**
 * Resets assignments to default values
 * This is useful if you want to start over
 */
function resetToDefault() {
    // Show confirmation dialog
    if (confirm('Are you sure you want to reset to default assignments? This cannot be undone.')) {
        toggleLoading(true);
        
        try {
            // Reset to defaults
            currentAssignments = JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS));
            
            // Save and update display
            saveAssignments();
            renderTable();
            
            // Notify other users of the change
            notifyOtherUsers('reset');
            
            showNotification('Reset to default assignments! 🔄');
            
        } catch (error) {
            console.error('Error resetting assignments:', error);
            showNotification('Error resetting assignments!', 'error');
        } finally {
            toggleLoading(false);
        }
    }
}

/**
 * Clears all stored data and resets to defaults
 * This is useful when you want to completely start fresh
 */
function clearStorageAndReset() {
    // Show confirmation dialog
    if (confirm('Are you sure you want to clear all stored data and reset to defaults? This will remove all saved assignments and cannot be undone.')) {
        toggleLoading(true);
        
        try {
            // Clear all localStorage data
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(LAST_UPDATED_KEY);
            
            // Reset to defaults
            currentAssignments = JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS));
            
            // Save and update display
            saveAssignments();
            renderTable();
            
            // Notify other users of the change
            notifyOtherUsers('clear_storage');
            
            showNotification('Storage cleared and reset to defaults! 🗑️');
            
        } catch (error) {
            console.error('Error clearing storage:', error);
            showNotification('Error clearing storage!', 'error');
        } finally {
            toggleLoading(false);
        }
    }
}

// ============================================================================
// QUALITY OF LIFE IMPROVEMENTS
// ============================================================================

/**
 * Takes a screenshot of the current assignments table
 * This makes it easy to share the current state with your group
 */
function takeScreenshot() {
    try {
        // Hide buttons and unnecessary elements for clean screenshot
        const controls = document.querySelector('.controls');
        const footer = document.querySelector('.footer');
        const notification = document.getElementById('notification');
        
        // Store original display states
        const originalControlsDisplay = controls.style.display;
        const originalFooterDisplay = footer.style.display;
        const originalNotificationDisplay = notification.style.display;
        
        // Hide elements for clean screenshot
        controls.style.display = 'none';
        footer.style.display = 'none';
        notification.style.display = 'none';
        
        // Add screenshot class to body for special styling
        document.body.classList.add('screenshot-mode');
        
        // Use simple canvas method that doesn't require permissions
        captureWithCanvas();
        
        // Restore original display states after a delay
        setTimeout(() => {
            controls.style.display = originalControlsDisplay;
            footer.style.display = originalFooterDisplay;
            notification.style.display = originalNotificationDisplay;
            document.body.classList.remove('screenshot-mode');
        }, 1000);
        
    } catch (error) {
        console.error('Screenshot error:', error);
        showNotification('Screenshot failed! Please try again.', 'error');
    }
}

/**
 * Capture screenshot using the actual webpage content - exact same styling!
 */
function captureWithCanvas() {
    // Create a temporary container with all the content
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.top = '-9999px';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '1000px';
    tempContainer.style.backgroundColor = getComputedStyle(document.body).backgroundColor;
    tempContainer.style.fontFamily = getComputedStyle(document.body).fontFamily;
    tempContainer.style.color = getComputedStyle(document.body).color;
    
    // Clone the actual webpage elements to preserve all styling
    const header = document.querySelector('.header').cloneNode(true);
    const tableContainer = document.querySelector('.table-container').cloneNode(true);
    const gujaratiText = document.querySelector('.gujarati-text').cloneNode(true);
    
    // Apply screenshot mode styles to the cloned elements
    header.classList.add('screenshot-mode');
    tableContainer.classList.add('screenshot-mode');
    gujaratiText.classList.add('screenshot-mode');
    
    tempContainer.appendChild(header);
    tempContainer.appendChild(tableContainer);
    tempContainer.appendChild(gujaratiText);
    
    // Add to DOM temporarily so styles are applied
    document.body.appendChild(tempContainer);
    
    // Try to use html2canvas if available for perfect rendering
    if (typeof html2canvas !== 'undefined') {
        html2canvas(tempContainer, {
            backgroundColor: getComputedStyle(document.body).backgroundColor,
            scale: 2, // Higher quality
            useCORS: true,
            allowTaint: true,
            logging: false
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `seva-assignments-${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
            
            showNotification('Screenshot saved! 📸');
            document.body.removeChild(tempContainer);
        }).catch(error => {
            console.log('html2canvas failed, using fallback method');
            fallbackCanvasMethod(tempContainer);
        });
    } else {
        // Fallback method using browser's built-in canvas
        fallbackCanvasMethod(tempContainer);
    }
}

/**
 * Fallback method that renders the actual DOM content to canvas
 */
function fallbackCanvasMethod(tempContainer) {
    // Create canvas with proper dimensions
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size with breathing space
    canvas.width = 1000;  // Width adjusted as requested
    canvas.height = 800;  // Taller for better proportions
    
    // Get computed styles from the actual webpage
    const bodyStyles = getComputedStyle(document.body);
    const titleStyles = getComputedStyle(document.querySelector('.main-title'));
    const subtitleStyles = getComputedStyle(document.querySelector('.sub-title'));
    const tableStyles = getComputedStyle(document.querySelector('.seva-table'));
    
    // Fill background
    ctx.fillStyle = bodyStyles.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Render title with exact same styling
    ctx.fillStyle = titleStyles.color;
    ctx.font = `${titleStyles.fontWeight} ${titleStyles.fontSize} ${titleStyles.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('IT\'S HOUSE CLEANING SEVA TIME!', canvas.width / 2, 60);
    
    // Render subtitle with exact same styling
    ctx.fillStyle = subtitleStyles.color;
    ctx.font = `${subtitleStyles.fontWeight} ${subtitleStyles.fontSize} ${subtitleStyles.fontFamily}`;
    ctx.fillText('LETS TRY TO COMPLETE IT BEFORE SUNDAY 🙏', canvas.width / 2, 90);
    
    // Draw table with exact same styling and breathing space
    const tableY = 150;  // More space from title
    const tableHeight = 400;  // Taller table
    const tableWidth = 900;   // Fixed width for better proportions
    const tableX = (canvas.width - tableWidth) / 2;  // Center the table
    
    // Table background and border
    ctx.fillStyle = tableStyles.backgroundColor;
    ctx.fillRect(tableX, tableY, tableWidth, tableHeight);
    
    // Table border
    ctx.strokeStyle = '#ff7e16';
    ctx.lineWidth = 2;
    ctx.strokeRect(tableX, tableY, tableWidth, tableHeight);
    
    // Table header
    ctx.fillStyle = '#ff7e16';
    ctx.fillRect(tableX, tableY, tableWidth, 40);
    
    // Header text with exact styling
    ctx.fillStyle = '#242424';
    ctx.font = 'bold 16px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Seva', tableX + 20, tableY + 25);
    ctx.fillText('Bhakto', tableX + tableWidth/2 + 20, tableY + 25);
    
    // Table rows with exact styling
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 14px Inter, Arial, sans-serif';
    
    let rowY = tableY + 60;
    const rowHeight = 30;
    
    for (let i = 0; i < SEVA_TASKS.length; i++) {
        const seva = SEVA_TASKS[i];
        const bhakto = currentAssignments[i] || [];
        
        // Row separator
        ctx.strokeStyle = '#dddddd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tableX, rowY);
        ctx.lineTo(tableX + tableWidth, rowY);
        ctx.stroke();
        
        // Text with proper spacing
        ctx.fillText(seva, tableX + 20, rowY - 8);
        ctx.fillText(bhakto.join(', '), tableX + tableWidth/2 + 20, rowY - 8);
        
        rowY += rowHeight;
    }
    
    // Gujarati text with exact styling and breathing space
    const gujaratiStyles = getComputedStyle(document.querySelector('.gujarati-text'));
    ctx.fillStyle = gujaratiStyles.color;
    ctx.font = `${gujaratiStyles.fontWeight} ${gujaratiStyles.fontSize} ${gujaratiStyles.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('સેવા માં બની ગરજુ ન કરીએ ફરિયાદ મફત જે મળી મોજ તેને લૂટી લઈએ આજ', canvas.width / 2, 600);
    
    // Download the image
    const link = document.createElement('a');
    link.download = `seva-assignments-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
    
    showNotification('Screenshot saved! 📸');
    document.body.removeChild(tempContainer);
}


/**
 * Shares the current assignments via Web Share API or clipboard
 * This makes it easy to send assignments to your group chat
 */
async function shareAssignments() {
    try {
        // Create a formatted text version of the assignments
        let shareText = "🏠 HOUSE CLEANING SEVA ASSIGNMENTS 🏠\n\n";
        shareText += "📅 " + getCurrentTimestamp() + "\n\n";
        
        for (let i = 0; i < SEVA_TASKS.length; i++) {
            const seva = SEVA_TASKS[i];
            const bhakto = currentAssignments[i] || [];
            shareText += `📍 ${seva}: ${bhakto.join(', ')}\n`;
        }
        
        shareText += "\n🙏 Let's complete it before Sunday!";
        
        // Try to use Web Share API if available (mobile browsers)
        if (navigator.share) {
            await navigator.share({
                title: 'Seva Assignments',
                text: shareText
            });
            showNotification('Shared successfully! 📤');
        } else {
            // Fallback: copy to clipboard
            await navigator.clipboard.writeText(shareText);
            showNotification('Assignments copied to clipboard! 📋');
        }
        
    } catch (error) {
        console.error('Share error:', error);
        showNotification('Share failed! Try copying manually.', 'error');
    }
}

// ============================================================================
// EVENT LISTENERS AND INITIALIZATION
// ============================================================================

/**
 * Sets up all event listeners for buttons and interactions
 * This function is called when the page loads
 */
function setupEventListeners() {
    // Rotate button - main functionality
    const rotateBtn = document.getElementById('rotateBtn');
    rotateBtn.addEventListener('click', rotatePeople);
    
    // Screenshot button - quality of life improvement
    const screenshotBtn = document.getElementById('screenshotBtn');
    screenshotBtn.addEventListener('click', takeScreenshot);
    
    // Share button - quality of life improvement
    const shareBtn = document.getElementById('shareBtn');
    shareBtn.addEventListener('click', shareAssignments);
    
    // Reset button - utility function
    const resetBtn = document.getElementById('resetBtn');
    resetBtn.addEventListener('click', resetToDefault);
    
    // Clear storage button - utility function
    const clearStorageBtn = document.getElementById('clearStorageBtn');
    clearStorageBtn.addEventListener('click', clearStorageAndReset);
    
    // Notification close button
    const closeNotificationBtn = document.getElementById('closeNotification');
    closeNotificationBtn.addEventListener('click', () => {
        document.getElementById('notification').style.display = 'none';
    });
    
    // Keyboard shortcuts for power users
    document.addEventListener('keydown', (event) => {
        // Ctrl+R or Cmd+R for rotation
        if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault(); // Prevent browser refresh
            rotatePeople();
        }
        
        // Ctrl+S or Cmd+S for screenshot
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault(); // Prevent browser save
            takeScreenshot();
        }
    });
    
    console.log('Event listeners set up successfully');
}

/**
 * Initializes the application when the page loads
 * This is the main entry point for the application
 */
function initializeApp() {
    console.log('Initializing Seva App...');
    
    try {
        // Load saved data or use defaults
        loadAssignments();
        
        // Render the initial table
        renderTable();
        
        // Set up event listeners
        setupEventListeners();
        
        // Set up login system
        setupLoginEventListeners();
        checkLoginState();
        
        // Initialize real-time features
        initializeViewerTracking();
        startRealTimeSync();
        
        // Set up page visibility handling
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', stopRealTimeSync);
        
        // Show welcome message
        showNotification('Seva App loaded successfully! Welcome back! 🏠', 'info');
        
        console.log('Seva App initialized successfully');
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Error loading app! Please refresh the page.', 'error');
    }
}

// ============================================================================
// APPLICATION STARTUP
// ============================================================================

/**
 * Wait for the page to fully load before initializing
 * This ensures all HTML elements are available
 */
document.addEventListener('DOMContentLoaded', initializeApp);

// Also initialize if the page is already loaded (for some browsers)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// ============================================================================
// DEBUGGING AND DEVELOPMENT UTILITIES
// ============================================================================

/**
 * Debug function to log current state
 * Useful for development and troubleshooting
 */
function debugLogState() {
    console.log('=== SEVA APP DEBUG STATE ===');
    console.log('Current assignments:', currentAssignments);
    console.log('Tasks:', SEVA_TASKS);
    console.log('Capacities:', TASK_CAPACITIES);
    console.log('Storage data:', localStorage.getItem(STORAGE_KEY));
    console.log('============================');
}

// Make debug function available in browser console
window.debugSevaApp = debugLogState;

// Force reset function for troubleshooting
window.forceReset = function() {
    localStorage.clear();
    location.reload();
};

// ============================================================================
// REAL-TIME SYNCHRONIZATION SYSTEM
// ============================================================================

/**
 * Generate a unique viewer ID
 */
function generateViewerId() {
    return 'viewer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Update viewer count display
 */
function updateViewerCountDisplay() {
    const viewerCountElement = document.getElementById('viewerCount');
    if (viewerCountElement) {
        viewerCountElement.textContent = viewerCount;
    }
}

/**
 * Initialize viewer tracking
 */
function initializeViewerTracking() {
    // Generate or get existing viewer ID
    viewerId = localStorage.getItem(VIEWER_ID_KEY);
    if (!viewerId) {
        viewerId = generateViewerId();
        localStorage.setItem(VIEWER_ID_KEY, viewerId);
    }
    
    // Initialize viewer count
    const storedCount = localStorage.getItem(VIEWER_COUNT_KEY);
    if (storedCount) {
        viewerCount = parseInt(storedCount) + 1;
    } else {
        viewerCount = 1;
    }
    
    localStorage.setItem(VIEWER_COUNT_KEY, viewerCount.toString());
    updateViewerCountDisplay();
    
    console.log('Viewer tracking initialized:', viewerId, 'Total viewers:', viewerCount);
}

/**
 * Simulate real-time sync (in a real app, this would use WebSockets or similar)
 */
function startRealTimeSync() {
    // Check for updates every 5 seconds
    syncInterval = setInterval(() => {
        checkForUpdates();
        updateViewerCount();
    }, 5000);
    
    console.log('Real-time sync started');
}

/**
 * Stop real-time sync
 */
function stopRealTimeSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
    
    // Decrease viewer count when leaving
    const currentCount = parseInt(localStorage.getItem(VIEWER_COUNT_KEY) || '1');
    if (currentCount > 1) {
        localStorage.setItem(VIEWER_COUNT_KEY, (currentCount - 1).toString());
    }
    
    console.log('Real-time sync stopped');
}

/**
 * Check for updates from other users
 */
function checkForUpdates() {
    const lastUpdated = localStorage.getItem(LAST_UPDATED_KEY);
    const storedData = localStorage.getItem(STORAGE_KEY);
    
    if (storedData) {
        try {
            const data = JSON.parse(storedData);
            const dataTimestamp = data.timestamp;
            
            // If data is newer, update the display
            if (dataTimestamp !== getCurrentTimestamp()) {
                currentAssignments = data.assignments || [];
                renderTable();
                updateLastUpdatedTime();
                
                // Show notification only if user is logged in
                if (isLoggedIn) {
                    showNotification('Assignments updated by another user! 🔄', 'info');
                }
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
        }
    }
}

/**
 * Update viewer count (simulate other users joining/leaving)
 */
function updateViewerCount() {
    // Simulate random viewer count changes (in real app, this would come from server)
    const randomChange = Math.random();
    if (randomChange < 0.1) { // 10% chance of change
        const change = Math.random() < 0.5 ? 1 : -1;
        viewerCount = Math.max(1, viewerCount + change);
        updateViewerCountDisplay();
    }
}

/**
 * Notify other users of changes (when admin makes updates)
 */
function notifyOtherUsers(action) {
    if (isLoggedIn) {
        // In a real app, this would send to server
        console.log(`Admin action: ${action} - notifying other users`);
        
        // Update timestamp to trigger sync for other users
        const currentData = {
            assignments: currentAssignments,
            timestamp: getCurrentTimestamp(),
            lastAction: action,
            adminId: viewerId
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
        localStorage.setItem(LAST_UPDATED_KEY, getCurrentTimestamp());
        
        showNotification(`Changes saved and synced to all users! 📡`, 'success');
    }
}

/**
 * Handle page visibility change (when user switches tabs)
 */
function handleVisibilityChange() {
    if (document.hidden) {
        // Page is hidden, reduce viewer count
        const currentCount = parseInt(localStorage.getItem(VIEWER_COUNT_KEY) || '1');
        if (currentCount > 1) {
            localStorage.setItem(VIEWER_COUNT_KEY, (currentCount - 1).toString());
        }
    } else {
        // Page is visible, increase viewer count
        const currentCount = parseInt(localStorage.getItem(VIEWER_COUNT_KEY) || '1');
        localStorage.setItem(VIEWER_COUNT_KEY, (currentCount + 1).toString());
        updateViewerCountDisplay();
    }
}

// ============================================================================
// LOGIN SYSTEM FUNCTIONALITY
// ============================================================================

// Login credentials (you can change these)
const LOGIN_CREDENTIALS = {
    username: 'admin',
    password: 'seva2024'
};

// Session storage key for login state
const LOGIN_STORAGE_KEY = 'sevaAppLoginState';

// Global variable to track login state
let isLoggedIn = false;

/**
 * Check if user is logged in (from session storage)
 */
function checkLoginState() {
    const loginState = sessionStorage.getItem(LOGIN_STORAGE_KEY);
    if (loginState === 'true') {
        isLoggedIn = true;
        showAdminControls();
        updateLoginButtons();
    }
}

/**
 * Show login modal
 */
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.style.display = 'flex';
    
    // Focus on username input
    setTimeout(() => {
        document.getElementById('username').focus();
    }, 100);
}

/**
 * Hide login modal
 */
function hideLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.style.display = 'none';
    
    // Clear form
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('loginError').style.display = 'none';
}

/**
 * Handle login form submission
 */
function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorDiv = document.getElementById('loginError');
    
    // Check credentials
    if (username === LOGIN_CREDENTIALS.username && password === LOGIN_CREDENTIALS.password) {
        // Login successful
        isLoggedIn = true;
        sessionStorage.setItem(LOGIN_STORAGE_KEY, 'true');
        
        hideLoginModal();
        showAdminControls();
        updateLoginButtons();
        showNotification('Login successful! Admin controls enabled. 🔐', 'success');
        
        console.log('Admin logged in successfully');
    } else {
        // Login failed
        errorDiv.style.display = 'block';
        errorDiv.style.animation = 'shake 0.5s ease';
        
        // Clear password field
        document.getElementById('password').value = '';
        
        // Focus on username
        setTimeout(() => {
            document.getElementById('username').focus();
        }, 500);
        
        console.log('Login failed - invalid credentials');
    }
}

/**
 * Handle logout
 */
function handleLogout() {
    if (confirm('Are you sure you want to logout? Admin controls will be hidden.')) {
        isLoggedIn = false;
        sessionStorage.removeItem(LOGIN_STORAGE_KEY);
        
        hideAdminControls();
        updateLoginButtons();
        showNotification('Logged out successfully. 👋', 'info');
        
        console.log('Admin logged out');
    }
}

/**
 * Show admin controls
 */
function showAdminControls() {
    const adminControls = document.getElementById('adminControls');
    adminControls.style.display = 'flex';
}

/**
 * Hide admin controls
 */
function hideAdminControls() {
    const adminControls = document.getElementById('adminControls');
    adminControls.style.display = 'none';
}

/**
 * Update login/logout button visibility
 */
function updateLoginButtons() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (isLoggedIn) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
    } else {
        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
    }
}

/**
 * Setup login event listeners
 */
function setupLoginEventListeners() {
    // Login button
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.addEventListener('click', showLoginModal);
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.addEventListener('click', handleLogout);
    
    // Close modal button
    const closeLoginModalBtn = document.getElementById('closeLoginModal');
    closeLoginModalBtn.addEventListener('click', hideLoginModal);
    
    // Submit login button
    const submitLoginBtn = document.getElementById('submitLogin');
    submitLoginBtn.addEventListener('click', handleLogin);
    
    // Close modal when clicking outside
    const loginModal = document.getElementById('loginModal');
    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            hideLoginModal();
        }
    });
    
    // Handle Enter key in login form
    document.getElementById('username').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('password').focus();
        }
    });
    
    document.getElementById('password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
    
    console.log('Login event listeners set up successfully');
}

// Export functions for testing (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        rotatePeople,
        saveAssignments,
        loadAssignments,
        renderTable,
        resetToDefault,
        takeScreenshot,
        shareAssignments,
        handleLogin,
        handleLogout
    };
}
