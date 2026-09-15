self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window'}).then(windows=>{const current=windows.find(w=>w.url.startsWith(self.registration.scope));return current?current.focus():self.clients.openWindow(self.registration.scope);}));});
self.addEventListener('push',event=>{let payload={};try{payload=event.data?.json()||{};}catch{}event.waitUntil(self.registration.showNotification('Giorno',{body:typeof payload.body==='string'?payload.body.slice(0,140):'Hai un impegno da ricordare',tag:payload.tag||'giorno',icon:'icon-192.png'}));});
