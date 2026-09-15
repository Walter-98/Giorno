self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window'}).then(windows=>{const current=windows.find(w=>w.url.startsWith(self.registration.scope));return current?current.focus():self.clients.openWindow(self.registration.scope);}));});
