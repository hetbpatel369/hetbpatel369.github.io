
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
    
    // Clear any existing timeout
    if (window.notificationTimeout) {
        clearTimeout(window.notificationTimeout);
    }
    
    // Set the message
    notificationText.textContent = message;
    
    // Set the color based on type
    notification.style.backgroundColor = type === 'error' ? '#f44336' : 
                                       type === 'info' ? '#2196f3' : 
                                       '#4caf50';
    
    // Show the notification
    notification.style.display = 'flex';
    
    // Auto-hide after 3 seconds (store timeout ID)
    window.notificationTimeout = setTimeout(() => {
        notification.style.display = 'none';
        window.notificationTimeout = null;
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
 * Saves the current assignments to browser's localStorage and syncs to cloud
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
        
        // Mark that we have pending changes
        syncState.pendingChanges = true;
        
        // Push to JSONBin for global sync (with small delay to prevent conflicts)
        if (syncState.jsonbinConnected) {
            setTimeout(() => {
                pushToJsonBin();
            }, 100); // Small delay to prevent rapid conflicts
        } else if (syncState.firebaseConnected) {
            // Fallback to Firebase if available
            setTimeout(() => {
                pushToFirebase();
            }, 100);
        } else {
            // Save to backup if no sync available
            saveToBackup();
        }
        
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

/**
 * Show share modal with URL
 */
function showShareModal() {
    const modal = document.getElementById('shareModal');
    const shareUrl = document.getElementById('shareUrl');
    
    const roomId = getOrCreateRoomId();
    const shareUrlValue = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    
    shareUrl.value = shareUrlValue;
    modal.style.display = 'flex';
}

/**
 * Hide share modal
 */
function hideShareModal() {
    const modal = document.getElementById('shareModal');
    modal.style.display = 'none';
}

/**
 * Copy share URL to clipboard
 */
async function copyShareUrl() {
    const shareUrl = document.getElementById('shareUrl');
    
    try {
        await navigator.clipboard.writeText(shareUrl.value);
        showNotification('URL copied to clipboard! 📋', 'success');
    } catch (error) {
        console.error('Copy to clipboard failed:', error);
        shareUrl.select();
        shareUrl.setSelectionRange(0, 99999);
        
        try {
            document.execCommand('copy');
            showNotification('URL copied to clipboard! 📋', 'success');
        } catch (fallbackError) {
            console.error('Fallback copy failed:', fallbackError);
            showNotification('Copy failed. Please copy manually.', 'error');
        }
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
    
    // Share Link button - global sync sharing
    const linkBtn = document.getElementById('linkBtn');
    linkBtn.addEventListener('click', showShareModal);
    
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
    
    // Share Modal event listeners
    const closeShareModalBtn = document.getElementById('closeShareModal');
    closeShareModalBtn.addEventListener('click', hideShareModal);
    
    const copyShareUrlBtn = document.getElementById('copyShareUrlBtn');
    copyShareUrlBtn.addEventListener('click', copyShareUrl);
    
    // Close Share modal when clicking outside
    const shareModal = document.getElementById('shareModal');
    shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) {
            hideShareModal();
        }
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
        
        // Escape key to close modals
        if (event.key === 'Escape') {
            hideQRCodeModal();
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
        
        // Check for room parameter in URL
        checkForRoomParameter();
        
        // Initialize global sync system
        initializeGlobalSync();
        
        // Initialize debug panel for mobile devices
        initializeDebugPanel();
        
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

// Force sync function for testing
window.forceSync = forceSync;

// ============================================================================
// GLOBAL SYNCHRONIZATION SYSTEM
// ============================================================================

// Global sync configuration - JSONBin as primary server
const SYNC_CONFIG = {
    jsonbinEnabled: true,         // JSONBin as primary sync
    firebaseEnabled: false,       // Disable Firebase completely
    gistBackupEnabled: false,     // Disable backup (JSONBin is primary)
    syncInterval: 3000,           // 3 seconds - faster sync
    conflictResolution: 'server_wins', // 'server_wins', 'client_wins', 'merge'
    maxRetries: 3,
    jsonbinBinId: '68e158bd43b1c97be95a581f' // Updated with your new bin ID
};

// Sync state variables
let syncState = {
    isOnline: navigator.onLine,
    jsonbinConnected: false,
    firebaseConnected: false,
    lastSyncTime: null,
    pendingChanges: false,
    conflictDetected: false,
    retryCount: 0,
    jsonbinInterval: null
};

// GitHub Gist backup configuration (for offline scenarios)
const GIST_CONFIG = {
    username: 'seva-backup', // You can change this
    token: '', // Leave empty for public gists
    gistId: null // Will be created automatically
};

/**
 * Initialize global sync system
 */
function initializeGlobalSync() {
    console.log('Initializing global sync system...');
    
    // Set up online/offline detection
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    
    // Initialize JSONBin as primary sync
    if (SYNC_CONFIG.jsonbinEnabled) {
        initializeJsonBinSync();
    }
    
    // Firebase sync disabled - using JSONBin only
    // if (SYNC_CONFIG.firebaseEnabled && window.firebaseDatabase) {
    //     initializeFirebaseSync();
    // }
    
    // Gist backup disabled - using JSONBin only
    // if (SYNC_CONFIG.gistBackupEnabled) {
    //     initializeGistBackup();
    // }
    
    // Start sync monitoring
    startSyncMonitoring();
    
    // Update sync status display
    updateSyncStatusDisplay();
    
    console.log('Global sync system initialized');
}

/**
 * Initialize Firebase real-time sync
 */
function initializeFirebaseSync() {
    try {
        if (!window.firebaseDatabase) {
            console.warn('Firebase not available, using local storage only');
            return;
        }
        
        const db = window.firebaseDatabase;
        const ref = window.firebaseRef;
        const onValue = window.firebaseOnValue;
        const set = window.firebaseSet;
        
        // Create a unique room ID for this seva group
        const roomId = getOrCreateRoomId();
        const sevaRef = ref(db, `seva-rooms/${roomId}`);
        
        // Listen for real-time updates
        onValue(sevaRef, (snapshot) => {
            const data = snapshot.val();
            console.log('🔥 Firebase data received:', data);
            if (data && data.assignments) {
                console.log('📥 Processing remote update...');
                handleRemoteUpdate(data);
            } else {
                console.log('⚠️ No valid data in snapshot');
            }
        }, (error) => {
            console.error('❌ Firebase sync error:', error);
            syncState.firebaseConnected = false;
            updateSyncStatusDisplay();
        });
        
        // Mark as connected
        syncState.firebaseConnected = true;
        updateSyncStatusDisplay();
        
        console.log('Firebase sync initialized for room:', roomId);
        
    } catch (error) {
        console.error('Error initializing Firebase sync:', error);
        syncState.firebaseConnected = false;
        updateSyncStatusDisplay();
    }
}

/**
 * Get or create a unique room ID for this seva group
 */
function getOrCreateRoomId() {
    let roomId = localStorage.getItem('sevaRoomId');
    if (!roomId) {
        // Create a consistent room ID based on the main URL (without parameters)
        // This ensures all users of the same seva group get the same room ID
        const baseUrl = window.location.origin + window.location.pathname;
        const urlHash = btoa(baseUrl).substring(0, 8);
        roomId = `seva-${urlHash}`;
        localStorage.setItem('sevaRoomId', roomId);
        console.log('Created new room ID:', roomId, 'for base URL:', baseUrl);
    }
    return roomId;
}

/**
 * Handle updates from remote devices
 */
function handleRemoteUpdate(remoteData) {
    try {
        const remoteTimestamp = new Date(remoteData.timestamp).getTime();
        const localTimestamp = new Date(localStorage.getItem(LAST_UPDATED_KEY) || 0).getTime();
        const timeDiff = remoteTimestamp - localTimestamp;
        
        console.log('Remote update received:', {
            remoteTime: remoteData.timestamp,
            localTime: localStorage.getItem(LAST_UPDATED_KEY),
            timeDiff: timeDiff,
            remoteModifiedBy: remoteData.lastModifiedBy,
            localViewerId: viewerId,
            pendingChanges: syncState.pendingChanges
        });
        
        // If this is our own update echoed back (within 500ms and same viewer), skip it
        if (remoteData.lastModifiedBy === viewerId && Math.abs(timeDiff) < 500) {
            console.log('⏭️ Skipping own update echo');
            syncState.pendingChanges = false;
            return;
        }
        
        // Only check for conflicts if we have very recent pending changes (within 2 seconds)
        const timeSinceLastChange = Date.now() - (localTimestamp || 0);
        if (syncState.pendingChanges && timeSinceLastChange < 2000 && remoteTimestamp > localTimestamp) {
            console.log('⚠️ Potential conflict detected, but allowing remote update');
            // For seva app, we'll be more permissive - use remote data if it's newer
        }
        
        // Update local data if remote is newer OR if we don't have local data
        if (remoteTimestamp > localTimestamp || !localTimestamp) {
            console.log('✅ Updating local data with remote data');
            console.log('Remote assignments:', remoteData.assignments);
            
            currentAssignments = remoteData.assignments || [];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteData));
            localStorage.setItem(LAST_UPDATED_KEY, remoteData.timestamp);
            
            renderTable();
            updateLastUpdatedTime();
            
            // Only show notification if this is from a different device
            if (remoteData.lastModifiedBy !== viewerId) {
                showNotification('Data updated from another device! 🔄', 'info');
            }
            
            syncState.lastSyncTime = new Date();
            syncState.pendingChanges = false; // Clear pending changes
            updateSyncStatusDisplay();
            
            console.log('✅ Local data updated successfully');
        } else {
            console.log('⏭️ Remote data is older or same, keeping local data');
        }
        
    } catch (error) {
        console.error('Error handling remote update:', error);
    }
}

/**
 * Handle sync conflicts when multiple devices edit simultaneously
 */
function handleSyncConflict(remoteData) {
    console.log('Sync conflict detected');
    syncState.conflictDetected = true;
    
    if (SYNC_CONFIG.conflictResolution === 'server_wins') {
        // Use remote data
        currentAssignments = remoteData.assignments || [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteData));
        localStorage.setItem(LAST_UPDATED_KEY, remoteData.timestamp);
        renderTable();
        showNotification('Conflict resolved: Using data from other device', 'info');
    } else if (SYNC_CONFIG.conflictResolution === 'client_wins') {
        // Keep local data and push to server
        pushToFirebase();
        showNotification('Conflict resolved: Your changes were kept', 'info');
    } else {
        // Show conflict resolution dialog
        showConflictResolutionDialog(remoteData);
    }
    
    syncState.pendingChanges = false;
    syncState.conflictDetected = false;
}

/**
 * Show conflict resolution dialog
 */
function showConflictResolutionDialog(remoteData) {
    const message = `Conflict detected! Another device made changes at ${remoteData.timestamp}.\n\nChoose how to resolve:`;
    const choice = confirm(message + '\n\nOK = Use their changes\nCancel = Keep your changes');
    
    if (choice) {
        // Use remote data
        currentAssignments = remoteData.assignments || [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteData));
        localStorage.setItem(LAST_UPDATED_KEY, remoteData.timestamp);
        renderTable();
        showNotification('Using changes from other device', 'info');
    } else {
        // Keep local data and push to server
        pushToFirebase();
        showNotification('Keeping your changes', 'info');
    }
}

