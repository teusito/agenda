/**
 * Service Worker da aplicação Agenda.
 * Responsável pelo funcionamento offline (cache de recursos),
 * e pelo sistema de notificações em segundo plano.
 */

// Define o nome e a versão do cache. Mudar este nome invalida o cache antigo e força a atualização.
const CACHE_NAME = 'agenda-cache-v1';

// Lista de URLs dos recursos essenciais da aplicação para serem armazenados em cache durante a instalação.
const urlsToCache = [
  '/',
  '/index.html',
  '/agenda.ico',
  '/manifest.json',
  'https://rsms.me/inter/inter.css',
  'https://cdn.tailwindcss.com',
];

// Variáveis globais do Service Worker para gerenciar eventos e notificações.
let scheduledEvents = []; // Armazena a lista de eventos sincronizada com a aplicação.
let notificationCheckTimeout = null; // Armazena o ID do timeout para o loop de verificação.

/**
 * Função que verifica os eventos e dispara notificações com base nos alertas personalizados.
 * Usa um setTimeout recursivo para garantir que a próxima verificação só ocorra após a atual terminar,
 * criando um loop de verificação a cada minuto.
 */
const checkEventsForNotifications = () => {
    // Limpa qualquer timeout anterior para evitar execuções múltiplas.
    if (notificationCheckTimeout) {
        clearTimeout(notificationCheckTimeout);
    }

    const now = new Date();
    const nowTimestamp = now.getTime();

    scheduledEvents.forEach((event) => {
        // Pula eventos sem alertas, já concluídos ou sem dados necessários.
        if (!event.alerts || event.alerts.length === 0 || event.isCompleted) {
            return;
        }

        try {
            const eventTime = new Date(`${event.date}T${event.startTime}`);
            if (isNaN(eventTime.getTime())) return; // Pula se a data do evento for inválida.

            event.alerts.forEach(alert => {
                const notificationTime = new Date(eventTime);
                // Calcula o horário exato da notificação subtraindo o tempo do alerta.
                switch (alert.unit) {
                    case 'minutes': notificationTime.setMinutes(notificationTime.getMinutes() - alert.value); break;
                    case 'hours':   notificationTime.setHours(notificationTime.getHours() - alert.value); break;
                    case 'days':    notificationTime.setDate(notificationTime.getDate() - alert.value); break;
                    case 'weeks':   notificationTime.setDate(notificationTime.getDate() - (alert.value * 7)); break;
                    case 'months':  notificationTime.setMonth(notificationTime.getMonth() - alert.value); break;
                    case 'years':   notificationTime.setFullYear(notificationTime.getFullYear() - alert.value); break;
                }
                
                // Verifica se a notificação deveria ter ocorrido no último minuto (60000 ms).
                const timeDifference = nowTimestamp - notificationTime.getTime();
                if (timeDifference >= 0 && timeDifference < 60000) {
                    const notificationId = `${event.id}-${alert.id}`; // ID único para evitar notificações duplicadas.
                    let body = '';
                    if (alert.value === 0) {
                        body = `${event.title} está começando agora (${event.startTime}).`;
                    } else {
                        const unitLabels = { minutes: 'minuto(s)', hours: 'hora(s)', days: 'dia(s)', weeks: 'semana(s)', months: 'mês(es)', years: 'ano(s)' };
                        body = `${event.title} em ${alert.value} ${unitLabels[alert.unit]} (às ${event.startTime}).`;
                    }

                    // Exibe a notificação.
                    self.registration.showNotification('Agenda: Lembrete', {
                        body: body,
                        icon: '/agenda.ico',
                        tag: notificationId, // A `tag` agrupa notificações; uma nova com a mesma tag substitui a antiga.
                        data: { eventId: event.id, snoozeCount: 0 }, // Dados extras para serem usados no clique.
                        actions: [ // Botões de ação na notificação.
                            { action: 'mark_as_read', title: 'Marcar como concluído' },
                            { action: 'snooze', title: 'Adiar (5 min)' }
                        ]
                    });
                }
            });
        } catch (e) {
            console.error('Service Worker: Erro ao processar evento para notificação:', event, e);
        }
    });

    // Reagenda a próxima verificação para daqui a 60 segundos.
    notificationCheckTimeout = setTimeout(checkEventsForNotifications, 60000);
};


/**
 * Evento 'message': ouve mensagens da aplicação principal.
 * É usado para sincronizar a lista de eventos.
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_EVENTS') {
        scheduledEvents = event.data.events || [];
        console.log('Service Worker: Lista de eventos sincronizada.', scheduledEvents.length);
        // Inicia (ou reinicia) o ciclo de verificação de notificações com a lista atualizada.
        checkEventsForNotifications();
    }
});

/**
 * Evento 'notificationclick': lida com o clique em uma notificação ou em suas ações.
 */
self.addEventListener('notificationclick', (event) => {
    const { action, notification } = event;
    const { data } = notification;

    if (action === 'snooze') { // Se o usuário clicou em "Adiar"
        const snoozeCount = (data.snoozeCount || 0) + 1;
        if (snoozeCount <= 2) { // Limita o adiar a 2 vezes.
            setTimeout(() => {
                const newBody = `(Adiado) ${notification.body.replace(/^\(Adiado\) /, '')}`;
                
                self.registration.showNotification(notification.title, {
                    body: newBody,
                    icon: notification.icon,
                    tag: `${notification.tag}-snooze-${snoozeCount}`, // Nova tag para garantir que a notificação apareça novamente.
                    data: { ...data, snoozeCount },
                    actions: notification.actions,
                });
            }, 5 * 60 * 1000); // 5 minutos em milissegundos.
        }
    } else if (action === 'mark_as_read') { // Se o usuário clicou em "Marcar como concluído"
        // Envia uma mensagem para a aplicação principal para atualizar o estado do evento.
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                clientList[0].postMessage({ type: 'MARK_EVENT_AS_COMPLETED', eventId: data.eventId });
            }
        });
    } else {
        // Comportamento padrão ao clicar no corpo da notificação: focar na aba da aplicação ou abrir uma nova.
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                if (clientList.length > 0) {
                    let client = clientList[0];
                    for (let i = 0; i < clientList.length; i++) {
                        if (clientList[i].focused) {
                            client = clientList[i];
                        }
                    }
                    return client.focus();
                }
                return clients.openWindow('/');
            })
        );
    }

    notification.close(); // Fecha a notificação após a interação.
});


/**
 * Evento 'install': é disparado quando o Service Worker é instalado pela primeira vez.
 * Ele armazena os recursos essenciais da aplicação em cache.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
});

/**
 * Evento 'activate': é disparado após a instalação e quando uma nova versão do SW assume o controle.
 * Ele limpa os caches antigos para garantir que a aplicação use os recursos mais recentes.
 */
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Garante que o novo SW assuma o controle imediatamente.
  );
});

/**
 * Evento 'fetch': Intercepta todas as requisições de rede da aplicação.
 * Implementa uma estratégia de cache "cache-first" para recursos estáticos.
 */
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não são GET ou que são para APIs externas (como a de previsão do tempo).
  const isWeatherApiCall = event.request.url.startsWith('https://api.open-meteo.com');
  if (event.request.method !== 'GET' || isWeatherApiCall) {
    return; // Deixa a requisição passar para a rede.
  }

  // Para requisições de navegação (abrir a página), sempre serve o index.html do cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html')
        .then(response => response || fetch(event.request))
    );
    return;
  }

  // Para outros recursos (CSS, JS, imagens), usa a estratégia "cache-first".
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Se o recurso estiver no cache, retorna a resposta do cache.
        if (response) {
          return response;
        }

        // Se não estiver no cache, busca na rede.
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          (networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // Armazena a resposta da rede no cache para futuras requisições.
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        );
      })
  );
});