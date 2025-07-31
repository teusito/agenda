import React, { useState, useMemo, useContext, useRef, useCallback, useEffect } from 'react';
import { AppEvent, Calendar, CalendarViewMode, AppContextType, WeatherInfo } from '../types';
import { ICONS, WEATHER_ICONS, wmoCodeToWeather } from '../constants';
import { AppContext } from '../App';
import DayEventsListModal from './DayEventsListModal';

// --- FUNÇÕES AUXILIARES (HELPERS) ---

/**
 * Converte um objeto Date para uma string no formato AAAA-MM-DD.
 * @param date - O objeto Date a ser convertido.
 * @returns A data formatada como string.
 */
const toYYYYMMDD = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * Expande eventos recorrentes em ocorrências individuais dentro de um intervalo de datas.
 * @param baseEvents - A lista de todos os eventos base.
 * @param viewStart - O início do intervalo de visualização.
 * @param viewEnd - O fim do intervalo de visualização.
 * @returns Uma lista de todas as ocorrências de eventos (normais e recorrentes) no intervalo.
 */
const expandRecurringEvents = (baseEvents: AppEvent[], viewStart: Date, viewEnd: Date): AppEvent[] => {
  const allOccurrences: AppEvent[] = [];

  baseEvents.forEach(event => {
    // Se o evento não se repete, apenas o adiciona se estiver dentro da janela de visualização.
    if (!event.repeat) {
      const eventDate = new Date(event.date + 'T00:00:00');
      if (eventDate >= viewStart && eventDate <= viewEnd) {
        allOccurrences.push(event);
      }
    } else {
      // Se o evento se repete, calcula todas as suas ocorrências no período.
      let cursorDate = new Date(event.date + 'T00:00:00');
      const repeatRule = event.repeat;

      while (cursorDate <= viewEnd) {
        if (cursorDate >= viewStart) {
          allOccurrences.push({
            ...event,
            date: toYYYYMMDD(cursorDate),
            id: `${event.id}_${toYYYYMMDD(cursorDate)}`, // Gera um ID único para a ocorrência.
          });
        }
        // Avança a data do cursor para a próxima ocorrência.
        switch (repeatRule.frequency) {
          case 'daily':
            cursorDate.setDate(cursorDate.getDate() + repeatRule.interval);
            break;
          case 'weekly':
            cursorDate.setDate(cursorDate.getDate() + repeatRule.interval * 7);
            break;
          case 'monthly':
            cursorDate.setMonth(cursorDate.getMonth() + repeatRule.interval);
            break;
          case 'yearly':
            cursorDate.setFullYear(cursorDate.getFullYear() + repeatRule.interval);
            break;
        }
      }
    }
  });

  return allOccurrences;
};

/**
 * Retorna um array com os 7 dias da semana para uma data específica.
 * @param date - A data de referência.
 * @returns Um array de 7 objetos Date.
 */
const getWeekDays = (date: Date): Date[] => {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay()); // A semana começa no Domingo (0).
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    return day;
  });
};

/**
 * Formata a data para ser exibida no cabeçalho do calendário, dependendo do modo de visualização.
 * @param date - A data atual do calendário.
 * @param viewMode - O modo de visualização ('month', 'week', 'day').
 * @returns A string da data formatada.
 */