/**
 * Push current data to Firebase
 */
function pushToFirebase() {
    if (!window.firebaseDatabase || !syncState.firebaseConnected) {
        console.warn('Firebase not available for push');
        return;
    }
    
    try {
        const db = window.firebaseDatabase;
        const ref = window.firebaseRef;
        const set = window.firebaseSet;
        const serverTimestamp = window.firebaseServerTimestamp;
        
        const roomId = getOrCreateRoomId();
        const sevaRef = ref(db, `seva-rooms/${roomId}`);
        
        const dataToPush = {
            assignments: currentAssignments,
            timestamp: new Date().toISOString(),
            lastModifiedBy: viewerId,
            version: Date.now()
        };
        
        console.log('📤 Pushing data to Firebase:', dataToPush);
        
        set(sevaRef, dataToPush).then(() => {
            console.log('✅ Data pushed to Firebase successfully');
            syncState.lastSyncTime = new Date();
            syncState.pendingChanges = false;
            updateSyncStatusDisplay();
        }).catch((error) => {
            console.error('❌ Error pushing to Firebase:', error);
            syncState.firebaseConnected = false;
            updateSyncStatusDisplay();
        });
        
    } catch (error) {
        console.error('Error in pushToFirebase:', error);
    }
}

/**
 * Initialize JSONBin as primary sync server
 */
