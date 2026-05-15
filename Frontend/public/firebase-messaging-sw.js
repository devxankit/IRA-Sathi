// Import Firebase scripts from CDN for the service worker
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// Note: These values are hardcoded here because the service worker doesn't have access to Vite env variables.
firebase.initializeApp({
    apiKey: "AIzaSyDIbMc3E4EIfz2eqR5Jn_dd-jdU_cPJbPY",
    authDomain: "ira-sathi-vendor-docs.firebaseapp.com",
    projectId: "ira-sathi-vendor-docs",
    storageBucket: "ira-sathi-vendor-docs.firebasestorage.app",
    messagingSenderId: "290872014066",
    appId: "1:290872014066:web:39f9ab1553c0ec3d5e4c6b"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon || '/favicon.png', // Fallback icon
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click to navigate
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data;
    const urlToOpen = data?.link || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if the app is already open
            for (const client of clientList) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