const formatHeaderDate = (date: Date, viewMode: CalendarViewMode): string => {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' };
  switch (viewMode) {
    case 'month':
      return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    case 'day':
      return date.toLocaleDateString('pt-BR', { ...options, day: 'numeric', weekday: 'long' });
    case 'week':
      const weekDays = getWeekDays(date);
      const start = weekDays[0];
      const end = weekDays[6];
      const startMonth = start.toLocaleString('pt-BR', { month: 'short' });
      const endMonth = end.toLocaleString('pt-BR', { month: 'short' });
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} - ${end.getDate()} de ${start.toLocaleString('pt-BR', { month: 'long' })}, ${end.getFullYear()}`;
      }
      return `${start.getDate()} de ${startMonth} - ${end.getDate()} de ${endMonth}, ${end.getFullYear()}`;
    default:
      return '';
  }
};

/**
 * Verifica se uma data corresponde ao dia de hoje.
 * @param date - A data a ser verificada.
 * @param today - O objeto Date que representa o dia de hoje.
 * @returns `true` se a data for hoje, `false` caso contrário.
 */
const isToday = (date: Date, today: Date): boolean => {
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
};

/**
 * Calcula o layout de eventos que se sobrepõem em um mesmo dia para as visualizações de semana e dia.
 * @param dayEvents - Array de eventos de um dia.
 * @returns Um array de eventos com informações de posicionamento (left, width) para evitar colisões visuais.
 */
const getEventsWithLayout = (dayEvents: AppEvent[]) => {
    const sortedEvents = [...dayEvents]
        .map(e => ({ ...e, start: e.isAllDay ? -1 : e.startTime.split(':').map(Number).reduce((h, m) => h * 60 + m) }))
        .sort((a, b) => {
            if (a.isAllDay && !b.isAllDay) return -1;
            if (!a.isAllDay && b.isAllDay) return 1;
            return a.start - b.start;
        });

    if (sortedEvents.length === 0) return [];

    const nonAllDayEvents = sortedEvents.filter(e => !e.isAllDay).map(e => ({...e, end: e.start + 60})); // Assume 60 min de duração por padrão
    const columns: (typeof nonAllDayEvents)[] = [];
    
    // Algoritmo "greedy" para alocar eventos em colunas sem sobreposição
    for (const event of nonAllDayEvents) {
        let placed = false;
        for (const col of columns) {
            const lastEventInCol = col[col.length - 1];
            if (event.start >= lastEventInCol.end) {
                col.push(event);
                placed = true;
                break;
            }
        }
        if (!placed) {
            columns.push([event]);
        }
    }

    const eventsWithLayout: (AppEvent & { layout?: { left: string; width: string } })[] = sortedEvents.filter(e => e.isAllDay);
    columns.forEach((col, colIndex) => {
        col.forEach(event => {
            const originalEvent = dayEvents.find(e => e.id === event.id)!;
            eventsWithLayout.push({
                ...originalEvent,
                layout: {
                    width: `calc(${100 / columns.length}% - 4px)`,
                    left: `calc(${(100 / columns.length) * colIndex}% + 2px)`,
                }
            });
        });
    });
    
    return eventsWithLayout;
};

/**
 * Determina se o texto sobre um fundo colorido deve ser preto ou branco para melhor legibilidade.
 * @param color - O código hexadecimal da cor de fundo (ex: '#RRGGBB').
 * @returns 'black' ou 'white'.
 */
const getTextColorForBackground = (color: string): 'black' | 'white' => {
  if (!color.startsWith('#')) return 'white'; // Padrão para classes Tailwind, que são geralmente escuras.
  
  let r = 0, g = 0, b = 0;
  if (color.length === 4) { // Formato #RGB -> #RRGGBB
    r = parseInt(color[1] + color[1], 16);
    g = parseInt(color[2] + color[2], 16);
    b = parseInt(color[3] + color[3], 16);
  } else if (color.length === 7) { // Formato #RRGGBB
    r = parseInt(color.substring(1, 3), 16);
    g = parseInt(color.substring(3, 5), 16);
    b = parseInt(color.substring(5, 7), 16);
  }
  
  // Fórmula YIQ para determinar a luminosidade da cor.
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? 'black' : 'white';
};

// --- SUB-COMPONENTES DE VISUALIZAÇÃO ---

/**
 * Cabeçalho do calendário com controles de navegação e seleção de visualização.
 */
const CalendarHeader: React.FC<{
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  viewMode: CalendarViewMode;
  setViewMode: (mode: CalendarViewMode) => void;
  onDateSet: (date: Date) => void;
}> = ({ currentDate, onPrev, onNext, onToday, viewMode, setViewMode, onDateSet }) => {
  const { logDebug } = useContext(AppContext) as AppContextType;
  const headerTitle = formatHeaderDate(currentDate, viewMode);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [tempDate, setTempDate] = useState(currentDate);

  useEffect(() => {
    if (isPickerOpen) {
      setTempDate(currentDate);
    }
  }, [isPickerOpen, currentDate]);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const months = Array.from({ length: 12 }, (_, i) => new Date(0, i).toLocaleString('pt-BR', { month: 'long' }));
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 201 }, (_, i) => currentYear - 100 + i);

  const handleConfirm = () => {
    onDateSet(tempDate);
    setIsPickerOpen(false);
  };
  
  const handleCancel = () => {
    setIsPickerOpen(false);
  };


  return (
    <div className="flex flex-col md:flex-row items-center justify-between p-4 md:p-6 gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
            <button onClick={onToday} className="px-4 py-2 text-sm font-semibold rounded-md bg-slate-200 dark:bg-slate-700 text-windows-text-primary-light dark:text-windows-text-primary-dark hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                Hoje
            </button>
            <div className="flex items-center gap-1">
                <button onClick={onPrev} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><ICONS.chevronLeft /></button>
                <button onClick={onNext} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><ICONS.chevronRight /></button>
            </div>
            <div className="relative text-center flex-grow md:text-left md:ml-4" ref={pickerRef}>
                <button
                    onClick={() => viewMode === 'month' && setIsPickerOpen(p => !p)}
                    className={`flex items-center gap-1 text-xl md:text-2xl font-bold text-windows-text-primary-light dark:text-windows-text-primary-dark rounded-md px-2 py-1 ${viewMode === 'month' ? 'hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer' : 'cursor-default'}`}
                    disabled={viewMode !== 'month'}
                >
                    <h2 className="capitalize">{headerTitle}</h2>
                    {viewMode === 'month' && <ICONS.chevronDown className={`w-5 h-5 transition-transform ${isPickerOpen ? 'rotate-180' : ''}`} />}
                </button>
                {isPickerOpen && viewMode === 'month' && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 md:left-0 md:-translate-x-0 w-60 bg-windows-content-light dark:bg-windows-content-dark p-4 rounded-xl shadow-lg border border-windows-border-light dark:border-windows-border-dark z-20 animate-in fade-in zoom-in-95">
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <select
                                value={tempDate.getMonth()}
                                onChange={(e) => setTempDate(new Date(tempDate.getFullYear(), parseInt(e.target.value, 10), 1))}
                                className="w-full bg-slate-100 dark:bg-slate-800 border border-windows-border-light dark:border-windows-border-dark rounded-md p-2 focus:ring-2 focus:ring-windows-accent focus:outline-none capitalize"
                            >
                                {months.map((month, index) => (
                                    <option key={month} value={index}>{month}</option>
                                ))}
                            </select>
                            <select
                                value={tempDate.getFullYear()}
                                onChange={(e) => setTempDate(new Date(parseInt(e.target.value, 10), tempDate.getMonth(), 1))}
                                className="w-full bg-slate-100 dark:bg-slate-800 border border-windows-border-light dark:border-windows-border-dark rounded-md p-2 focus:ring-2 focus:ring-windows-accent focus:outline-none"
                            >
                                {years.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end items-center gap-2">
                            <button onClick={handleCancel} title="Cancelar" className="p-2 rounded-full hover:bg-red-500/10 text-red-500 transition-colors">
                                <ICONS.x className="w-5 h-5" />
                            </button>
                             <button onClick={handleConfirm} title="Confirmar" className="p-2 rounded-full hover:bg-green-500/10 text-green-500 transition-colors">
                                <ICONS.check className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
        <div className="flex space-x-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
            {(['month', 'week', 'day'] as CalendarViewMode[]).map(mode => (
                <button key={mode} onClick={() => {
                    logDebug(`Alterando visão para '${mode}'.`);
                    setViewMode(mode);
                }}
                className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${viewMode === mode ? 'bg-windows-content-light dark:bg-windows-content-dark shadow-sm' : 'hover:bg-slate-300 dark:hover:bg-slate-600 text-windows-text-primary-light dark:text-windows-text-primary-dark'}`}>
                    {mode === 'month' ? 'Mês' : mode === 'week' ? 'Semana' : 'Dia'}
                </button>
            ))}
        </div>
    </div>
  );
};