async function initializeJsonBinSync() {
    console.log('🔄 JSONBin primary sync system initialized');
    
    // Try to create or load JSONBin bin
    await createOrLoadJsonBin();
    
    // Start periodic sync
    startJsonBinSync();
    
    syncState.jsonbinConnected = true;
    updateSyncStatusDisplay();
}

/**
 * Create a new JSONBin bin or load existing one
 */
async function createOrLoadJsonBin() {
    try {
        // First, try to load from the configured bin ID
        const response = await fetch(`https://api.jsonbin.io/v3/b/${SYNC_CONFIG.jsonbinBinId}/latest`, {
            headers: {
                'X-Master-Key': '$2a$10$tW3uHqmmzJcDG2p6Ra6EwOxIEX7FSt2eVgzysmkbfUgXI1crQMMD6'
            }
        });
        
        if (response.ok) {
            console.log('✅ JSONBin bin exists, loading data...');
            const result = await response.json();
            const remoteData = result.record;
            
            if (remoteData && remoteData.assignments) {
                console.log('📥 Loading data from existing JSONBin:', remoteData);
                handleRemoteUpdate(remoteData);
            }
        } else if (response.status === 404) {
            console.log('📦 JSONBin bin not found, creating new one...');
            await createNewJsonBin();
        }
    } catch (error) {
        console.error('Error checking JSONBin:', error);
        console.log('📦 Creating new JSONBin bin...');
        await createNewJsonBin();
    }
}

/**
 * Create a new JSONBin bin with default data
 */
