import React, { useState, useEffect, useCallback, createContext, useRef } from 'react';
import { AppEvent, Calendar, Theme, View, AppContextType } from './types';
import { CALENDAR_COLORS } from './constants';
import SideMenu from './components/Dock';
import CalendarView from './components/CalendarView';
import SettingsView from './components/SettingsView';
import CalendarManager from './components/CalendarManager';
import ImportFeedback from './components/ImportFeedback';
import EventModal from './components/EventModal';
import LoginView from './components/LoginView';
import InstallToast from './components/InstallToast';
import DayEventsListModal from './components/DayEventsListModal';

/**
 * Hook personalizado para persistir estado no `localStorage`.
 * @param key A chave usada para armazenar o valor no localStorage.
 * @param initialValue O valor inicial a ser usado se nada for encontrado no localStorage.
 * @returns Uma tupla contendo o valor do estado e a função para atualizá-lo.
 */
const useLocalStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  // O estado é inicializado lendo do localStorage.
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  });

  // Efeito que atualiza o localStorage sempre que o estado muda.
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
};

/**
 * Hook personalizado para persistir estado no `sessionStorage`.
 * @param key A chave usada para armazenar o valor no sessionStorage.
 * @param initialValue O valor inicial a ser usado se nada for encontrado no sessionStorage.
 * @returns Uma tupla contendo o valor do estado e a função para atualizá-lo.
 */
const useSessionStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  // O estado é inicializado lendo do sessionStorage.
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading sessionStorage key “${key}”:`, error);
      return initialValue;
    }
  });

  // Efeito que atualiza o sessionStorage sempre que o estado muda.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error setting sessionStorage key “${key}”:`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
};

// Cria o contexto global da aplicação para fornecer dados e funções a todos os componentes.
export const AppContext = createContext<AppContextType | null>(null);

// Define o tipo para o estado do histórico (usado para undo/redo).
type HistoryState = { calendars: Calendar[]; events: AppEvent[] };

/**
 * Componente principal da aplicação (App).
 * Gerencia o estado global, a lógica de negócios, a navegação entre telas
 * e a renderização dos componentes principais.
 */
const App: React.FC = () => {
  // --- ESTADO GLOBAL DA APLICAÇÃO ---
  
  // Estado para o tema da UI (claro, escuro, sistema). Persistido no localStorage.
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'system');
  // Estado para a tela (view) atual. Persistido no localStorage.
  const [currentView, setCurrentView] = useLocalStorage<View>('currentView', 'calendar');
  // Estado para controlar a visibilidade do modal de gerenciamento de calendários.
  const [isCalendarManagerOpen, setIsCalendarManagerOpen] = useState(false);
  // Estado para o modo de depuração. Persistido no localStorage.
  const [isDebugMode, setIsDebugMode] = useLocalStorage<boolean>('isDebugMode', false);

  // Estados principais de dados (calendários e eventos), persistidos no localStorage.
  const [calendars, setCalendars] = useLocalStorage<Calendar[]>('calendars', [
    { id: 'cal-default', name: 'Pessoal', color: 'bg-blue-500', isVisible: true }
  ]);
  const [events, setEvents] = useLocalStorage<AppEvent[]>('events', []);
  
  // Pilhas de histórico para as funções de Desfazer (Undo) e Refazer (Redo). Persistido no sessionStorage.
  const [undoStack, setUndoStack] = useSessionStorage<HistoryState[]>('undoStack', []);
  const [redoStack, setRedoStack] = useSessionStorage<HistoryState[]>('redoStack', []);

  // Estados para controle de UI e Modais.
  const [showImportAnimation, setShowImportAnimation] = useState(false); // Animação de importação
  const [isModalOpen, setIsModalOpen] = useState(false); // Modal de criação/edição de evento
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null); // Evento selecionado para edição
  const [selectedDate, setSelectedDate] = useState<string>(''); // Data selecionada para novo evento
  const [initialStartTime, setInitialStartTime] = useState<string | undefined>(undefined); // Hora inicial para novo evento
  
  // Estado de Autenticação (login local). Persistido no localStorage.
  const [isLoggedIn, setIsLoggedIn] = useLocalStorage<boolean>('isLoggedIn', false);

  // Estado para a permissão de notificações do navegador.
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Gatilho para forçar a navegação para o dia de hoje.
  const [todayTrigger, setTodayTrigger] = useState(0);
  
  // Estado para o PWA (Progressive Web App).
  const [showInstallToast, setShowInstallToast] = useState(false); // Exibir toast de instalação
  const deferredPrompt = useRef<any>(null); // Armazena o evento de instalação do PWA

  // --- FUNÇÕES E LÓGICA DE NEGÓCIOS ---
  
  // Efeito para verificar a permissão de notificação na inicialização da aplicação.
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  /**
   * Retorna a data e hora atuais. Esta função é usada para abstrair a fonte do tempo.
   */
  const getSyncedTime = useCallback(() => new Date(), []);
  
  /**
   * Efeito para capturar o evento 'beforeinstallprompt', que permite controlar o prompt de instalação do PWA.
   */
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault(); // Impede que o navegador mostre o prompt de instalação automaticamente.
      deferredPrompt.current = e; // Salva o evento para ser usado depois.
      setShowInstallToast(true); // Mostra o toast personalizado para o usuário.
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  /**
   * Salva o estado atual de calendários e eventos na pilha de Desfazer.
   */
  const saveStateToHistory = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-20), { calendars, events }]); // Mantém no máximo os últimos 20 estados
    setRedoStack([]); // Limpa a pilha de Refazer, pois uma nova ação foi executada
  }, [calendars, events, setUndoStack, setRedoStack]);

  /**
   * Atualiza um evento existente.
   */
  const updateEvent = useCallback((updatedEvent: AppEvent) => {
    saveStateToHistory(); // Salva o estado anterior antes de modificar
    setEvents(prev => prev.map(event => event.id === updatedEvent.id ? updatedEvent : event));
  }, [saveStateToHistory, setEvents]);

  /**
   * Efeito que ouve mensagens do Service Worker.
   * Usado para ações que se originam de uma notificação, como "Marcar como concluído".
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'MARK_EVENT_AS_COMPLETED') {
        const { eventId } = event.data;
        const eventToUpdate = events.find(e => e.id === eventId);
        if (eventToUpdate) {
          updateEvent({ ...eventToUpdate, isCompleted: true });
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [events, updateEvent]);

  /**
   * Realiza o login local do usuário.
   */
  const logIn = useCallback(() => {
    setIsLoggedIn(true);
    setCurrentView('calendar'); // Redireciona para a tela do calendário
  }, [setIsLoggedIn, setCurrentView]);

  /**
   * Realiza o logout do usuário.
   */
  const logOut = useCallback(() => {
    setIsLoggedIn(false);
  }, [setIsLoggedIn]);

  /**
   * Função de log para depuração. Só imprime no console se o modo de depuração estiver ativo.
   */
  const logDebug = useCallback((message: string, ...data: any[]) => {
    if (isDebugMode) {
      console.log(`[DEBUG] ${message}`, ...data);
    }
  }, [isDebugMode]);
  
  /**
   * Navega para a tela de configurações e rola até a seção de backup.
   */
  const goToBackupSection = useCallback(() => {
    setCurrentView('settings');
    setTimeout(() => {
        const section = document.getElementById('local-file-sync-section');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            section.classList.add('animate-highlight-flash');
            setTimeout(() => {
                section.classList.remove('animate-highlight-flash');
            }, 1500);
        }
    }, 100);
  }, [setCurrentView]);

  /**
   * Analisa o conteúdo de uma string no formato iCalendar (.ics).
   * @param icsString A string com o conteúdo do arquivo.
   * @param existingCalendars A lista de calendários já existentes para evitar duplicação de nomes.
   * @returns Um objeto com a lista de eventos parseados e os novos calendários criados.
   */
  const _parseICSContent = useCallback((icsString: string, existingCalendars: Calendar[]): { events: AppEvent[], newCalendars: Calendar[] } => {
    const lines = icsString.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let parsedEvents: (Omit<AppEvent, 'calendarId'>)[] = [];
    let parsedCategories: string[] = [];
    
    let inEvent = false;
    let currentEvent: { [key: string]: string } = {};

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (lines[i + 1]?.match(/^\s+/)) {
            line += lines[i + 1].trim();
            i++;
        }
        const unescapeText = (text: string = ''): string => text.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\n/g, '\n').replace(/\\\\/g, '\\');
        if (line.startsWith('BEGIN:VEVENT')) { inEvent = true; currentEvent = {}; } 
        else if (line.startsWith('END:VEVENT') && inEvent) {
            inEvent = false;
            try {
                const uid = unescapeText(currentEvent.UID || `evt-${Date.now()}-${Math.random()}`);
                const title = unescapeText(currentEvent.SUMMARY || 'Evento sem título');
                const description = unescapeText(currentEvent.DESCRIPTION || '');
                const categoryName = unescapeText(currentEvent.CATEGORIES || 'Pessoal');
                const dtstart = currentEvent.DTSTART;
                if (!dtstart) continue;
                const date = `${dtstart.substring(0, 4)}-${dtstart.substring(4, 6)}-${dtstart.substring(6, 8)}`;
                const startTime = `${dtstart.substring(9, 11)}:${dtstart.substring(11, 13)}`;
                parsedEvents.push({ title, description, date, startTime, id: uid });
                parsedCategories.push(categoryName);
            } catch (e: unknown) {
              console.error("Erro ao processar VEVENT:", e);
            }
        } else if (inEvent) {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) currentEvent[key.split(';')[0].toUpperCase()] = valueParts.join(':');
        }
    }

    const finalCalendars = [...existingCalendars];
    const newCalendars: Calendar[] = [];
    const existingNames = new Set(finalCalendars.map(c => c.name));

    [...new Set(parsedCategories)].forEach(rawCategoryName => {
        const categoryName = rawCategoryName;
        if (!existingNames.has(categoryName)) {
            const newCal = {
                id: `cal-${Date.now()}-${newCalendars.length}`,
                name: categoryName,
                color: CALENDAR_COLORS[finalCalendars.length % CALENDAR_COLORS.length],
                isVisible: true,
            };
            finalCalendars.push(newCal);
            newCalendars.push(newCal);
            existingNames.add(categoryName);
        }
    });

    const nameToIdMap = new Map(finalCalendars.map(c => [c.name, c.id]));
    const eventsWithIds: AppEvent[] = parsedEvents.map((event, index) => ({
      ...event,
      calendarId: nameToIdMap.get(parsedCategories[index])!,
    })).filter(e => e.calendarId);

    return { events: eventsWithIds, newCalendars };
  }, []);

  /**
   * Importa eventos de uma string .ics para a aplicação.
   */
  const importICS = useCallback(async (icsString: string): Promise<{ eventsImported: number; calendarsCreated: number }> => {
    saveStateToHistory();
    const { events: importedEvents, newCalendars } = _parseICSContent(icsString, calendars);
    
    setCalendars(prev => [...prev, ...newCalendars]);
    setEvents(prev => [...prev, ...importedEvents]);

    return { eventsImported: importedEvents.length, calendarsCreated: newCalendars.length };
  }, [saveStateToHistory, calendars, _parseICSContent, setCalendars, setEvents]);
  
  /**
   * Solicita permissão para exibir notificações.
   */
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      alert('Este navegador não suporta notificações.');
      return;
    }
    
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }, []);

  /**
   * Efeito para sincronizar a lista de eventos com o Service Worker sempre que ela muda.
   * Isso é essencial para que o SW possa disparar notificações em segundo plano.
   */
  useEffect(() => {
    if (notificationPermission === 'granted' && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SYNC_EVENTS',
        events: events
      });
    }
  }, [events, notificationPermission]);
  
  // --- FUNÇÕES CRUD (Create, Read, Update, Delete) ---

  const addCalendar = useCallback((calendarData: { name: string; color: string }) => {
    saveStateToHistory();
    const newCalendar: Calendar = { ...calendarData, id: `cal-${Date.now()}`, isVisible: true };
    setCalendars(prev => [...prev, newCalendar]);
  }, [saveStateToHistory, setCalendars]);

  const updateCalendar = useCallback((updatedCalendar: Calendar) => {
    saveStateToHistory();
    setCalendars(prev => prev.map(cal => cal.id === updatedCalendar.id ? updatedCalendar : cal));
  }, [saveStateToHistory, setCalendars]);

  const deleteCalendar = useCallback((id: string) => {
    saveStateToHistory();
    setCalendars(prev => prev.filter(cal => cal.id !== id));
    setEvents(prev => prev.filter(event => event.calendarId !== id));
  }, [saveStateToHistory, setCalendars, setEvents]);

  const addEvent = useCallback((eventData: Omit<AppEvent, 'id'>) => {
    saveStateToHistory();
    const newEvent: AppEvent = { ...eventData, id: `evt-${Date.now()}` };
    setEvents(prev => [...prev, newEvent]);
  }, [saveStateToHistory, setEvents]);

  const deleteEvent = useCallback((id: string) => {
    saveStateToHistory();
    setEvents(prev => prev.filter(event => event.id !== id));
  }, [saveStateToHistory, setEvents]);
  
  // --- Funções PWA ---

  const dismissInstallPrompt = () => {
    setShowInstallToast(false);
  }

  const triggerInstallPrompt = () => {
    if (!deferredPrompt.current) return;
    setShowInstallToast(false);
    deferredPrompt.current.prompt();
    deferredPrompt.current.userChoice.then((choiceResult: { outcome: string }) => {
      deferredPrompt.current = null;
    });
  };

  // --- Funções de Histórico (Undo/Redo) ---
  
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const lastState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, { calendars, events }]);
    setUndoStack(prev => prev.slice(0, -1));
    setCalendars(lastState.calendars);
    setEvents(lastState.events);
  }, [undoStack, redoStack, calendars, events, setUndoStack, setRedoStack, setCalendars, setEvents]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, { calendars, events }]);
    setRedoStack(prev => prev.slice(0, -1));
    setCalendars(nextState.calendars);
    setEvents(nextState.events);
  }, [undoStack, redoStack, calendars, events, setUndoStack, setRedoStack, setCalendars, setEvents]);
  
  // --- Funções de UI ---

  const triggerImportAnimation = () => { setShowImportAnimation(true); setTimeout(() => setShowImportAnimation(false), 1500); };
  
  const openEventModal = (event?: AppEvent | null, date?: string, startTime?: string) => {
    const now = getSyncedTime();
    const defaultDate = now.toISOString().split('T')[0];
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setSelectedEvent(event);
    setSelectedDate(date || defaultDate);
    setInitialStartTime(startTime || defaultTime);
    setIsModalOpen(true);
  };
  
  const goToToday = useCallback(() => {
    setCurrentView('calendar');
    setTodayTrigger(t => t + 1);
  }, [setCurrentView]);

  /**
   * Efeito para aplicar a classe de tema (light/dark) ao elemento HTML raiz.
   * Também ouve as mudanças de preferência do sistema operacional.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const applySystemTheme = () => {
        const systemTheme = mediaQuery.matches ? 'dark' : 'light';
        root.classList.remove('light', 'dark');
        root.classList.add(systemTheme);
      };

      applySystemTheme();
      mediaQuery.addEventListener('change', applySystemTheme);
      
      return () => {
        mediaQuery.removeEventListener('change', applySystemTheme);
      };
    } else {
      root.classList.add(theme);
    }
  }, [theme]);
  
  // --- RENDERIZAÇÃO ---
  
  // Se o usuário não estiver logado, renderiza a tela de login.
  if (!isLoggedIn) {
    return <LoginView onSignIn={logIn} />;
  }

  // Monta o objeto de contexto que será fornecido para os componentes filhos.
  const appContextValue: AppContextType = {
    calendars, events, addCalendar, updateCalendar, deleteCalendar, addEvent, updateEvent, deleteEvent,
    getSyncedTime, importICS, triggerImportAnimation, openEventModal,
    isLoggedIn, logIn, logOut,
    goToToday,
    goToBackupSection,
    currentView,
    setCurrentView,
    showInstallToast,
    triggerInstallPrompt,
    dismissInstallPrompt,
    notificationPermission,
    requestNotificationPermission,
    theme,
    setTheme,
    isDebugMode,
    setIsDebugMode,
    logDebug,
  };

  // Renderiza a aplicação principal.
  return (
    <AppContext.Provider value={appContextValue}>
      <div className={`h-screen w-screen font-sans bg-windows-bg-light dark:bg-windows-bg-dark flex flex-col overflow-hidden transition-colors duration-300`}>
        <main className="flex-grow relative h-full">
          {currentView === 'calendar' && <CalendarView todayTrigger={todayTrigger} />}
          {currentView === 'settings' && <SettingsView onOpenCalendarManager={() => setIsCalendarManagerOpen(true)} />}
        </main>
        
        <SideMenu
          onUndo={handleUndo}
          canUndo={undoStack.length > 0}
          onRedo={handleRedo}
          canRedo={redoStack.length > 0}
        />

        <InstallToast />

        <CalendarManager isOpen={isCalendarManagerOpen} onClose={() => setIsCalendarManagerOpen(false)} />
        <ImportFeedback isVisible={showImportAnimation} />
        <EventModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} event={selectedEvent} initialDate={selectedDate} initialStartTime={initialStartTime} />
      </div>
    </AppContext.Provider>
  );
};

export default App;
