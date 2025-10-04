/*
 * Seva Rotation App - Production Version
 * 
 * A web application for managing seva (service) task rotations
 * with real-time synchronization across multiple devices.
 * 
 * Features:
 * - Task rotation management
 * - Real-time sync via Firebase
 * - Admin login system
 * - Screenshot functionality
 * - Cross-device sharing
 */

// ============================================================================
// CONFIGURATION AND DATA
// ============================================================================

// Seva tasks and their capacities
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

const TASK_CAPACITIES = [3, 3, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1];

// Default assignments
const DEFAULT_ASSIGNMENTS = [
    ["Het Bhai", "Harsh Bhai", "Avi Bhai"],
    ["Devang Bhai", "Kintul Bhai", "Shreyansh Bhai"],
    ["Rohan Bhai"],
    ["Malav Bhai & Param Bhai"],
    ["Jayraj Bhai"],
    ["Vraj Bhai", "Nisarg Bhai"],
    ["Sheel Bhai"],
    ["Hardik Bhai"],
    ["Heet Bhai", "Pratik Bhai"],
    ["Bhumin Bhai"],
    ["Bhagirath Bhai", "Mann Bhai"],
    ["Volunteer"]
];

// Storage keys
const STORAGE_KEY = 'sevaAppData';
const LAST_UPDATED_KEY = 'sevaAppLastUpdated';
const VIEWER_COUNT_KEY = 'sevaAppViewerCount';
const VIEWER_ID_KEY = 'sevaAppViewerId';
const LOGIN_STORAGE_KEY = 'sevaAppLoginState';

// Login credentials
const LOGIN_CREDENTIALS = {
    username: 'admin',
    password: 'seva2024'
};

// Global variables
let currentAssignments = [];
let viewerCount = 1;
let viewerId = null;
let isLoggedIn = false;
let syncState = {
    isOnline: navigator.onLine,
    firebaseConnected: false,
    lastSyncTime: null,
    pendingChanges: false,
    conflictDetected: false,
    retryCount: 0
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    if (window.notificationTimeout) {
        clearTimeout(window.notificationTimeout);
    }
    
    notificationText.textContent = message;
    notification.style.backgroundColor = type === 'error' ? '#f44336' : 
                                       type === 'info' ? '#2196f3' : 
                                       '#4caf50';
    notification.style.display = 'flex';
    
    window.notificationTimeout = setTimeout(() => {
        notification.style.display = 'none';
        window.notificationTimeout = null;
    }, 3000);
}

function toggleLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
}

function getCurrentTimestamp() {
    return new Date().toLocaleString();
}

function updateLastUpdatedTime() {
    const lastUpdatedElement = document.getElementById('lastUpdated');
    lastUpdatedElement.textContent = getCurrentTimestamp();
}

// ============================================================================
// DATA PERSISTENCE
// ============================================================================

function saveAssignments() {
    try {
        const dataToSave = {
            assignments: currentAssignments,
            timestamp: getCurrentTimestamp()
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
        localStorage.setItem(LAST_UPDATED_KEY, getCurrentTimestamp());
        
        syncState.pendingChanges = true;
        
        if (syncState.firebaseConnected) {
            setTimeout(() => {
                pushToFirebase();
            }, 100);
        }
        
        updateLastUpdatedTime();
    } catch (error) {
        console.error('Error saving assignments:', error);
        showNotification('Error saving data!', 'error');
    }
}

function loadAssignments() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        
        if (savedData) {
            const data = JSON.parse(savedData);
            currentAssignments = data.assignments || [];
        } else {
            currentAssignments = JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS));
        }
        
        updateLastUpdatedTime();
    } catch (error) {
        console.error('Error loading assignments:', error);
        currentAssignments = JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS));
        showNotification('Error loading saved data, using defaults', 'error');
    }
}

// ============================================================================
// ROTATION LOGIC
// ============================================================================