async function createNewJsonBin() {
    try {
        const defaultData = {
            assignments: currentAssignments,
            timestamp: new Date().toISOString(),
            lastModifiedBy: viewerId || 'system',
            version: Date.now()
        };
        
        console.log('📤 Creating new JSONBin bin with data:', defaultData);
        
        const response = await fetch('https://api.jsonbin.io/v3/b', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': '$2a$10$tW3uHqmmzJcDG2p6Ra6EwOxIEX7FSt2eVgzysmkbfUgXI1crQMMD6',
                'X-Bin-Name': 'Seva App Data'
            },
            body: JSON.stringify(defaultData)
        });
        
        if (response.ok) {
            const result = await response.json();
            const newBinId = result.metadata.id;
            
            // Update the configuration with the new bin ID
            SYNC_CONFIG.jsonbinBinId = newBinId;
            console.log('✅ New JSONBin bin created:', newBinId);
            console.log('🔄 Update your code with this bin ID:', newBinId);
            
            // Store the bin ID locally for this session
            localStorage.setItem('jsonbinBinId', newBinId);
            
        } else {
            console.error('❌ Failed to create JSONBin bin:', response.status);
            syncState.jsonbinConnected = false;
        }
    } catch (error) {
        console.error('Error creating JSONBin bin:', error);
        syncState.jsonbinConnected = false;
    }
}

/**
 * Start periodic JSONBin sync
 */
function startJsonBinSync() {
    // Check for updates every 3 seconds
    syncState.jsonbinInterval = setInterval(async () => {
        await checkForJsonBinUpdates();
    }, SYNC_CONFIG.syncInterval);
    
    console.log('JSONBin periodic sync started');
}

/**
 * Check for updates from JSONBin
 */
async function checkForJsonBinUpdates() {
    try {
        // Use the current bin ID (might be updated dynamically)
        const binId = SYNC_CONFIG.jsonbinBinId || localStorage.getItem('jsonbinBinId');
        if (!binId) {
            console.warn('No JSONBin bin ID available');
            return;
        }
        
        const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
            headers: {
                'X-Master-Key': '$2a$10$tW3uHqmmzJcDG2p6Ra6EwOxIEX7FSt2eVgzysmkbfUgXI1crQMMD6'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            const remoteData = result.record;
            
            if (remoteData && remoteData.assignments) {
                handleRemoteUpdate(remoteData);
            }
        } else if (response.status === 404) {
            console.log('JSONBin bin not found, attempting to create new one...');
            await createNewJsonBin();
        }
    } catch (error) {
        console.error('Error checking JSONBin updates:', error);
        syncState.jsonbinConnected = false;
        updateSyncStatusDisplay();
    }
}

/**
 * Initialize backup sync using JSONBin.io (free public API) - now disabled
 */
function initializeGistBackup() {
    console.log('Backup sync system disabled (JSONBin is primary)');
}

/**
 * Push data to JSONBin (primary sync)
 */
async function pushToJsonBin() {
    try {
        // Use the current bin ID (might be updated dynamically)
        const binId = SYNC_CONFIG.jsonbinBinId || localStorage.getItem('jsonbinBinId');
        if (!binId) {
            console.warn('No JSONBin bin ID available, creating new bin...');
            await createNewJsonBin();
            return;
        }
        
        const dataToPush = {
            assignments: currentAssignments,
            timestamp: new Date().toISOString(),
            lastModifiedBy: viewerId,
            version: Date.now()
        };
        
        console.log('📤 Pushing data to JSONBin:', dataToPush);
        
        const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': '$2a$10$tW3uHqmmzJcDG2p6Ra6EwOxIEX7FSt2eVgzysmkbfUgXI1crQMMD6'
            },
            body: JSON.stringify(dataToPush)
        });
        
        if (response.ok) {
            console.log('✅ Data pushed to JSONBin successfully');
            syncState.lastSyncTime = new Date();
            syncState.pendingChanges = false;
            updateSyncStatusDisplay();
        } else if (response.status === 404) {
            console.log('JSONBin bin not found, creating new one...');
            await createNewJsonBin();
        } else {
            console.error('❌ Error pushing to JSONBin:', response.status);
            syncState.jsonbinConnected = false;
        }
    } catch (error) {
        console.error('Error in pushToJsonBin:', error);
        syncState.jsonbinConnected = false;
    }
}

/**
 * Load data from JSONBin
 */
async function loadFromJsonBin() {
    try {
        // Use the current bin ID (might be updated dynamically)
        const binId = SYNC_CONFIG.jsonbinBinId || localStorage.getItem('jsonbinBinId');
        if (!binId) {
            console.warn('No JSONBin bin ID available');
            return;
        }
        
        const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
            headers: {
                'X-Master-Key': '$2a$10$tW3uHqmmzJcDG2p6Ra6EwOxIEX7FSt2eVgzysmkbfUgXI1crQMMD6'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            const remoteData = result.record;
            
            if (remoteData && remoteData.assignments) {
                console.log('📥 Loading data from JSONBin:', remoteData);
                handleRemoteUpdate(remoteData);
            }
        }
    } catch (error) {
        console.error('Error loading from JSONBin:', error);
    }
}

/**
 * Save data to backup service (JSONBin.io) - now fallback only
 */
async function saveToBackup() {
    try {
        const roomId = getOrCreateRoomId();
        const backupData = {
            assignments: currentAssignments,
            timestamp: getCurrentTimestamp(),
            roomId: roomId,
            version: Date.now()
        };
        
        // Use JSONBin.io for backup (free public API)
        const response = await fetch('https://api.jsonbin.io/v3/b', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': '$2a$10$tW3uHqmmzJcDG2p6Ra6EwOxIEX7FSt2eVgzysmkbfUgXI1crQMMD6'
            },
            body: JSON.stringify(backupData)
        });
        
        if (response.ok) {
            const result = await response.json();
            localStorage.setItem('backupBinId', result.metadata.id);
            console.log('Data backed up successfully:', result.metadata.id);
            return result.metadata.id;
        } else {
            console.warn('Backup save failed:', response.status);
        }
    } catch (error) {
        console.error('Backup save error:', error);
    }
    return null;
}

/**
 * Load data from backup service
 */
async function loadFromBackup() {
    try {
        const backupBinId = localStorage.getItem('backupBinId');
        if (!backupBinId) return;
        
        const response = await fetch(`https://api.jsonbin.io/v3/b/${backupBinId}/latest`, {
            headers: {
                'X-Master-Key': '$2a$10$tW3uHqmmzJcDG2p6Ra6EwOxIEX7FSt2eVgzysmkbfUgXI1crQMMD6'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            const backupData = result.record;
            
            // Check if backup is newer than local data
            const backupTimestamp = new Date(backupData.timestamp).getTime();
            const localTimestamp = new Date(localStorage.getItem(LAST_UPDATED_KEY) || 0).getTime();
            
            if (backupTimestamp > localTimestamp) {
                currentAssignments = backupData.assignments || [];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(backupData));
                localStorage.setItem(LAST_UPDATED_KEY, backupData.timestamp);
                renderTable();
                updateLastUpdatedTime();
                showNotification('Data restored from backup! 💾', 'info');
                console.log('Data restored from backup');
            }
        }
    } catch (error) {
        console.error('Backup load error:', error);
    }
}

/**
 * Start sync monitoring
 */
function startSyncMonitoring() {
    setInterval(() => {
        if (syncState.isOnline && syncState.firebaseConnected) {
            // Check for updates
            checkForRemoteUpdates();
        } else {
            // Try to reconnect
            attemptReconnection();
        }
    }, SYNC_CONFIG.syncInterval);
}

/**
 * Check for remote updates
 */
function checkForRemoteUpdates() {
    // This is handled by Firebase real-time listeners
    // But we can also check last sync time
    if (syncState.lastSyncTime) {
        const timeSinceLastSync = Date.now() - syncState.lastSyncTime.getTime();
        if (timeSinceLastSync > SYNC_CONFIG.syncInterval * 2) {
            console.log('Long time since last sync, checking connection...');
            updateSyncStatusDisplay();
        }
    }
}

/**
 * Attempt to reconnect to sync services
 */
function attemptReconnection() {
    if (syncState.retryCount < SYNC_CONFIG.maxRetries) {
        syncState.retryCount++;
        console.log(`Attempting reconnection (${syncState.retryCount}/${SYNC_CONFIG.maxRetries})`);
        
        if (window.firebaseDatabase && !syncState.firebaseConnected) {
            initializeFirebaseSync();
        }
        
        setTimeout(() => {
            syncState.retryCount = 0;
        }, 30000); // Reset retry count after 30 seconds
    }
}

/**
 * Handle online/offline status changes
 */
function handleOnlineStatusChange() {
    syncState.isOnline = navigator.onLine;
    
    if (syncState.isOnline) {
        console.log('Device is online, attempting to sync...');
        if (window.firebaseDatabase) {
            initializeFirebaseSync();
        }
    } else {
        console.log('Device is offline, using local storage only');
        syncState.firebaseConnected = false;
    }
    
    updateSyncStatusDisplay();
}

/**
 * Update sync status display
 */
function updateSyncStatusDisplay() {
    const syncStatus = document.getElementById('syncStatus');
    const syncIndicator = document.getElementById('syncIndicator');
    const syncText = document.getElementById('syncText');
    
    if (!syncStatus) return;
    
    // Remove existing status classes
    syncStatus.classList.remove('connected', 'error', 'offline');
    
    if (!syncState.isOnline) {
        syncIndicator.textContent = '📡';
        syncText.textContent = 'Offline';
        syncStatus.classList.add('offline');
    } else if (syncState.jsonbinConnected) {
        syncIndicator.textContent = '✅';
        syncText.textContent = 'JSONBin Synced';
        syncStatus.classList.add('connected');
    } else if (syncState.firebaseConnected) {
        syncIndicator.textContent = '✅';
        syncText.textContent = 'Firebase Synced';
        syncStatus.classList.add('connected');
    } else if (syncState.conflictDetected) {
        syncIndicator.textContent = '⚠️';
        syncText.textContent = 'Conflict';
        syncStatus.classList.add('error');
    } else {
        syncIndicator.textContent = '🔄';
        syncText.textContent = 'Connecting to JSONBin...';
    }
}

// ============================================================================
// REAL-TIME SYNCHRONIZATION SYSTEM (LEGACY - KEPT FOR COMPATIBILITY)
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
 * Initialize viewer tracking using Firebase
 */
function initializeViewerTracking() {
    // Generate or get existing viewer ID
    viewerId = localStorage.getItem(VIEWER_ID_KEY);
    if (!viewerId) {
        viewerId = generateViewerId();
        localStorage.setItem(VIEWER_ID_KEY, viewerId);
    }
    
    // Initialize viewer count to 1 (will be updated by Firebase)
        viewerCount = 1;
    updateViewerCountDisplay();
    
    // Simple viewer count (since we're using JSONBin as primary)
    updateViewerCountDisplay();
    
    console.log('Viewer tracking initialized:', viewerId);
    console.log('Current room ID:', getOrCreateRoomId());
}

/**
 * Start real-time sync (now handled by Firebase)
 */
function startRealTimeSync() {
    // Check for updates every 5 seconds (only for backup sync)
    syncInterval = setInterval(() => {
        checkForUpdates();
    }, 5000);
    
    console.log('Real-time sync started (viewers tracked by Firebase)');
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
 * Track viewers using Firebase (real-time viewer count)
 */
function trackViewersWithFirebase() {
    if (!window.firebaseDatabase) {
        console.warn('Firebase not available for viewer tracking');
        return;
    }
    
    try {
        const db = window.firebaseDatabase;
        const ref = window.firebaseRef;
        const set = window.firebaseSet;
        const onValue = window.firebaseOnValue;
        const serverTimestamp = window.firebaseServerTimestamp;
        
        const roomId = getOrCreateRoomId();
        const viewersRef = ref(db, `viewers/${roomId}/${viewerId}`);
        
        // Set this viewer as online with timestamp
        set(viewersRef, {
            online: true,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent.substring(0, 100) // Truncated for privacy
        });
        
        // Listen for viewer count changes
        const viewerCountRef = ref(db, `viewers/${roomId}`);
        onValue(viewerCountRef, (snapshot) => {
            const viewers = snapshot.val();
            if (viewers) {
                // Count active viewers (online in last 30 seconds)
                const now = Date.now();
                const activeViewers = Object.values(viewers).filter(viewer => {
                    if (!viewer.online) return false;
                    const viewerTime = new Date(viewer.timestamp).getTime();
                    return (now - viewerTime) < 30000; // 30 seconds
                });
                
                viewerCount = activeViewers.length;
        updateViewerCountDisplay();
                
                console.log(`Viewer count updated: ${viewerCount} active viewers`);
            }
        });
        
        // Keep this viewer online (heartbeat every 15 seconds)
        const heartbeatInterval = setInterval(() => {
            set(viewersRef, {
                online: true,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent.substring(0, 100)
            });
        }, 15000);
        
        // Mark as offline when page unloads
        window.addEventListener('beforeunload', () => {
            set(viewersRef, {
                online: false,
                timestamp: new Date().toISOString()
            });
            clearInterval(heartbeatInterval);
        });
        
        // Also mark as offline when page becomes hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                set(viewersRef, {
                    online: false,
                    timestamp: new Date().toISOString()
                });
            } else {
                set(viewersRef, {
                    online: true,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent.substring(0, 100)
                });
            }
        });
        
        console.log('Firebase viewer tracking initialized');
        
    } catch (error) {
        console.error('Error initializing Firebase viewer tracking:', error);
    }
}