/**
 * Componente para exibir o ícone e a temperatura da previsão do tempo.
 * @param weather - O objeto com as informações do tempo.
 */
const WeatherDisplay: React.FC<{ weather: WeatherInfo }> = ({ weather }) => {
  const IconComponent = WEATHER_ICONS[weather.icon] || WEATHER_ICONS['03d']; // Padrão para nublado
  return (
    <div className="flex items-center gap-0.5 text-xs text-windows-text-secondary-light dark:text-windows-text-secondary-dark" title={weather.description}>
      <IconComponent className="w-4 h-4" />
      <span>{Math.round(weather.temp)}°</span>
    </div>
  );
};

/**
 * Componente que renderiza a visualização de Mês.
 */
const MonthView: React.FC<{ 
    currentDate: Date, 
    today: Date,
    displayedEvents: AppEvent[];
    weatherData: Map<string, WeatherInfo>;
}> = ({ currentDate, today, displayedEvents, weatherData }) => {
  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Gera a grade de dias para o mês atual, preenchendo com dias do mês anterior/posterior se necessário.
  const monthGrid = useMemo(() => {
    const grid = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let currentDay = 1;
    for (let i = 0; i < 6; i++) {
      const week = [];
      for (let j = 0; j < 7; j++) {
        if (i === 0 && j < firstDayOfMonth) {
          const prevMonthDate = new Date(year, month, 0);
          const day = prevMonthDate.getDate() - firstDayOfMonth + j + 1;
          week.push({ day, isCurrentMonth: false, dateStr: toYYYYMMDD(new Date(year, month - 1, day)) });
        } else if (currentDay > daysInMonth) {
          const day = currentDay - daysInMonth;
          week.push({ day, isCurrentMonth: false, dateStr: toYYYYMMDD(new Date(year, month + 1, day)) });
          currentDay++;
        } else {
          const date = new Date(year, month, currentDay);
          week.push({ day: currentDay, isCurrentMonth: true, dateStr: toYYYYMMDD(date) });
          currentDay++;
        }
      }
      grid.push(week);
      if (currentDay > daysInMonth && grid.length >= 6) break;
    }
    // Garante que a grade sempre tenha 6 semanas para um layout consistente.
    while(grid.length < 6) {
        const week = [];
        for (let j = 0; j < 7; j++) {
            const day = currentDay - daysInMonth;
            week.push({ day, isCurrentMonth: false, dateStr: toYYYYMMDD(new Date(year, month + 1, day)) });
            currentDay++;
        }
        grid.push(week);
    }
    return grid;
  }, [currentDate]);

  // Agrupa os eventos por dia para facilitar o acesso e a renderização.
  const eventsByDay = useMemo(() => {
      const map = new Map<string, AppEvent[]>();
      for (const event of displayedEvents) {
          if (!map.has(event.date)) map.set(event.date, []);
          map.get(event.date)!.push(event);
      }
      return map;
  }, [displayedEvents]);

  return (
    <div className="p-2 md:p-4 pt-0 flex flex-col flex-grow">
      <div className="grid grid-cols-7 text-center font-semibold text-xs text-windows-text-secondary-light dark:text-windows-text-secondary-dark mb-2">
        {daysOfWeek.map(day => <div key={day} className="hidden sm:block">{day}</div>)}
        {daysOfWeek.map(day => <div key={day + 'sm'} className="sm:hidden">{day.charAt(0)}</div>)}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 flex-grow border-t border-l border-windows-border-light dark:border-windows-border-dark rounded-lg overflow-hidden shadow-sm">
        {monthGrid.flat().map((dayInfo, index) => {
          const dayEvents = eventsByDay.get(dayInfo.dateStr) || [];
          return (
            <div
              key={index}
              data-date-str={dayInfo.isCurrentMonth ? dayInfo.dateStr : ''} // Atributo de dados para identificar a célula do dia
              className={`relative border-b border-r border-windows-border-light dark:border-windows-border-dark p-1 sm:p-2 flex flex-col
                ${dayInfo.isCurrentMonth ? 'bg-windows-content-light dark:bg-windows-content-dark cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700' : 'bg-windows-bg-light dark:bg-windows-bg-dark'}`}
            >
              <div className='flex items-start justify-between gap-1'>
                  <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center
                      ${!dayInfo.isCurrentMonth 
                      ? 'text-slate-400 dark:text-slate-600' 
                      : isToday(new Date(dayInfo.dateStr + 'T00:00:00'), today)
                      ? 'text-white bg-windows-accent rounded-full' 
                      : 'text-windows-text-primary-light dark:text-windows-text-primary-dark'
                  }`}>{dayInfo.day}</span>
                  {dayInfo.isCurrentMonth && weatherData.has(dayInfo.dateStr) && (
                      <WeatherDisplay weather={weatherData.get(dayInfo.dateStr)!} />
                  )}
              </div>
              {dayInfo.isCurrentMonth && dayEvents.length > 0 && (
                <div className="flex-grow flex items-end justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-windows-accent"></div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  );
};

// Constante para a altura de uma hora em pixels.
const HOUR_HEIGHT_PX = 60;

/**
 * Componente que renderiza a linha do tempo com as horas do dia para as visualizações de Semana e Dia.
 */
const HoursTimeline: React.FC = () => (
    <div className="col-start-1 col-end-2 row-start-2 row-end-3">
        {Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`).map(hour => (
            <div key={hour} className="h-[60px] relative text-right pr-2 text-xs text-windows-text-secondary-light dark:text-windows-text-secondary-dark -top-[8px]">
                {hour !== '00:00' && hour}
            </div>
        ))}
    </div>
);

/**
 * Componente para renderizar um card de evento nas visualizações de Semana e Dia.
 */
const EventCard: React.FC<{ event: AppEvent & { layout?: { left: string, width: string } }; onEventClick: (event: AppEvent) => void; calendarColorMap: Map<string, string>, now: Date }> = ({ event, onEventClick, calendarColorMap, now }) => {
    const eventColor = calendarColorMap.get(event.calendarId) || '#808080';
    const isHex = eventColor.startsWith('#');
    const textColor = getTextColorForBackground(eventColor);
    
    const eventDateTime = new Date(`${event.date}T${event.startTime}`);
    const isPast = !event.isAllDay && eventDateTime < now;

    if (event.isAllDay) {
        return (
            <div
                onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                className={`w-full p-1 rounded-md mb-1 cursor-pointer text-xs ${!isHex ? eventColor : ''} ${event.isCompleted ? 'line-through opacity-70' : ''}`}
                style={{ backgroundColor: isHex ? eventColor : undefined, color: textColor }}
            >
                <p className="font-semibold truncate">{event.title}</p>
            </div>
        )
    }

    const [hour, minute] = event.startTime.split(':').map(Number);
    const top = (hour + minute / 60) * HOUR_HEIGHT_PX;
    const height = HOUR_HEIGHT_PX; // Assume duração de 1 hora.

    return (
        <div
            onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
            className={`absolute p-2 rounded-lg z-10 overflow-hidden cursor-pointer shadow-lg transition-all duration-200 ${!isHex ? eventColor : ''} ${isPast ? 'opacity-60' : ''}`}
            style={{ 
                top: `${top}px`, 
                minHeight: `${height}px`, 
                left: event.layout?.left ?? '2px', 
                width: event.layout?.width ?? 'calc(100% - 4px)',
                backgroundColor: isHex ? eventColor : undefined,
                color: textColor,
            }}
        >
            <p className={`font-bold text-sm ${event.isCompleted ? 'line-through' : ''}`}>{event.title}</p>
            <p className={`text-xs opacity-90 ${event.isCompleted ? 'line-through' : ''}`}>{event.startTime}</p>
             {event.location && (
               <div className="flex items-center gap-1 mt-1 text-xs opacity-80">
                   <ICONS.locationPin className="w-3 h-3"/>
                   <span className="truncate">{event.location}</span>
               </div>
            )}
        </div>
    );
};

/**
 * Componente que renderiza a visualização de Semana.
 */
const WeekView: React.FC<{ 
    currentDate: Date,
    displayedEvents: AppEvent[];
    onEventClick: (event: AppEvent) => void,
    onTimeSlotClick: (date: string, time: string) => void,
    today: Date
}> = ({ currentDate, displayedEvents, onEventClick, onTimeSlotClick, today }) => {
    const { calendars, getSyncedTime } = useContext(AppContext) as AppContextType;
    const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
    const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    const calendarColorMap = useMemo(() => new Map(calendars.map(c => [c.id, c.color])), [calendars]);
    const eventsByDay = useMemo(() => {
        const map = new Map<string, AppEvent[]>();
        for (const event of displayedEvents) {
            if (!map.has(event.date)) map.set(event.date, []);
            map.get(event.date)!.push(event);
        }
        return map;
    }, [displayedEvents]);

    const handleSlotClick = (date: Date, hour: number) => {
        onTimeSlotClick(toYYYYMMDD(date), `${String(hour).padStart(2, '0')}:00`);
    };

    const now = getSyncedTime();

    return (
        <div className="flex-grow p-4 pt-0 overflow-auto pb-28">
            <div className="grid grid-cols-[auto,1fr] grid-rows-[auto,1fr]">
                {/* Cabeçalho com os dias da semana */}
                <div className="col-start-2 col-end-3 grid grid-cols-7 text-center sticky top-0 bg-windows-bg-light dark:bg-windows-bg-dark z-20">
                    {weekDays.map((day, index) => {
                        const dateStr = toYYYYMMDD(day);
                        const dayEvents = eventsByDay.get(dateStr) || [];
                        const allDayEvents = dayEvents.filter(e => e.isAllDay);
                        return (
                            <div key={index} className="py-2 border-b-2 border-windows-border-light dark:border-windows-border-dark">
                                <p className="text-sm text-windows-text-secondary-light dark:text-windows-text-secondary-dark">{daysOfWeek[index]}</p>
                                <p className={`text-xl font-bold mt-1 w-10 h-10 flex items-center justify-center rounded-full mx-auto ${isToday(day, today) ? 'bg-windows-accent text-white' : 'text-windows-text-primary-light dark:text-windows-text-primary-dark'}`}>
                                    {day.getDate()}
                                </p>
                                <div className="h-8 px-1 mt-1 overflow-hidden">
                                  {allDayEvents.map(event => (
                                      <EventCard key={event.id} event={event} onEventClick={onEventClick} calendarColorMap={calendarColorMap} now={now} />
                                  ))}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <HoursTimeline />

                {/* Grade de horários e eventos */}
                <div className="col-start-2 col-end-3 row-start-2 row-end-3 grid grid-cols-7 border-l border-windows-border-light dark:border-windows-border-dark">
                    {weekDays.map((day, dayIndex) => {
                        const dayEvents = eventsByDay.get(toYYYYMMDD(day)) || [];
                        const timedEventsWithLayout = getEventsWithLayout(dayEvents.filter(e => !e.isAllDay));
                        return (
                            <div key={dayIndex} className="relative border-r border-windows-border-light dark:border-windows-border-dark bg-windows-content-light dark:bg-windows-content-dark">
                                 {Array.from({ length: 24 }, (_, hour) => (
                                    <div key={hour} className="h-[60px] border-b border-windows-border-light dark:border-windows-border-dark cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSlotClick(day, hour)}></div>
                                ))}
                                {timedEventsWithLayout.map(event => (
                                    <EventCard key={event.id} event={event} onEventClick={onEventClick} calendarColorMap={calendarColorMap} now={now} />
                                ))}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

/**
 * Componente que renderiza a visualização de Dia.
 */
const DayView: React.FC<{ 
    currentDate: Date,
    displayedEvents: AppEvent[];
    onEventClick: (event: AppEvent) => void,
    onTimeSlotClick: (date: string, time: string) => void
}> = ({ currentDate, displayedEvents, onEventClick, onTimeSlotClick }) => {
    const { calendars, getSyncedTime } = useContext(AppContext) as AppContextType;
    
    const calendarColorMap = useMemo(() => new Map(calendars.map(c => [c.id, c.color])), [calendars]);
    const dayEventsWithLayout = getEventsWithLayout(displayedEvents);
    const now = getSyncedTime();
    
    const allDayEvents = dayEventsWithLayout.filter(e => e.isAllDay);
    const timedEvents = dayEventsWithLayout.filter(e => !e.isAllDay);


    const handleSlotClick = (hour: number) => {
        onTimeSlotClick(toYYYYMMDD(currentDate), `${String(hour).padStart(2, '0')}:00`);
    };

    return (
        <div className="flex-grow p-4 pt-0 overflow-auto pb-28">
            <div className="grid grid-cols-[auto,1fr] grid-rows-[auto,1fr]">
                <div className="col-start-2 col-end-3 sticky top-0 bg-windows-bg-light dark:bg-windows-bg-dark z-20 border-b-2 border-windows-border-light dark:border-windows-border-dark p-1 h-[60px]">
                    <p className="text-sm text-windows-text-secondary-light dark:text-windows-text-secondary-dark mb-1 ml-2">Dia todo</p>
                    <div className="h-full overflow-y-auto">
                      {allDayEvents.map(event => (
                         <EventCard key={event.id} event={event} onEventClick={onEventClick} calendarColorMap={calendarColorMap} now={now} />
                      ))}
                    </div>
                </div>
                <HoursTimeline />
                <div className="col-start-2 col-end-3 row-start-2 row-end-3 border-l border-windows-border-light dark:border-windows-border-dark">
                     <div className="relative border-r border-windows-border-light dark:border-windows-border-dark bg-windows-content-light dark:bg-windows-content-dark">
                        {Array.from({ length: 24 }, (_, hour) => (
                            <div key={hour} className="h-[60px] border-b border-windows-border-light dark:border-windows-border-dark cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSlotClick(hour)}></div>
                        ))}
                        {timedEvents.map(event => (
                            <EventCard key={event.id} event={event} onEventClick={onEventClick} calendarColorMap={calendarColorMap} now={now} />
                        ))}
                     </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Interface para as propriedades do componente CalendarView.
 * @param todayTrigger - Um número que, ao ser alterado, força a navegação para o dia de hoje.
 */
interface CalendarViewProps {
  todayTrigger: number;
}

// --- COMPONENTE PRINCIPAL DA TELA DE CALENDÁRIO ---
const CalendarView: React.FC<CalendarViewProps> = ({ todayTrigger }) => {
  const { events, calendars, logDebug, getSyncedTime, openEventModal } = useContext(AppContext) as AppContextType;
  
  // --- ESTADOS INTERNOS ---
  const [currentDate, setCurrentDate] = useState(() => getSyncedTime());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [animation, setAnimation] = useState({ key: Date.now(), dir: 'none' as 'next' | 'prev' | 'none' });
  const today = useMemo(() => getSyncedTime(), [getSyncedTime]);
  const [dayEventsModalDate, setDayEventsModalDate] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<Map<string, WeatherInfo>>(new Map());
  const [coords, setCoords] = useState<{lat: number, lon: number} | null>(null);
  // Estado para controlar a interação de arrastar (swipe).
  const dragState = useRef({ isPointerDown: false, startX: 0, moved: false });

  // --- MEMOS PARA OTIMIZAÇÃO ---
  const visibleCalendarIds = useMemo(() => new Set(calendars.filter(c => c.isVisible).map(c => c.id)), [calendars]);
  const visibleEvents = useMemo(() => events.filter(e => visibleCalendarIds.has(e.calendarId)), [events, visibleCalendarIds]);

  // Calcula a janela de visualização e expande os eventos recorrentes. Este é um dos cálculos mais importantes.
  const displayedEvents = useMemo(() => {
    logDebug(`Recalculando eventos para a visão '${viewMode}'...`);
    let viewStart: Date, viewEnd: Date;
    
    if (viewMode === 'month') {
        viewStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        viewStart.setDate(viewStart.getDate() - viewStart.getDay());
        viewEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        viewEnd.setDate(viewEnd.getDate() + (6 - viewEnd.getDay()));
    } else if (viewMode === 'week') {
        const week = getWeekDays(currentDate);
        viewStart = week[0];
        viewEnd = week[6];
    } else { // day
        viewStart = new Date(currentDate);
        viewEnd = new Date(currentDate);
    }
    viewStart.setHours(0, 0, 0, 0);
    viewEnd.setHours(23, 59, 59, 999);

    return expandRecurringEvents(visibleEvents, viewStart, viewEnd);
  }, [visibleEvents, currentDate, viewMode, logDebug]);

  // --- EFEITOS (LÓGICA ASSÍNCRONA) ---

  // Efeito para obter a geolocalização do usuário para a previsão do tempo.
  useEffect(() => {
    logDebug("Tentando obter geolocalização do navegador.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        logDebug("Geolocalização obtida com sucesso.", position.coords);
        setCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        logDebug(`Erro ao obter geolocalização: ${error.message}. A previsão do tempo ficará desabilitada.`);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 1000 * 60 * 30 }
    );
  }, [logDebug]);

  // Efeito para buscar os dados da previsão do tempo quando as coordenadas ou a data mudam.
  useEffect(() => {
    if (!coords || viewMode !== 'month') {
      setWeatherData(new Map());
      return;
    }

    const fetchWeather = async () => {
      logDebug(`Buscando previsão do tempo para as coordenadas:`, coords);
      
      try {
        const { lat, lon } = coords;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const startDate = toYYYYMMDD(new Date(year, month, 1));
        const endDate = toYYYYMMDD(new Date(year, month + 1, 0));

        const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max&timezone=auto&start_date=${startDate}&end_date=${endDate}`;
        const forecastResponse = await fetch(forecastUrl);
        if (!forecastResponse.ok) {
          throw new Error(`Falha na API de previsão: ${forecastResponse.status} - ${forecastResponse.statusText}`);
        }
        const forecastData = await forecastResponse.json();

        const newWeatherData = new Map<string, WeatherInfo>();
        if (forecastData.daily && forecastData.daily.time) {
          forecastData.daily.time.forEach((dateStr: string, index: number) => {
            const code = forecastData.daily.weathercode[index];
            const temp = forecastData.daily.temperature_2m_max[index];
            const weatherInfo = wmoCodeToWeather(code);

            newWeatherData.set(dateStr, {
              temp: temp,
              icon: weatherInfo.icon,
              description: weatherInfo.description,
            });
          });
        }
        
        setWeatherData(newWeatherData);
        logDebug(`Previsão do tempo do Open-Meteo carregada para ${newWeatherData.size} dias.`);

      } catch (error: any) {
        logDebug("Erro ao buscar previsão do tempo com Open-Meteo:", error.message);
        setWeatherData(new Map()); // Limpa os dados em caso de erro
      }
    };

    fetchWeather();
  }, [coords, viewMode, logDebug, currentDate]);

  // --- MANIPULADORES DE EVENTOS (HANDLERS) ---

  const handlePrev = useCallback(() => {
    logDebug(`Navegando para período anterior na visão '${viewMode}'.`);
    setAnimation({ key: Date.now(), dir: 'prev' });
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
      else if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
      else newDate.setDate(newDate.getDate() - 1);
      return newDate;
    });
  }, [logDebug, viewMode]);

  const handleNext = useCallback(() => {
    logDebug(`Navegando para próximo período na visão '${viewMode}'.`);
    setAnimation({ key: Date.now(), dir: 'next' });
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
      else if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
      else newDate.setDate(newDate.getDate() + 1);
      return newDate;
    });
  }, [logDebug, viewMode]);

  const handleToday = useCallback(() => {
    logDebug("Navegando para 'Hoje'.");
    const todayDate = getSyncedTime();
    
    setCurrentDate(current => {
        const isAlreadyOnTodayView =
            (viewMode === 'day' && toYYYYMMDD(todayDate) === toYYYYMMDD(current)) ||
            (viewMode === 'week' && getWeekDays(todayDate)[0].toDateString() === getWeekDays(current)[0].toDateString()) ||
            (viewMode === 'month' && todayDate.getFullYear() === current.getFullYear() && todayDate.getMonth() === current.getMonth());

        setAnimation({ key: Date.now(), dir: isAlreadyOnTodayView ? 'none' : todayDate > current ? 'next' : 'prev' });

        if (!isAlreadyOnTodayView) return todayDate;
        return current;
    });
  }, [logDebug, getSyncedTime, viewMode]);

  useEffect(() => {
    if (todayTrigger > 0) handleToday();
  }, [todayTrigger, handleToday]);
  
  const handleEventClick = (event: AppEvent) => {
    logDebug(`Evento '${event.title}' clicado.`);
    openEventModal(event);
  };

  const handleTimeSlotClick = (date: string, startTime: string) => {
    logDebug(`Slot de tempo clicado: ${date} às ${startTime}`);
    openEventModal(null, date, startTime);
  };
  
  const handleDayEventsClick = useCallback((date: string) => {
      logDebug(`Dia ${date} clicado para ver a lista de eventos.`);
      setDayEventsModalDate(date);
  }, [logDebug]);
  
  // Lógica para diferenciar clique de arrastar
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Ignora botões do mouse que não sejam o principal
    dragState.current = { isPointerDown: true, startX: e.clientX, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId); // Captura o ponteiro para o elemento atual
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.isPointerDown) return;
    // Se o ponteiro se moveu mais de 10 pixels, considera que o usuário está arrastando
    if (Math.abs(e.clientX - dragState.current.startX) > 10) {
      dragState.current.moved = true;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState.current.isPointerDown) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    const deltaX = e.clientX - dragState.current.startX;

    if (dragState.current.moved) {
      // Se foi um gesto de arrastar, navega para o mês anterior/posterior
      if (deltaX < -50) handleNext();
      else if (deltaX > 50) handlePrev();
    } else {
      // Se não houve movimento significativo, trata como um clique no dia
      const dayCell = (e.target as HTMLElement).closest('[data-date-str]');
      const dateStr = dayCell?.getAttribute('data-date-str');
      if (dateStr) {
        handleDayEventsClick(dateStr);
      }
    }
    dragState.current.isPointerDown = false; // Reseta o estado do arraste
  };

  // Seleciona o componente de visualização correto (Mês, Semana, Dia)
  const CurrentViewComponent = {
      month: MonthView,
      week: WeekView,
      day: DayView,
  }[viewMode];
  
  return (
    <div className="h-full flex flex-col bg-windows-bg-light dark:bg-windows-bg-dark text-windows-text-primary-light dark:text-windows-text-primary-dark select-none overflow-hidden">
      <CalendarHeader
        currentDate={currentDate}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onDateSet={(date) => setCurrentDate(date)}
      />
      
      <div 
          className="flex-grow relative overflow-hidden flex flex-col"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: 'pan-y' }} // Permite rolagem vertical nativa em dispositivos de toque
      >
        <div 
            key={animation.key} // A chave muda para reiniciar a animação
            className={`w-full flex flex-col flex-grow 
              ${animation.dir !== 'none' ? (animation.dir === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left') : ''}`}
        >
            <CurrentViewComponent 
                currentDate={currentDate} 
                today={today}
                displayedEvents={displayedEvents}
                {...(viewMode === 'month' && { weatherData: weatherData })}
                {...(viewMode !== 'month' && { onEventClick: handleEventClick, onTimeSlotClick: handleTimeSlotClick })}
            />
        </div>
      </div>
      
      {dayEventsModalDate && (
          <DayEventsListModal 
            isOpen={!!dayEventsModalDate}
            onClose={() => setDayEventsModalDate(null)}
            date={dayEventsModalDate}
            dayEvents={displayedEvents.filter(e => e.date === dayEventsModalDate)}
          />
      )}
    </div>
  );
};

export default CalendarView;