function rotatePeople() {
    toggleLoading(true);
    
    try {
        let peopleToRotate = [];
        
        for (let i = 0; i < currentAssignments.length; i++) {
            const seva = SEVA_TASKS[i];
            const bhakto = currentAssignments[i];
            
            if (seva !== "Grocery" && seva !== "Yard") {
                peopleToRotate = peopleToRotate.concat(bhakto);
            } else if (seva === "Grocery") {
                for (let person of bhakto) {
                    if (person !== "Bhagirath Bhai") {
                        peopleToRotate.push(person);
                    }
                }
            }
        }
        
        if (peopleToRotate.length > 0) {
            const lastPerson = peopleToRotate.pop();
            peopleToRotate.unshift(lastPerson);
        }
        
        let personIndex = 0;
        
        for (let i = 0; i < currentAssignments.length; i++) {
            const seva = SEVA_TASKS[i];
            const capacity = TASK_CAPACITIES[i];
            const newGroup = [];
            
            switch (seva) {
                case "Yard":
                    newGroup.push("Volunteer");
                    break;
                case "Grocery":
                    newGroup.push("Bhagirath Bhai");
                    if (personIndex < peopleToRotate.length) {
                        newGroup.push(peopleToRotate[personIndex++]);
                    }
                    break;
                default:
                    for (let j = 0; j < capacity; j++) {
                        if (personIndex < peopleToRotate.length) {
                            newGroup.push(peopleToRotate[personIndex++]);
                        }
                    }
                    break;
            }
            
            currentAssignments[i] = newGroup;
        }
        
        saveAssignments();
        renderTable();
        notifyOtherUsers('rotation');
        showNotification('Assignments rotated successfully! 🔄');
        
    } catch (error) {
        console.error('Error during rotation:', error);
        showNotification('Error during rotation!', 'error');
    } finally {
        toggleLoading(false);
    }
}

// ============================================================================
// UI RENDERING
// ============================================================================

function renderTable() {
    const tableBody = document.getElementById('sevaTableBody');
    tableBody.innerHTML = '';
    
    for (let i = 0; i < SEVA_TASKS.length; i++) {
        const seva = SEVA_TASKS[i];
        const bhakto = currentAssignments[i] || [];
        
        const row = document.createElement('tr');
        
        const sevaCell = document.createElement('td');
        sevaCell.textContent = seva;
        sevaCell.className = 'seva-cell';
        
        const bhaktoCell = document.createElement('td');
        bhaktoCell.textContent = bhakto.join(', ');
        bhaktoCell.className = 'bhakto-cell';
        
        row.appendChild(sevaCell);
        row.appendChild(bhaktoCell);
        tableBody.appendChild(row);
    }
}