/**
 * Notify other users of changes (when admin makes updates)
 */
function notifyOtherUsers(action) {
    if (isLoggedIn) {
        // In a real app, this would send to server
        console.log(`Admin action: ${action} - notifying other users`);
        
        // Note: We don't need to push to Firebase here because saveAssignments() already does it
        // This prevents double-pushing which can cause sync conflicts
        
        showNotification(`Changes saved and synced to all users! 📡`, 'success');
    }
}

/**
 * Handle page visibility change (now handled by Firebase viewer tracking)
 */
function handleVisibilityChange() {
    // Visibility changes are now handled by trackViewersWithFirebase()
    // This function is kept for compatibility but does nothing
    console.log('Page visibility changed:', document.hidden ? 'hidden' : 'visible');
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

// ============================================================================
// QR CODE SHARING FUNCTIONALITY
// ============================================================================

/**
 * Show QR code modal for sharing with other devices
 */
function showQRCodeModal() {
    const modal = document.getElementById('qrModal');
    const qrCanvas = document.getElementById('qrCanvas');
    const qrUrl = document.getElementById('qrUrl');
    
    // Generate the current page URL with room ID
    const roomId = getOrCreateRoomId();
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    
    // Set the URL in the input field
    qrUrl.value = shareUrl;
    
    // Check if QRCode library is loaded, if not try to load it
    if (typeof QRCode === 'undefined') {
        console.log('QRCode library not found, attempting to load...');
        loadQRCodeLibrary().then(() => {
            generateQRCode(qrCanvas, shareUrl);
        }).catch(() => {
            showQRCodeFallback(qrCanvas);
        });
    } else {
        generateQRCode(qrCanvas, shareUrl);
    }
    
    // Show the modal
    modal.style.display = 'flex';
}

/**
 * Load QR Code library dynamically
 */
function loadQRCodeLibrary() {
    return new Promise((resolve, reject) => {
        if (typeof QRCode !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js';
        script.onload = () => {
            console.log('QRCode library loaded dynamically');
            resolve();
        };
        script.onerror = () => {
            console.error('Failed to load QRCode library dynamically');
            reject();
        };
        document.head.appendChild(script);
    });
}

/**
 * Generate QR code
 */
function generateQRCode(canvas, url) {
    // Clear previous QR code
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    
    // Generate new QR code
    QRCode.toCanvas(canvas, url, {
        width: 200,
        height: 200,
        color: {
            dark: '#242424',
            light: '#ffffff'
        },
        margin: 2
    }, (error) => {
        if (error) {
            console.error('QR Code generation error:', error);
            showQRCodeFallback(canvas);
        } else {
            console.log('QR Code generated successfully');
        }
    });
}

/**
 * Show QR code fallback
 */
function showQRCodeFallback(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('QR Code', canvas.width/2, canvas.height/2 - 10);
    ctx.fillText('Not Available', canvas.width/2, canvas.height/2 + 10);
    ctx.fillText('Use URL below', canvas.width/2, canvas.height/2 + 30);
    
    showNotification('QR Code library loading... Please use the URL below', 'info');
}

/**
 * Hide QR code modal
 */
function hideQRCodeModal() {
    const modal = document.getElementById('qrModal');
    modal.style.display = 'none';
}

/**
 * Copy QR URL to clipboard
 */
async function copyQRUrl() {
    const qrUrl = document.getElementById('qrUrl');
    
    try {
        await navigator.clipboard.writeText(qrUrl.value);
        showNotification('URL copied to clipboard! 📋', 'success');
    } catch (error) {
        console.error('Copy to clipboard failed:', error);
        
        // Fallback: select the text
        qrUrl.select();
        qrUrl.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            document.execCommand('copy');
            showNotification('URL copied to clipboard! 📋', 'success');
        } catch (fallbackError) {
            console.error('Fallback copy failed:', fallbackError);
            showNotification('Copy failed. Please copy manually.', 'error');
        }
    }
}

// ============================================================================
// URL PARAMETER HANDLING FOR ROOM SHARING
// ============================================================================

/**
 * Check for room parameter in URL and join the room
 */
function checkForRoomParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    
    if (roomParam) {
        console.log('Joining room:', roomParam);
        localStorage.setItem('sevaRoomId', roomParam);
        
        // Show notification
        showNotification(`Joined room: ${roomParam}`, 'info');
        
        // Clean up URL (remove room parameter)
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        // Initialize sync with the new room
        if (window.firebaseDatabase) {
            initializeFirebaseSync();
        }
    }
}

