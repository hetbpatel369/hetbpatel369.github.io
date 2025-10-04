// QR Code Fix - Simple online service fallback
function generateQRCodeFallback(canvas, url) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Create a simple QR code using online service
    const qrImage = new Image();
    qrImage.crossOrigin = 'anonymous';
    qrImage.onload = () => {
        ctx.drawImage(qrImage, 0, 0, canvas.width, canvas.height);
        console.log('QR Code generated using online service');
    };
    qrImage.onerror = () => {
        // Show fallback message
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('QR Code', canvas.width/2, canvas.height/2 - 10);
        ctx.fillText('Not Available', canvas.width/2, canvas.height/2 + 10);
        ctx.fillText('Use URL below', canvas.width/2, canvas.height/2 + 30);
    };
    
    // Use a free QR code API service
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
}

// Override the showQRCodeModal function to use fallback
function showQRCodeModalFixed() {
    const modal = document.getElementById('qrModal');
    const qrCanvas = document.getElementById('qrCanvas');
    const qrUrl = document.getElementById('qrUrl');
    
    // Generate the current page URL with room ID
    const roomId = getOrCreateRoomId();
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    
    // Set the URL in the input field
    qrUrl.value = shareUrl;
    
    // Use online QR service as fallback
    generateQRCodeFallback(qrCanvas, shareUrl);
    
    // Show the modal
    modal.style.display = 'flex';
}

// Replace the original function
window.showQRCodeModal = showQRCodeModalFixed;
