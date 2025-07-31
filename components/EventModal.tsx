import React, { useState, useEffect, useContext } from 'react';
import { AppEvent, AppContextType, AppEventAlert, EventRepeat } from '../types';
import { AppContext } from '../App';
import { ICONS } from '../constants';
import ConfirmationModal from './ConfirmationModal';

/**
 * Interface para as propriedades do componente EventModal.
 * @param isOpen - Controla se o modal está visível.
 * @param onClose - Função para fechar o modal.
 * @param event - O evento a ser editado, ou `null` se for um novo evento.
 * @param initialDate - A data inicial para um novo evento (formato AAAA-MM-DD).
 * @param initialStartTime - A hora inicial para um novo evento.
 */
interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: AppEvent | null;
  initialDate: string;
  initialStartTime?: string;
}

/**
 * Componente de modal para criar ou editar um evento.
 * Lida com toda a lógica de formulário, validação e submissão.
 */
const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, event, initialDate, initialStartTime }) => {
  // Acessa o contexto global da aplicação.
  const { calendars, addEvent, updateEvent, deleteEvent, logDebug } = useContext(AppContext) as AppContextType;

  // --- ESTADOS DO FORMULÁRIO ---
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [selectedCalendarId, setSelectedCalendarId] = useState('');
  const [alerts, setAlerts] = useState<AppEventAlert[]>([]);
  const [location, setLocation] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [repeat, setRepeat] = useState<EventRepeat | undefined>(undefined);

  // Estados para o formulário de adição de novo alerta.
  const [newAlertValue, setNewAlertValue] = useState<number>(15);
  const [newAlertUnit, setNewAlertUnit] = useState<AppEventAlert['unit']>('minutes');

  // --- ESTADOS DE CONTROLE ---
  // Salva o estado inicial do evento para detectar se há alterações não salvas.
  const [initialState, setInitialState] = useState<Omit<AppEvent, 'id' | 'isCompleted'>>({ title: '', description: '', date: '', startTime: '', calendarId: '', alerts: [], location: '', isAllDay: false, repeat: undefined });
  // `isDirty` é true se o estado atual for diferente do inicial.
  const [isDirty, setIsDirty] = useState(false);
  // Controla a visibilidade do modal de confirmação para fechar com alterações pendentes.
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  // Armazena erros de validação do formulário.
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  /**
   * Efeito para inicializar o estado do formulário quando o modal é aberto.
   * Preenche os campos com os dados do evento (se estiver editando) ou com valores padrão (se for novo).
   */
  useEffect(() => {
    if (!isOpen) return;
    logDebug('Modal de evento aberto.', { event, initialDate, initialStartTime });

    // Define o estado inicial baseado se é um evento novo ou uma edição.
    const state = {
        title: event?.title || '',
        description: event?.description || '',
        date: event?.date || initialDate,
        startTime: event?.startTime || initialStartTime || '09:00',
        calendarId: event?.calendarId || (calendars.find(c => c.isVisible)?.id || calendars[0]?.id || ''),
        alerts: event?.alerts?.map(a => ({...a})) || [], // Cria cópias dos alertas
        location: event?.location || '',
        isAllDay: event?.isAllDay || false,
        repeat: event?.repeat ? { ...event.repeat } : undefined, // Cria cópia do objeto de repetição
    };

    // Atualiza os estados dos campos do formulário.
    setTitle(state.title);
    setDescription(state.description);
    setDate(state.date);
    setStartTime(state.startTime);
    setSelectedCalendarId(state.calendarId);
    setAlerts(state.alerts);
    setLocation(state.location);
    setIsAllDay(state.isAllDay);
    setRepeat(state.repeat);
    setValidationErrors([]);

    // Salva o estado inicial para comparar e detectar alterações.
    setInitialState({ ...state });
    setIsDirty(false);
  }, [event, calendars, isOpen, initialDate, initialStartTime, logDebug]);

  /**
   * Efeito para detectar se o formulário foi alterado pelo usuário ("dirty checking").
   * Compara o estado atual dos campos com o estado inicial salvo.
   */
  useEffect(() => {
    if (!isOpen) return;
    const currentState = { title, description, date, startTime, calendarId: selectedCalendarId, alerts, location, isAllDay, repeat };
    // Ordena os alertas para garantir uma comparação de string consistente, já que a ordem no array não importa.
    const sortedInitialAlerts = [...initialState.alerts || []].sort((a,b) => a.id.localeCompare(b.id));
    const sortedCurrentAlerts = [...alerts].sort((a,b) => a.id.localeCompare(b.id));

    const initialComparable = { ...initialState, alerts: sortedInitialAlerts };
    const currentComparable = { ...currentState, alerts: sortedCurrentAlerts };

    // Compara os JSONs dos objetos. Se forem diferentes, o formulário está "sujo".
    setIsDirty(JSON.stringify(currentComparable) !== JSON.stringify(initialComparable));
  }, [title, description, date, startTime, selectedCalendarId, alerts, location, isAllDay, repeat, initialState, isOpen]);

  if (!isOpen) return null;

  /**
   * Manipulador para submeter o formulário (criar ou atualizar evento).
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação simples
    const errors: string[] = [];
    if (!title.trim()) errors.push('title');
    if (!selectedCalendarId) errors.push('calendarId');
    
    setValidationErrors(errors);

    if (errors.length > 0) {
      logDebug('Falha na validação do formulário de evento.', { errors });
      return;
    }

    const eventData = {
      title,
      description,
      startTime: isAllDay ? '00:00' : startTime,
      date,
      calendarId: selectedCalendarId,
      alerts,
      location,
      isAllDay,
      repeat
    };
    
    logDebug('Enviando formulário de evento.', { isEditing: !!event, data: eventData });

    if (event) { // Editando evento existente
      updateEvent({ ...eventData, id: event.id, isCompleted: event.isCompleted });
    } else { // Criando novo evento
      addEvent(eventData);
    }
    onClose();
  };
  
  /**
   * Manipulador para o botão de fechar.
   * Se houver alterações não salvas, exibe um modal de confirmação.
   */
  const handleClose = () => {
    logDebug('Tentativa de fechar o modal de evento.');
    if (isDirty) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  /**
   * Manipulador para confirmar o fechamento, descartando as alterações.
   */
  const handleConfirmClose = () => {
    logDebug('Modal de evento fechado com descarte de alterações.');
    setShowCloseConfirm(false);
    onClose();
  };
  
  /**
   * Manipulador para deletar o evento (disponível apenas no modo de edição).
   */
  const handleDelete = () => {
    if (event) {
      logDebug(`Exclusão imediata do evento ID: ${event.id}`);
      deleteEvent(event.id);
      onClose();
    }
  };

  /**
   * Converte a unidade de tempo do alerta para uma string legível.
   */
  const alertUnitToLabel = (unit: AppEventAlert['unit']) => {
    const labels = { minutes: 'minuto(s)', hours: 'hora(s)', days: 'dia(s)', weeks: 'semana(s)', months: 'mês(es)', years: 'ano(s)' };
    return labels[unit];
  }

  /**
   * Adiciona um novo alerta à lista de alertas do evento.
   */
  const handleAddAlert = () => {
    if (newAlertValue > 0) {
      const newAlert: AppEventAlert = {
        id: `alert-${Date.now()}`,
        value: newAlertValue,
        unit: newAlertUnit,
      };
      setAlerts(prev => [...prev, newAlert]);
      // Reseta o formulário de alerta
      setNewAlertValue(15);
      setNewAlertUnit('minutes');
    }
  };

  /**
   * Remove um alerta da lista.
   */
  const handleRemoveAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };


  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity duration-300">
        <div className="bg-windows-content-light dark:bg-windows-content-dark rounded-xl shadow-2xl w-full max-w-md m-4 transform transition-all duration-300 scale-95 animate-in fade-in zoom-in-95">
          <div className="max-h-[90vh] overflow-y-auto p-6">
            {/* Cabeçalho do modal */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-windows-text-primary-light dark:text-windows-text-primary-dark">
                {event ? 'Editar Evento' : 'Novo Evento'}
              </h2>
              <button onClick={handleClose} className="text-windows-text-secondary-light dark:text-windows-text-secondary-dark hover:bg-slate-200 dark:hover:bg-slate-700 p-1 rounded-full">
                <ICONS.x className="w-6 h-6" />
              </button>
            </div>
            {/* Formulário de evento */}
            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-4">
                {/* Campo de Título */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-windows-text-secondary-light dark:text-windows-text-secondary-dark mb-1">Título</label>
                  <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (validationErrors.includes('title')) {
                        setValidationErrors(errors => errors.filter(err => err !== 'title'));
                      }
                    }}
                    className={`w-full bg-slate-100 dark:bg-slate-800 border rounded-md p-2 focus:ring-2 focus:ring-windows-accent focus:outline-none text-windows-text-primary-light dark:text-windows-text-primary-dark ${
                      validationErrors.includes('title') ? 'border-red-500 animate-shake' : 'border-windows-border-light dark:border-windows-border-dark'
                    }`}
                    required
                    placeholder="Adicione um título"
                  />
                </div>
                {/* Campo de Localização */}
                <div>
                    <label htmlFor="location" className="block text-sm font-medium text-windows-text-secondary-light dark:text-windows-text-secondary-dark mb-1">Local</label>
                    <input type="text" id="location" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800 border border-windows-border-light dark:border-windows-border-dark rounded-md p-2 focus:ring-2 focus:ring-windows-accent focus:outline-none text-windows-text-primary-light dark:text-windows-text-primary-dark" placeholder="Adicione um local"/>
                </div>
                {/* Opção "Dia todo" */}
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="isAllDay" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-windows-accent focus:ring-windows-accent" />
                    <label htmlFor="isAllDay" className="text-sm font-medium text-windows-text-secondary-light dark:text-windows-text-secondary-dark">Dia todo</label>
                </div>
                {/* Campos de Data e Hora */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-windows-text-secondary-light dark:text-windows-text-secondary-dark mb-1">Data</label>
                    <input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800 border border-windows-border-light dark:border-windows-border-dark rounded-md p-2 focus:ring-2 focus:ring-windows-accent focus:outline-none text-windows-text-primary-light dark:text-windows-text-primary-dark" required />
                  </div>
                  {!isAllDay && (
                    <div>
                        <label htmlFor="startTime" className="block text-sm font-medium text-windows-text-secondary-light dark:text-windows-text-secondary-dark mb-1">Hora</label>
                        <input type="time" id="startTime" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800 border border-windows-border-light dark:border-windows-border-dark rounded-md p-2 focus:ring-2 focus:ring-windows-accent focus:outline-none text-windows-text-primary-light dark:text-windows-text-primary-dark" required />
                    </div>
                  )}
                </div>
                {/* Seção de Repetição */}
                <div>
                  <label className="block text-sm font-medium text-windows-text-secondary-light dark:text-windows-text-secondary-dark mb-1">Repetir</label>
                  <div className="flex flex-col gap-2">
                    <select
                      id="repeat-frequency"
                      value={repeat?.frequency || 'none'}
                      onChange={(e) => {
                          const newFrequency = e.target.value as EventRepeat['frequency'] | 'none';
                          if (newFrequency === 'none') {
                              setRepeat(undefined);
                          } else {
                              setRepeat({ frequency: newFrequency, interval: repeat?.interval || 1 });
                          }
                      }}
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-windows-border-light dark:border-windows-border-dark rounded-md p-2 focus:ring-2 focus:ring-windows-accent focus:outline-none"
                    >
                      <option value="none">Não repetir</option>
                      <option value="daily">Diariamente</option>
                      <option value="weekly">Semanalmente</option>
                      <option value="monthly">Mensalmente</option>
                      <option value="yearly">Anualmente</option>
                    </select>
                    {repeat && (
                      <div className="flex items-center gap-2 text-sm text-windows-text-primary-light dark:text-windows-text-primary-dark animate-in fade-in duration-300 pl-1">
                          <span>Repetir a cada</span>
                          <input
                              type="number"
                              value={repeat.interval}
                              onChange={(e) => setRepeat(r => r ? { ...r, interval: Math.max(1, parseInt(e.target.value, 10) || 1) } : undefined)}
                              min="1"
                              className="w-20 bg-slate-100 dark:bg-slate-800 border border-windows-border-light dark:border-windows-border-dark rounded-md p-2 text-center focus:ring-2 focus:ring-windows-accent focus:outline-none"
                          />
                          <span>
                              {
                                  ((interval: number, frequency: EventRepeat['frequency']) => {
                                      const isPlural = interval > 1;
                                      switch(frequency){
                                          case 'daily': return isPlural ? 'dias' : 'dia';
                                          case 'weekly': return isPlural ? 'semanas' : 'semana';
                                          case 'monthly': return isPlural ? 'meses' : 'mês';
                                          case 'yearly': return isPlural ? 'anos' : 'ano';
                                      }
                                  })(repeat.interval, repeat.frequency)
                              }.
                          </span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Seletor de Calendário */}
                <div>
                  <label className="block text-sm font-medium text-windows-text-secondary-light dark:text-windows-text-secondary-dark mb-2">Calendário</label>
                  <div className={`flex flex-wrap gap-2 p-2 rounded-lg ${validationErrors.includes('calendarId') ? 'border border-red-500 animate-shake' : ''}`}>
                    {calendars.filter(c => c.isVisible).map(cal => {
                      const isHex = cal.color.startsWith('#');
                      return (
                        <button
                          key={cal.id}
                          type="button"
                          onClick={() => {
                            setSelectedCalendarId(cal.id);
                            if (validationErrors.includes('calendarId')) {
                              setValidationErrors(errors => errors.filter(err => err !== 'calendarId'));
                            }
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                            selectedCalendarId === cal.id
                              ? `bg-windows-accent text-white ring-2 ring-offset-2 ring-offset-windows-content-light dark:ring-offset-windows-content-dark ring-windows-accent`
                              : `bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-windows-text-primary-light dark:text-windows-text-primary-dark`
                          }`}
                        >
                          <span 
                            className={`w-3 h-3 rounded-full ${isHex ? '' : cal.color}`}
                            style={isHex ? { backgroundColor: cal.color } : {}}
                          ></span>
                          {cal.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                 {/* Seção de Alertas */}
                <div>
                    <label className="block text-sm font-medium text-windows-text-secondary-light dark:text-windows-text-secondary-dark mb-1">Alertas</label>
                    <div className="space-y-2">
                        {alerts.map((alert) => (
                        <div key={alert.id} className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded-md animate-in fade-in duration-300">
                            <span className="text-sm text-windows-text-primary-light dark:text-windows-text-primary-dark">
                            Lembrar {alert.value} {alertUnitToLabel(alert.unit)} antes
                            </span>
                            <button type="button" onClick={() => handleRemoveAlert(alert.id)} className="text-red-500 hover:bg-red-500/10 p-1 rounded-full">
                            <ICONS.x className="w-4 h-4" />
                            </button>
                        </div>
                        ))}
                         {alerts.length === 0 && <p className="text-xs text-center text-slate-400 dark:text-slate-500 py-2">Nenhum alerta adicionado.</p>}
                    </div>
                    <div className="mt-2 flex items-center gap-2 p-2 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg">
                        <input
                            type="number"
                            value={newAlertValue}
                            onChange={(e) => setNewAlertValue(parseInt(e.target.value, 10) || 1)}
                            min="1"
                            className="w-20 bg-white dark:bg-slate-900 border border-windows-border-light dark:border-windows-border-dark rounded-md p-2 focus:ring-2 focus:ring-windows-accent focus:outline-none"
                        />
                        <select
                            value={newAlertUnit}
                            onChange={(e) => setNewAlertUnit(e.target.value as AppEventAlert['unit'])}
                            className="flex-grow bg-white dark:bg-slate-900 border border-windows-border-light dark:border-windows-border-dark rounded-md p-2 focus:ring-2 focus:ring-windows-accent focus:outline-none"
                        >
                        <option value="minutes">Minutos</option>
                        <option value="hours">Horas</option>
                        <option value="days">Dias</option>
                        <option value="weeks">Semanas</option>
                        <option value="months">Meses</option>
                        <option value="years">Anos</option>
                        </select>
                        <button type="button" onClick={handleAddAlert} title="Adicionar Alerta" className="p-2 text-sm font-semibold rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                            <ICONS.plus className="w-5 h-5"/>
                        </button>
                    </div>
                </div>

                {/* Campo de Descrição */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-windows-text-secondary-light dark:text-windows-text-secondary-dark mb-1">Descrição</label>
                  <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-slate-100 dark:bg-slate-800 border border-windows-border-light dark:border-windows-border-dark rounded-md p-2 focus:ring-2 focus:ring-windows-accent focus:outline-none text-windows-text-primary-light dark:text-windows-text-primary-dark" placeholder="Adicione detalhes sobre o seu evento..."></textarea>
                </div>
              </div>
              {/* Botões de Ação */}
              <div className="mt-6 flex items-center justify-end space-x-3">
                {event && ( // Botão de excluir só aparece no modo de edição
                    <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-semibold rounded-md text-red-600 hover:bg-red-500/10 transition-colors mr-auto">
                        Excluir
                    </button>
                )}
                <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-semibold rounded-md bg-slate-200 dark:bg-slate-700 text-windows-text-primary-light dark:text-windows-text-primary-dark hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold rounded-md bg-windows-accent text-white hover:opacity-90 transition-opacity">
                  {event ? 'Salvar Alterações' : 'Criar Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      {/* Modal de Confirmação para fechar com alterações pendentes */}
      <ConfirmationModal
        isOpen={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={handleConfirmClose}
        title="Descartar Alterações?"
        confirmText="Descartar"
        message="Você tem alterações não salvas. Tem certeza que deseja fechar e descartar as mudanças?"
      />
    </>
  );
};

export default EventModal;