import React, { useContext } from 'react';
import { AppContextType, AppEvent } from '../types';
import { AppContext } from '../App';
import { ICONS } from '../constants';

/**
 * Interface para as propriedades do componente DayEventsListModal.
 * @param isOpen - Controla se o modal está visível.
 * @param onClose - Função para fechar o modal.
 * @param date - A data dos eventos a serem listados (formato AAAA-MM-DD).
 * @param dayEvents - Um array com todos os eventos (incluindo ocorrências de eventos repetidos) para o dia especificado.
 */
interface DayEventsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  dayEvents: AppEvent[];
}

/**
 * Componente de modal que exibe uma lista detalhada dos eventos de um dia específico.
 * É aberto ao clicar em um dia na visualização de Mês.
 * Permite visualizar detalhes do evento e clicar para abrir o modal de edição.
 */
const DayEventsListModal: React.FC<DayEventsListModalProps> = ({ isOpen, onClose, date, dayEvents }) => {
  // Acessa o contexto global para obter dados dos calendários e funções.
  const { calendars, getSyncedTime, openEventModal, logDebug } = useContext(AppContext) as AppContextType;

  // Se o modal não estiver aberto, não renderiza nada.
  if (!isOpen) return null;

  // Ordena os eventos do dia: eventos de "Dia todo" primeiro, depois por hora de início.
  const sortedEvents = [...dayEvents].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return a.startTime.localeCompare(b.startTime);
  });

  const now = getSyncedTime(); // Obtém a hora atual para estilizar eventos passados.
  const calendarMap = new Map(calendars.map(c => [c.id, c])); // Mapa para acesso rápido aos dados do calendário pela ID.
  
  // Formata a data para ser exibida no cabeçalho do modal de forma amigável.
  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  /**
   * Manipulador para o botão de adicionar novo evento.
   * Abre o modal de evento, pré-preenchendo a data selecionada.
   */
  const handleAddNewEvent = () => {
    logDebug(`Adicionando novo evento para a data ${date} a partir da lista.`);
    openEventModal(null, date); // Passa `null` para indicar que é um novo evento.
    onClose(); // Fecha o modal de lista após abrir o de edição/criação.
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity duration-300">
      <div className="bg-windows-content-light dark:bg-windows-content-dark rounded-xl shadow-2xl w-full max-w-md m-4 transform transition-all duration-300 scale-95 animate-in fade-in zoom-in-95">
        <div className="p-6">
          {/* Cabeçalho do Modal */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <div>
                  <h2 className="text-xl font-bold text-windows-text-primary-light dark:text-windows-text-primary-dark capitalize">
                    Eventos
                  </h2>
                  <p className="text-sm text-windows-text-secondary-light dark:text-windows-text-secondary-dark">{formattedDate}</p>
              </div>
              <button
                onClick={handleAddNewEvent}
                className="p-2 bg-slate-200 dark:bg-slate-700 rounded-full text-windows-accent hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                aria-label="Adicionar novo evento"
                title="Adicionar novo evento"
              >
                  <ICONS.plus className="w-5 h-5"/>
              </button>
            </div>
            <button onClick={onClose} className="text-windows-text-secondary-light dark:text-windows-text-secondary-dark hover:bg-slate-200 dark:hover:bg-slate-700 p-1 rounded-full">
              <ICONS.x className="w-6 h-6" />
            </button>
          </div>
          
          {/* Lista de Eventos */}
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {sortedEvents.length > 0 ? (
              sortedEvents.map(event => {
                const eventDateTime = new Date(`${event.date}T${event.startTime}`);
                const isPast = !event.isAllDay && eventDateTime < now;
                const calendar = calendarMap.get(event.calendarId);

                return (
                  <button
                    key={event.id}
                    onClick={() => openEventModal(event)} // Abre o modal de edição para este evento
                    className={`w-full flex items-start gap-4 text-left p-3 rounded-lg transition-all duration-200 ${isPast ? 'opacity-60' : ''} ${event.isCompleted ? 'bg-slate-100 dark:bg-slate-800' : ''} hover:bg-slate-100 dark:hover:bg-slate-800`}
                  >
                    <div className="flex-shrink-0 pt-1">
                      <div className={`text-sm font-semibold text-windows-accent dark:text-blue-400 w-16 text-center ${event.isCompleted ? 'line-through' : ''}`}>
                          {event.isAllDay ? "Dia todo" : event.startTime}
                      </div>
                    </div>
                    {/* Barra de cor do calendário */}
                    <div 
                      className={`w-1.5 self-stretch rounded-full ${!calendar?.color.startsWith('#') ? calendar?.color : ''}`}
                      style={{ backgroundColor: calendar?.color.startsWith('#') ? calendar.color : undefined }}
                    ></div>
                    <div className="flex-grow min-w-0">
                        <p className={`font-semibold text-windows-text-primary-light dark:text-windows-text-primary-dark ${event.isCompleted ? 'line-through' : ''}`}>{event.title}</p>
                        {event.location && (
                           <div className="flex items-center gap-1.5 text-xs text-windows-text-secondary-light dark:text-windows-text-secondary-dark mt-1">
                                <ICONS.locationPin className="w-3.5 h-3.5 flex-shrink-0"/>
                                <span>{event.location}</span>
                           </div>
                        )}
                        {event.description && (
                            <p className={`text-xs text-windows-text-secondary-light dark:text-windows-text-secondary-dark mt-1 line-clamp-2 ${event.isCompleted ? 'line-through' : ''}`}>
                                {event.description}
                            </p>
                        )}
                        <p className="text-xs text-windows-text-secondary-light dark:text-windows-text-secondary-dark mt-2 font-medium">{calendar?.name || 'Sem calendário'}</p>
                    </div>
                  </button>
                );
              })
            ) : (
              // Mensagem exibida se não houver eventos no dia.
              <p className="text-center text-windows-text-secondary-light dark:text-windows-text-secondary-dark py-8">
                Nenhum evento para este dia.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayEventsListModal;