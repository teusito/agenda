/**
 * Interface que representa um alerta personalizado para um evento.
 * @param id - Identificador único para a chave do React.
 * @param value - O valor numérico do alerta (ex: 15).
 * @param unit - A unidade de tempo para o valor (minutos, horas, etc.).
 */
export interface AppEventAlert {
  id: string;
  value: number;
  unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';
}

/**
 * Define a estrutura para a regra de repetição de um evento.
 * @param frequency - A frequência da repetição (diária, semanal, etc.).
 * @param interval - O intervalo entre as repetições (ex: a cada 2 semanas).
 */
export interface EventRepeat {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
}

/**
 * Interface principal que representa um evento na agenda.
 * Contém todas as informações sobre um compromisso.
 */
export interface AppEvent {
  id: string; // Identificador único do evento.
  calendarId: string; // ID do calendário ao qual o evento pertence.
  title: string; // Título do evento.
  date: string; // Data no formato ISO (AAAA-MM-DD).
  startTime: string; // Hora de início no formato (HH:mm).
  description: string; // Descrição detalhada do evento.
  alerts?: AppEventAlert[]; // Array de alertas personalizados para o evento.
  isCompleted?: boolean; // Se o evento foi marcado como concluído.
  location?: string; // Localização física do evento.
  isAllDay?: boolean; // Se o evento dura o dia todo (oculta o horário).
  repeat?: EventRepeat; // Regra de repetição do evento.
}

/**
 * Interface que representa um calendário (ou agenda).
 * Agrupa eventos sob um nome e uma cor.
 */
export interface Calendar {
  id:string; // Identificador único do calendário.
  name: string; // Nome do calendário (ex: "Trabalho", "Pessoal").
  color: string; // Cor associada ao calendário (pode ser uma classe Tailwind ou um código hexadecimal).
  isVisible: boolean; // Define se os eventos deste calendário são exibidos no momento.
}

/**
 * Interface que representa a previsão do tempo para um dia específico.
 */
export interface WeatherInfo {
  temp: number; // Temperatura máxima do dia.
  icon: string; // Código do ícone da API de clima.
  description: string; // Descrição textual do clima.
}

/**
 * Tipos de tema de aparência disponíveis na aplicação.
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Tipos de visualização (telas) principais da aplicação.
 */
export type View = 'calendar' | 'settings';

/**
 * Modos de visualização disponíveis na tela de calendário.
 */
export type CalendarViewMode = 'month' | 'week' | 'day';

/**
 * Define a estrutura do contexto global da aplicação (AppContext).
 * Este contexto fornece estado e funções para todos os componentes aninhados,
 * evitando "prop drilling" (passar props por múltiplos níveis).
 */
export interface AppContextType {
  // --- Estado de Dados ---
  calendars: Calendar[];
  events: AppEvent[];

  // --- Funções CRUD de Calendário ---
  addCalendar: (calendarData: { name: string; color: string }) => void;
  updateCalendar: (calendar: Calendar) => void;
  deleteCalendar: (id: string) => void;

  // --- Funções CRUD de Evento ---
  addEvent: (eventData: Omit<AppEvent, 'id'>) => void;
  updateEvent: (event: AppEvent) => void;
  deleteEvent: (id: string) => void;
  openEventModal: (event?: AppEvent | null, date?: string, startTime?: string) => void;

  // --- Autenticação Local ---
  isLoggedIn: boolean;
  logIn: () => void;
  logOut: () => void;

  // --- Sincronização de Hora ---
  getSyncedTime: () => Date;
  
  // --- Notificações ---
  notificationPermission: NotificationPermission;
  requestNotificationPermission: () => void;

  // --- Importação/Exportação ---
  importICS: (icsString: string) => Promise<{ eventsImported: number; calendarsCreated: number }>;
  triggerImportAnimation: () => void;

  // --- Navegação e UI ---
  currentView: View;
  setCurrentView: (view: View) => void;
  goToToday: () => void;
  goToBackupSection: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // --- PWA (Progressive Web App) ---
  showInstallToast: boolean;
  triggerInstallPrompt: () => void;
  dismissInstallPrompt: () => void;

  // --- Depuração ---
  isDebugMode: boolean;
  setIsDebugMode: (enabled: boolean) => void;
  logDebug: (message: string, ...data: any[]) => void;
}