// ============================================================================
// ENHANCED SHARING WITH ROOM INFORMATION
// ============================================================================

/**
 * Enhanced share function that includes room information
 */
async function shareAssignmentsWithRoom() {
    try {
        const roomId = getOrCreateRoomId();
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        
        // Create a formatted text version of the assignments
        let shareText = "🏠 HOUSE CLEANING SEVA ASSIGNMENTS 🏠\n\n";
        shareText += "📅 " + getCurrentTimestamp() + "\n";
        shareText += "🔗 Join this room: " + shareUrl + "\n\n";
        
        for (let i = 0; i < SEVA_TASKS.length; i++) {
            const seva = SEVA_TASKS[i];
            const bhakto = currentAssignments[i] || [];
            shareText += `📍 ${seva}: ${bhakto.join(', ')}\n`;
        }
        
        shareText += "\n🙏 Let's complete it before Sunday!";
        shareText += "\n\n📱 Scan the QR code or use the link to sync across all devices!";
        
        // Try to use Web Share API if available (mobile browsers)
        if (navigator.share) {
            await navigator.share({
                title: 'Seva Assignments - Synced Room',
                text: shareText,
                url: shareUrl
            });
            showNotification('Shared successfully with room sync! 📤', 'success');
        } else {
            // Fallback: copy to clipboard
            await navigator.clipboard.writeText(shareText);
            showNotification('Assignments with room link copied to clipboard! 📋', 'success');
        }
        
    } catch (error) {
        console.error('Share with room error:', error);
        showNotification('Share failed! Try copying manually.', 'error');
    }
}

// ============================================================================
// DEBUG PANEL FOR MOBILE DEVICES
// ============================================================================

/**
 * Initialize debug panel for mobile devices
 */