function resetToDefault() {
    if (confirm('Are you sure you want to reset to default assignments? This cannot be undone.')) {
        toggleLoading(true);
        
        try {
            currentAssignments = JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS));
            saveAssignments();
            renderTable();
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

function clearStorageAndReset() {
    if (confirm('Are you sure you want to clear all stored data and reset to defaults? This will remove all saved assignments and cannot be undone.')) {
        toggleLoading(true);
        
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(LAST_UPDATED_KEY);
            currentAssignments = JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS));
            saveAssignments();
            renderTable();
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
// SCREENSHOT FUNCTIONALITY
// ============================================================================

function takeScreenshot() {
    try {
        const controls = document.querySelector('.controls');
        const footer = document.querySelector('.footer');
        const notification = document.getElementById('notification');
        
        const originalControlsDisplay = controls.style.display;
        const originalFooterDisplay = footer.style.display;
        const originalNotificationDisplay = notification.style.display;
        
        controls.style.display = 'none';
        footer.style.display = 'none';
        notification.style.display = 'none';
        
        document.body.classList.add('screenshot-mode');
        
        captureWithCanvas();
        
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

function captureWithCanvas() {
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.top = '-9999px';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '1000px';
    tempContainer.style.backgroundColor = getComputedStyle(document.body).backgroundColor;
    tempContainer.style.fontFamily = getComputedStyle(document.body).fontFamily;
    tempContainer.style.color = getComputedStyle(document.body).color;
    
    const header = document.querySelector('.header').cloneNode(true);
    const tableContainer = document.querySelector('.table-container').cloneNode(true);
    const gujaratiText = document.querySelector('.gujarati-text').cloneNode(true);
    
    header.classList.add('screenshot-mode');
    tableContainer.classList.add('screenshot-mode');
    gujaratiText.classList.add('screenshot-mode');
    
    tempContainer.appendChild(header);
    tempContainer.appendChild(tableContainer);
    tempContainer.appendChild(gujaratiText);
    
    document.body.appendChild(tempContainer);
    
    if (typeof html2canvas !== 'undefined') {
        html2canvas(tempContainer, {
            backgroundColor: getComputedStyle(document.body).backgroundColor,
            scale: 2,
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
        fallbackCanvasMethod(tempContainer);
    }
}

function fallbackCanvasMethod(tempContainer) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 1000;
    canvas.height = 800;
    
    const bodyStyles = getComputedStyle(document.body);
    const titleStyles = getComputedStyle(document.querySelector('.main-title'));
    const subtitleStyles = getComputedStyle(document.querySelector('.sub-title'));
    const tableStyles = getComputedStyle(document.querySelector('.seva-table'));
    
    ctx.fillStyle = bodyStyles.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = titleStyles.color;
    ctx.font = `${titleStyles.fontWeight} ${titleStyles.fontSize} ${titleStyles.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('IT\'S HOUSE CLEANING SEVA TIME!', canvas.width / 2, 60);
    
    ctx.fillStyle = subtitleStyles.color;
    ctx.font = `${subtitleStyles.fontWeight} ${subtitleStyles.fontSize} ${subtitleStyles.fontFamily}`;
    ctx.fillText('LETS TRY TO COMPLETE IT BEFORE SUNDAY 🙏', canvas.width / 2, 90);
    
    const tableY = 150;
    const tableHeight = 400;
    const tableWidth = 900;
    const tableX = (canvas.width - tableWidth) / 2;
    
    ctx.fillStyle = tableStyles.backgroundColor;
    ctx.fillRect(tableX, tableY, tableWidth, tableHeight);
    
    ctx.strokeStyle = '#ff7e16';
    ctx.lineWidth = 2;
    ctx.strokeRect(tableX, tableY, tableWidth, tableHeight);
    
    ctx.fillStyle = '#ff7e16';
    ctx.fillRect(tableX, tableY, tableWidth, 40);
    
    ctx.fillStyle = '#242424';
    ctx.font = 'bold 16px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Seva', tableX + 20, tableY + 25);
    ctx.fillText('Bhakto', tableX + tableWidth/2 + 20, tableY + 25);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 14px Inter, Arial, sans-serif';
    
    let rowY = tableY + 60;
    const rowHeight = 30;
    
    for (let i = 0; i < SEVA_TASKS.length; i++) {
        const seva = SEVA_TASKS[i];
        const bhakto = currentAssignments[i] || [];
        
        ctx.strokeStyle = '#dddddd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tableX, rowY);
        ctx.lineTo(tableX + tableWidth, rowY);
        ctx.stroke();
        
        ctx.fillText(seva, tableX + 20, rowY - 8);
        ctx.fillText(bhakto.join(', '), tableX + tableWidth/2 + 20, rowY - 8);
        
        rowY += rowHeight;
    }
    
    const gujaratiStyles = getComputedStyle(document.querySelector('.gujarati-text'));
    ctx.fillStyle = gujaratiStyles.color;
    ctx.font = `${gujaratiStyles.fontWeight} ${gujaratiStyles.fontSize} ${gujaratiStyles.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('સેવા માં બની ગરજુ ન કરીએ ફરિયાદ મફત જે મળી મોજ તેને લૂટી લઈએ આજ', canvas.width / 2, 600);
    
    const link = document.createElement('a');
    link.download = `seva-assignments-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
    
    showNotification('Screenshot saved! 📸');
    document.body.removeChild(tempContainer);
}

// ============================================================================
// SHARING FUNCTIONALITY
// ============================================================================

async function shareAssignments() {
    try {
        let shareText = "🏠 HOUSE CLEANING SEVA ASSIGNMENTS 🏠\n\n";
        shareText += "📅 " + getCurrentTimestamp() + "\n\n";
        
        for (let i = 0; i < SEVA_TASKS.length; i++) {
            const seva = SEVA_TASKS[i];
            const bhakto = currentAssignments[i] || [];
            shareText += `📍 ${seva}: ${bhakto.join(', ')}\n`;
        }
        
        shareText += "\n🙏 Let's complete it before Sunday!";
        
        if (navigator.share) {
            await navigator.share({
                title: 'Seva Assignments',
                text: shareText
            });
            showNotification('Shared successfully! 📤');
        } else {
            await navigator.clipboard.writeText(shareText);
            showNotification('Assignments copied to clipboard! 📋');
        }
        
    } catch (error) {
        console.error('Share error:', error);
        showNotification('Share failed! Try copying manually.', 'error');
    }
}

function showShareModal() {
    const modal = document.getElementById('shareModal');
    const shareUrl = document.getElementById('shareUrl');
    
    const roomId = getOrCreateRoomId();
    const shareUrlValue = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    
    shareUrl.value = shareUrlValue;
    modal.style.display = 'flex';
}

function hideShareModal() {
    const modal = document.getElementById('shareModal');
    modal.style.display = 'none';
}

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
// FIREBASE SYNC SYSTEM
// ============================================================================

function getOrCreateRoomId() {
    let roomId = localStorage.getItem('sevaRoomId');
    if (!roomId) {
        const urlHash = btoa(window.location.href).substring(0, 8);
        const timestamp = Date.now().toString(36);
        roomId = `seva-${urlHash}-${timestamp}`;
        localStorage.setItem('sevaRoomId', roomId);
    }
    return roomId;
}

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
        
        const roomId = getOrCreateRoomId();
        const sevaRef = ref(db, `seva-rooms/${roomId}`);
        
        onValue(sevaRef, (snapshot) => {
            const data = snapshot.val();
            if (data && data.assignments) {
                handleRemoteUpdate(data);
            }
        }, (error) => {
            console.error('Firebase sync error:', error);
            syncState.firebaseConnected = false;
            updateSyncStatusDisplay();
        });
        
        syncState.firebaseConnected = true;
        updateSyncStatusDisplay();
        
    } catch (error) {
        console.error('Error initializing Firebase sync:', error);
        syncState.firebaseConnected = false;
        updateSyncStatusDisplay();
    }
}

function handleRemoteUpdate(remoteData) {
    try {
        const remoteTimestamp = new Date(remoteData.timestamp).getTime();
        const localTimestamp = new Date(localStorage.getItem(LAST_UPDATED_KEY) || 0).getTime();
        
        if (remoteTimestamp > localTimestamp || !localTimestamp) {
            currentAssignments = remoteData.assignments || [];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteData));
            localStorage.setItem(LAST_UPDATED_KEY, remoteData.timestamp);
            
            renderTable();
            updateLastUpdatedTime();
            
            if (isLoggedIn) {
                showNotification('Data updated from another device! 🔄', 'info');
            }
            
            syncState.lastSyncTime = new Date();
            syncState.pendingChanges = false;
            updateSyncStatusDisplay();
        }
        
    } catch (error) {
        console.error('Error handling remote update:', error);
    }
}

function pushToFirebase() {
    if (!window.firebaseDatabase || !syncState.firebaseConnected) {
        return;
    }
    
    try {
        const db = window.firebaseDatabase;
        const ref = window.firebaseRef;
        const set = window.firebaseSet;
        
        const roomId = getOrCreateRoomId();
        const sevaRef = ref(db, `seva-rooms/${roomId}`);
        
        const dataToPush = {
            assignments: currentAssignments,
            timestamp: new Date().toISOString(),
            lastModifiedBy: viewerId,
            version: Date.now()
        };
        
        set(sevaRef, dataToPush).then(() => {
            syncState.lastSyncTime = new Date();
            syncState.pendingChanges = false;
            updateSyncStatusDisplay();
        }).catch((error) => {
            console.error('Error pushing to Firebase:', error);
            syncState.firebaseConnected = false;
            updateSyncStatusDisplay();
        });
        
    } catch (error) {
        console.error('Error in pushToFirebase:', error);
    }
}

function updateSyncStatusDisplay() {
    const syncStatus = document.getElementById('syncStatus');
    const syncIndicator = document.getElementById('syncIndicator');
    const syncText = document.getElementById('syncText');
    
    if (!syncStatus) return;
    
    syncStatus.classList.remove('connected', 'error', 'offline');
    
    if (!syncState.isOnline) {
        syncIndicator.textContent = '📡';
        syncText.textContent = 'Offline';
        syncStatus.classList.add('offline');
    } else if (syncState.firebaseConnected) {
        syncIndicator.textContent = '✅';
        syncText.textContent = 'Synced';
        syncStatus.classList.add('connected');
    } else if (syncState.conflictDetected) {
        syncIndicator.textContent = '⚠️';
        syncText.textContent = 'Conflict';
        syncStatus.classList.add('error');
    } else {
        syncIndicator.textContent = '🔄';
        syncText.textContent = 'Connecting...';
    }
}

function notifyOtherUsers(action) {
    if (isLoggedIn) {
        const currentData = {
            assignments: currentAssignments,
            timestamp: getCurrentTimestamp(),
            lastAction: action,
            adminId: viewerId
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
        localStorage.setItem(LAST_UPDATED_KEY, getCurrentTimestamp());
        
        if (syncState.firebaseConnected) {
            pushToFirebase();
        }
        
        showNotification(`Changes saved and synced to all users! 📡`, 'success');
    }
}

// ============================================================================
// LOGIN SYSTEM
// ============================================================================

function checkLoginState() {
    const loginState = sessionStorage.getItem(LOGIN_STORAGE_KEY);
    if (loginState === 'true') {
        isLoggedIn = true;
        showAdminControls();
        updateLoginButtons();
    }
}

function showLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.style.display = 'flex';
    
    setTimeout(() => {
        document.getElementById('username').focus();
    }, 100);
}

function hideLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.style.display = 'none';
    
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('loginError').style.display = 'none';
}

function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorDiv = document.getElementById('loginError');
    
    if (username === LOGIN_CREDENTIALS.username && password === LOGIN_CREDENTIALS.password) {
        isLoggedIn = true;
        sessionStorage.setItem(LOGIN_STORAGE_KEY, 'true');
        
        hideLoginModal();
        showAdminControls();
        updateLoginButtons();
        showNotification('Login successful! Admin controls enabled. 🔐', 'success');
    } else {
        errorDiv.style.display = 'block';
        errorDiv.style.animation = 'shake 0.5s ease';
        
        document.getElementById('password').value = '';
        
        setTimeout(() => {
            document.getElementById('username').focus();
        }, 500);
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to logout? Admin controls will be hidden.')) {
        isLoggedIn = false;
        sessionStorage.removeItem(LOGIN_STORAGE_KEY);
        
        hideAdminControls();
        updateLoginButtons();
        showNotification('Logged out successfully. 👋', 'info');
    }
}

function showAdminControls() {
    const adminControls = document.getElementById('adminControls');
    adminControls.style.display = 'flex';
}

function hideAdminControls() {
    const adminControls = document.getElementById('adminControls');
    adminControls.style.display = 'none';
}

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

// ============================================================================
// VIEWER TRACKING
// ============================================================================

function generateViewerId() {
    return 'viewer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function updateViewerCountDisplay() {
    const viewerCountElement = document.getElementById('viewerCount');
    if (viewerCountElement) {
        viewerCountElement.textContent = viewerCount;
    }
}

function initializeViewerTracking() {
    viewerId = localStorage.getItem(VIEWER_ID_KEY);
    if (!viewerId) {
        viewerId = generateViewerId();
        localStorage.setItem(VIEWER_ID_KEY, viewerId);
    }
    
    const storedCount = localStorage.getItem(VIEWER_COUNT_KEY);
    if (storedCount) {
        viewerCount = parseInt(storedCount) + 1;
    } else {
        viewerCount = 1;
    }
    
    localStorage.setItem(VIEWER_COUNT_KEY, viewerCount.toString());
    updateViewerCountDisplay();
}

function startRealTimeSync() {
    setInterval(() => {
        if (syncState.isOnline && syncState.firebaseConnected) {
            // Check for updates
        } else {
            // Try to reconnect
            if (window.firebaseDatabase && !syncState.firebaseConnected) {
                initializeFirebaseSync();
            }
        }
    }, 5000);
}

function stopRealTimeSync() {
    const currentCount = parseInt(localStorage.getItem(VIEWER_COUNT_KEY) || '1');
    if (currentCount > 1) {
        localStorage.setItem(VIEWER_COUNT_KEY, (currentCount - 1).toString());
    }
}

function handleVisibilityChange() {
    if (document.hidden) {
        const currentCount = parseInt(localStorage.getItem(VIEWER_COUNT_KEY) || '1');
        if (currentCount > 1) {
            localStorage.setItem(VIEWER_COUNT_KEY, (currentCount - 1).toString());
        }
    } else {
        const currentCount = parseInt(localStorage.getItem(VIEWER_COUNT_KEY) || '1');
        localStorage.setItem(VIEWER_COUNT_KEY, (currentCount + 1).toString());
        updateViewerCountDisplay();
    }
}

// ============================================================================
// URL PARAMETER HANDLING
// ============================================================================

function checkForRoomParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    
    if (roomParam) {
        localStorage.setItem('sevaRoomId', roomParam);
        showNotification(`Joined room: ${roomParam}`, 'info');
        
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        if (window.firebaseDatabase) {
            initializeFirebaseSync();
        }
    }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
    // Main functionality buttons
    document.getElementById('rotateBtn').addEventListener('click', rotatePeople);
    document.getElementById('screenshotBtn').addEventListener('click', takeScreenshot);
    document.getElementById('shareBtn').addEventListener('click', shareAssignments);
    document.getElementById('linkBtn').addEventListener('click', showShareModal);
    document.getElementById('resetBtn').addEventListener('click', resetToDefault);
    document.getElementById('clearStorageBtn').addEventListener('click', clearStorageAndReset);
    
    // Login system
    document.getElementById('loginBtn').addEventListener('click', showLoginModal);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('closeLoginModal').addEventListener('click', hideLoginModal);
    document.getElementById('submitLogin').addEventListener('click', handleLogin);
    
    // Share modal
    document.getElementById('closeShareModal').addEventListener('click', hideShareModal);
    document.getElementById('copyShareUrlBtn').addEventListener('click', copyShareUrl);
    
    // Notifications
    document.getElementById('closeNotification').addEventListener('click', () => {
        document.getElementById('notification').style.display = 'none';
    });
    
    // Modal close on outside click
    document.getElementById('loginModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('loginModal')) {
            hideLoginModal();
        }
    });
    
    document.getElementById('shareModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('shareModal')) {
            hideShareModal();
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault();
            rotatePeople();
        }
        
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            takeScreenshot();
        }
        
        if (event.key === 'Escape') {
            hideShareModal();
            hideLoginModal();
        }
    });
    
    // Login form navigation
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
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeApp() {
    try {
        loadAssignments();
        renderTable();
        setupEventListeners();
        checkLoginState();
        initializeViewerTracking();
        startRealTimeSync();
        checkForRoomParameter();
        initializeFirebaseSync();
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', stopRealTimeSync);
        
        showNotification('Seva App loaded successfully! Welcome back! 🏠', 'info');
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Error loading app! Please refresh the page.', 'error');
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', initializeApp);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