function initializeDebugPanel() {
    // Only show debug panel if explicitly requested with ?debug=true
    const urlParams = new URLSearchParams(window.location.search);
    const isDebugMode = urlParams.get('debug') === 'true';
    
    if (isDebugMode) {
        const debugPanel = document.getElementById('debugPanel');
        if (debugPanel) {
            debugPanel.style.display = 'flex';
            setupDebugEventListeners();
            debugLog('🔍 Debug panel initialized');
        }
    }
}

/**
 * Setup debug panel event listeners
 */
function setupDebugEventListeners() {
    const closeDebugBtn = document.getElementById('closeDebug');
    const clearDebugBtn = document.getElementById('clearDebug');
    const testSyncBtn = document.getElementById('testSync');
    
    if (closeDebugBtn) {
        closeDebugBtn.addEventListener('click', () => {
            document.getElementById('debugPanel').style.display = 'none';
        });
    }
    
    if (clearDebugBtn) {
        clearDebugBtn.addEventListener('click', clearDebugLog);
    }
    
    if (testSyncBtn) {
        testSyncBtn.addEventListener('click', testSyncFunction);
    }
}

/**
 * Log message to debug panel
 */
function debugLog(message) {
    const debugLogElement = document.getElementById('debugLog');
    if (debugLogElement) {
        const timestamp = new Date().toLocaleTimeString();
        debugLogElement.textContent += `[${timestamp}] ${message}\n`;
        debugLogElement.scrollTop = debugLogElement.scrollHeight;
    }
    
    // Also log to console
    console.log(message);
}

/**
 * Clear debug log
 */
function clearDebugLog() {
    const debugLogElement = document.getElementById('debugLog');
    if (debugLogElement) {
        debugLogElement.textContent = 'Debug log cleared...\n';
    }
}

/**
 * Test sync function
 */
function testSyncFunction() {
    debugLog('🧪 Testing sync function...');
    
    if (syncState.firebaseConnected) {
        debugLog('✅ Firebase connected');
        debugLog(`📊 Current assignments: ${JSON.stringify(currentAssignments)}`);
        pushToFirebase();
        debugLog('📤 Data pushed to Firebase');
    } else {
        debugLog('❌ Firebase not connected');
        debugLog('🔄 Attempting to reconnect...');
        initializeFirebaseSync();
    }
    
    debugLog(`🔄 Sync state: ${JSON.stringify({
        isOnline: syncState.isOnline,
        firebaseConnected: syncState.firebaseConnected,
        pendingChanges: syncState.pendingChanges,
        roomId: getOrCreateRoomId()
    })}`);
}

/**
 * Force sync - useful for testing
 */
function forceSync() {
    console.log('🔄 Force sync triggered');
    if (syncState.firebaseConnected) {
        pushToFirebase();
    } else {
        console.log('❌ Firebase not connected, cannot force sync');
    }
}

/**
 * Reset room ID - useful for debugging room issues
 */
function resetRoomId() {
    const oldRoomId = localStorage.getItem('sevaRoomId');
    localStorage.removeItem('sevaRoomId');
    const newRoomId = getOrCreateRoomId();
    console.log('🔄 Room ID reset:', oldRoomId, '→', newRoomId);
    
    // Reinitialize Firebase sync with new room
    if (window.firebaseDatabase) {
        initializeFirebaseSync();
        trackViewersWithFirebase();
    }
    
    showNotification('Room ID reset - you are now in a new room', 'info');
}

/**
 * Clear all cached data and force fresh start - use after clearing Firebase
 */
function clearAllCacheAndReset() {
    console.log('🗑️ Clearing all cached data...');
    
    // Clear room ID
    localStorage.removeItem('sevaRoomId');
    console.log('✅ Room ID cleared');
    
    // Clear viewer ID (optional - creates new viewer)
    localStorage.removeItem('sevaAppViewerId');
    console.log('✅ Viewer ID cleared');
    
    // Clear old viewer count
    localStorage.removeItem('sevaAppViewerCount');
    console.log('✅ Viewer count cleared');
    
    // Get new room ID
    const newRoomId = getOrCreateRoomId();
    console.log('🆕 New room ID:', newRoomId);
    
    // Reinitialize everything
    if (window.firebaseDatabase) {
        initializeFirebaseSync();
        trackViewersWithFirebase();
    }
    
    showNotification('All cache cleared - fresh start! 🆕', 'success');
}

// Override console.log to also log to debug panel
const originalConsoleLog = console.log;
console.log = function(...args) {
    originalConsoleLog.apply(console, args);
    
    // Also log to debug panel if it exists
    const debugLogElement = document.getElementById('debugLog');
    if (debugLogElement && debugLogElement.parentElement.style.display !== 'none') {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        debugLog(message);
    }
};

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
        shareAssignmentsWithRoom,
        handleLogin,
        handleLogout,
        showQRCodeModal,
        hideQRCodeModal,
        copyQRUrl,
        initializeGlobalSync,
        pushToFirebase,
        debugLog,
        testSyncFunction
    };
}
//Force git push