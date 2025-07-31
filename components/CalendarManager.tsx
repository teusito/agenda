import React, { useState, useContext, useRef } from 'react';
import { AppContextType, Calendar } from '../types';
import { AppContext } from '../App';
import { ICONS, CALENDAR_COLORS } from '../constants';
import ConfirmationModal from './ConfirmationModal';

/**
 * Interface para as propriedades do componente CalendarManager.
 * @param isOpen - Controla se o modal está visível.
 * @param onClose - Função para fechar o modal.
 */
interface CalendarManagerProps {
  isOpen: boolean; 
  onClose: () => void;
}

/**
 * Componente para exibir uma amostra de cor selecionável no formulário.
 * @param color - A cor a ser exibida (pode ser classe Tailwind ou um código hexadecimal).
 * @param isSelected - Indica se esta cor é a atualmente selecionada.
 * @param onClick - Função a ser chamada quando a cor é clicada.
 */
const ColorSwatch: React.FC<{ color: string; isSelected: boolean; onClick: () => void; }> = ({ color, isSelected, onClick }) => {
  const isHex = color.startsWith('#');
  return (
    <button
      type="button"
      onClick={onClick}
      style={isHex ? { backgroundColor: color } : {}}
      className={`w-8 h-8 rounded-full ${isHex ? '' : color} transition-transform transform hover:scale-110 ${isSelected ? 'ring-2 ring-offset-2 ring-windows-accent dark:ring-offset-windows-content-dark' : ''}`}
      aria-label={`Selecionar cor ${color}`}
    />
  );
};

/**
 * Componente de modal para gerenciar os calendários (criar, editar, excluir, alterar visibilidade).
 */
const CalendarManager: React.FC<CalendarManagerProps> = ({ isOpen, onClose }) => {
  // Acessa o contexto global para obter os dados e funções relacionados aos calendários.
  const { calendars, addCalendar, updateCalendar, deleteCalendar, logDebug } = useContext(AppContext) as AppContextType;
  
  // --- ESTADOS INTERNOS ---

  // Estado para o formulário de novo calendário.
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newCalendarColor, setNewCalendarColor] = useState(CALENDAR_COLORS[0]);
  const newColorInputRef = useRef<HTMLInputElement>(null); // Ref para o input de cor personalizado.
  const [isNameInvalid, setIsNameInvalid] = useState(false); // Controle de validação do nome.
  const [showAddForm, setShowAddForm] = useState(false); // Controla a visibilidade do formulário.

  // Estado para a edição de um calendário existente.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedColor, setEditedColor] = useState('');
  const editColorInputRef = useRef<HTMLInputElement>(null); // Ref para o input de cor da edição.

  // Estado para o modal de confirmação de exclusão.
  const [calendarToDelete, setCalendarToDelete] = useState<Calendar | null>(null);

  // Se o modal não estiver aberto, não renderiza nada.
  if (!isOpen) return null;

  /**
   * Manipulador para adicionar um novo calendário.
   * Valida o nome e chama a função `addCalendar` do contexto.
   */
  const handleAddCalendar = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCalendarName.trim()) {
      logDebug(`Adicionando novo calendário: '${newCalendarName.trim()}'`);
      addCalendar({ name: newCalendarName.trim(), color: newCalendarColor });
      // Reseta o formulário após a submissão.
      setNewCalendarName('');
      setNewCalendarColor(CALENDAR_COLORS[0]);
      setIsNameInvalid(false);
      setShowAddForm(false);
    } else {
      setIsNameInvalid(true);
    }
  };

  /**
   * Manipulador para alternar a visibilidade de um calendário.
   * Impede que o último calendário visível seja ocultado para evitar uma tela vazia.
   */
  const handleToggleVisibility = (cal: Calendar) => {
    const visibleCount = calendars.filter(c => c.isVisible).length;
    if (!cal.isVisible || visibleCount > 1) {
        logDebug(`Alternando visibilidade do calendário '${cal.name}' para ${!cal.isVisible}`);
        updateCalendar({ ...cal, isVisible: !cal.isVisible });
    } else {
        logDebug(`Ocultação do calendário '${cal.name}' impedida, pois é o último visível.`);
        alert('Você não pode ocultar o último calendário visível.');
    }
  };
  
  /**
   * Manipulador para iniciar o processo de exclusão.
   * Abre o modal de confirmação para o calendário selecionado.
   */
  const handleDeleteClick = (cal: Calendar) => {
    logDebug(`Tentativa de exclusão do calendário '${cal.name}' (ID: ${cal.id})`);
    setCalendarToDelete(cal);
  };

  /**
   * Manipulador para confirmar a exclusão do calendário.
   * Chamado pelo modal de confirmação.
   */
  const handleConfirmDelete = () => {
    if (!calendarToDelete) return;
    logDebug(`Exclusão confirmada para o calendário ID: ${calendarToDelete.id}`);
    deleteCalendar(calendarToDelete.id);
    setCalendarToDelete(null); // Fecha o modal de confirmação.
  };

  /**
   * Manipulador para entrar no modo de edição de um calendário.
   * Preenche os estados de edição com os dados do calendário selecionado.
   */
  const handleStartEdit = (cal: Calendar) => {
    logDebug(`Iniciando edição do calendário '${cal.name}' (ID: ${cal.id})`);
    setEditingId(cal.id);
    setEditedName(cal.name);
    setEditedColor(cal.color);
  };

  /**
   * Manipulador para cancelar a edição e retornar ao modo de visualização.
   */
  const handleCancelEdit = () => {
    logDebug(`Edição do calendário ID: ${editingId} cancelada.`);
    setEditingId(null);
  };

  /**
   * Manipulador para salvar as alterações de um calendário em edição.
   */
  const handleSaveEdit = () => {
    if (!editingId || !editedName.trim()) return;
    const originalCalendar = calendars.find(c => c.id === editingId);
    if (!originalCalendar) return;

    const updatedCal = {
      ...originalCalendar,
      name: editedName.trim(),
      color: editedColor,
    };
    
    logDebug(`Salvando alterações para o calendário ID: ${editingId}`, updatedCal);
    updateCalendar(updatedCal);
    setEditingId(null); // Sai do modo de edição.
  };

  // Funções auxiliares para desabilitar botões sob certas condições.
  const isDeletionDisabled = (calId: string) => calendars.length <= 1;
  const isToggleDisabled = (cal: Calendar) => cal.isVisible && calendars.filter(c => c.isVisible).length <= 1;

  /**
   * Componente para exibir a bolinha de cor do calendário na lista.
   */
  const CalendarColorDisplay: React.FC<{color: string}> = ({ color }) => {
    const isHex = color.startsWith('#');
    return (
      <span
        className={`w-4 h-4 rounded-full ${!isHex ? color : ''}`}
        style={isHex ? { backgroundColor: color } : {}}
      ></span>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity duration-300">
        <div className="bg-windows-content-light dark:bg-windows-content-dark rounded-xl shadow-2xl w-full max-w-lg m-4 p-6 transform transition-all duration-300 scale-95 animate-in fade-in zoom-in-95">
          {/* Cabeçalho do Modal */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-windows-text-primary-light dark:text-windows-text-primary-dark">Gerenciar Calendários</h2>
              <button 
                onClick={() => setShowAddForm(s => !s)}
                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Adicionar novo calendário"
              >
                  <ICONS.plus className={`w-5 h-5 transition-transform ${showAddForm ? 'rotate-45' : ''}`} />
              </button>
            </div>
            <button onClick={onClose} className="text-windows-text-secondary-light dark:text-windows-text-secondary-dark hover:bg-slate-200 dark:hover:bg-slate-700 p-1 rounded-full">
              <ICONS.x className="w-6 h-6" />
            </button>
          </div>

          {/* Lista de Calendários */}
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
            {calendars.map(cal => (
              <div key={cal.id} className="p-2 rounded-lg">
                {editingId === cal.id ? (
                  // --- Modo de Edição ---
                  <div className="space-y-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <input
                          type="text"
                          value={editedName}
                          onChange={e => setEditedName(e.target.value)}
                          className="flex-grow bg-white dark:bg-slate-900 border border-windows-border-light dark:border-windows-border-dark rounded-md p-1.5 focus:ring-2 focus:ring-windows-accent focus:outline-none text-windows-text-primary-light dark:text-windows-text-primary-dark"
                          autoFocus
                      />
                      <div className="flex items-center gap-1">
                          <button onClick={handleSaveEdit} title="Salvar" className="text-green-500 hover:bg-green-500/10 p-1.5 rounded-md"><ICONS.check className="w-5 h-5" /></button>
                          <button onClick={handleCancelEdit} title="Cancelar" className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-md"><ICONS.x className="w-5 h-5" /></button>
                      </div>
                    </div>
                    {/* Seletor de Cores (Edição) */}
                    <div className="flex flex-wrap items-center gap-2 justify-center pt-2">
                      {CALENDAR_COLORS.map(color => (
                        <ColorSwatch key={color} color={color} isSelected={editedColor === color} onClick={() => setEditedColor(color)} />
                      ))}
                      <div className="relative">
                        <button type="button" onClick={() => editColorInputRef.current?.click()} className={`w-8 h-8 rounded-full border-2 border-dashed border-slate-400 flex items-center justify-center hover:border-windows-accent ${editedColor.startsWith('#') ? 'ring-2 ring-offset-2 ring-windows-accent dark:ring-offset-windows-content-dark' : ''}`}>
                          {editedColor.startsWith('#') ? (
                              <div className="w-full h-full rounded-full" style={{ backgroundColor: editedColor }} />
                          ) : (
                              <ICONS.plus className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <input ref={editColorInputRef} type="color" value={editedColor.startsWith('#') ? editedColor : '#ffffff'} onChange={(e) => setEditedColor(e.target.value)} className="absolute w-0 h-0 opacity-0"/>
                      </div>
                    </div>
                  </div>
                ) : (
                  // --- Modo de Visualização ---
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                    <div className="flex items-center gap-3">
                      <CalendarColorDisplay color={cal.color} />
                      <span className="text-windows-text-primary-light dark:text-windows-text-primary-dark">{cal.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {calendars.length > 1 && (
                          <button onClick={() => handleToggleVisibility(cal)} 
                              title={isToggleDisabled(cal) ? "Não é possível ocultar o último calendário visível" : (cal.isVisible ? "Ocultar calendário" : "Mostrar calendário")} 
                              disabled={isToggleDisabled(cal)}
                              className={`p-1.5 rounded-md ${isToggleDisabled(cal) 
                                  ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                  : 'text-windows-text-secondary-light dark:text-windows-text-secondary-dark hover:text-windows-accent dark:hover:text-windows-accent hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                          >
                              {cal.isVisible ? <ICONS.eye className="w-5 h-5" /> : <ICONS.eyeOff className="w-5 h-5" />}
                          </button>
                      )}
                      <button onClick={() => handleStartEdit(cal)} title="Editar Calendário" className="text-windows-text-secondary-light dark:text-windows-text-secondary-dark hover:text-windows-accent dark:hover:text-windows-accent p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700">
                          <ICONS.edit className="w-5 h-5" />
                      </button>
                      <button 
                          onClick={() => handleDeleteClick(cal)} 
                          disabled={isDeletionDisabled(cal.id)}
                          title={isDeletionDisabled(cal.id) ? 'Não é possível excluir o último calendário' : 'Excluir Calendário'}
                          className={`p-1.5 rounded-md ${isDeletionDisabled(cal.id) 
                              ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed' 
                              : 'text-windows-text-secondary-light dark:text-windows-text-secondary-dark hover:text-red-500 hover:bg-red-500/10'}`}
                      >
                          <ICONS.trash className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Formulário para Adicionar Novo Calendário */}
          {showAddForm && (
            <div className="border-t border-windows-border-light dark:border-windows-border-dark mt-6 pt-6 animate-in fade-in duration-300">
              <h3 className="text-lg font-semibold mb-3 text-windows-text-primary-light dark:text-windows-text-primary-dark">Novo Calendário</h3>
              <form onSubmit={handleAddCalendar} noValidate>
                <input
                  type="text"
                  value={newCalendarName}
                  onChange={(e) => {
                    setNewCalendarName(e.target.value);
                    if (isNameInvalid) setIsNameInvalid(false);
                  }}
                  placeholder="Nome do Calendário"
                  className={`w-full bg-slate-100 dark:bg-slate-800 border rounded-md p-2 focus:ring-2 focus:ring-windows-accent focus:outline-none text-windows-text-primary-light dark:text-windows-text-primary-dark ${
                    isNameInvalid ? 'border-red-500 animate-shake' : 'border-windows-border-light dark:border-windows-border-dark'
                  }`}
                  autoFocus
                />
                <div className="flex flex-wrap gap-2 items-center mt-4">
                  {CALENDAR_COLORS.map(color => (
                    <ColorSwatch key={color} color={color} isSelected={newCalendarColor === color} onClick={() => setNewCalendarColor(color)} />
                  ))}
                  <div className="relative">
                    <button type="button" onClick={() => newColorInputRef.current?.click()} className={`w-8 h-8 rounded-full border-2 border-dashed border-slate-400 flex items-center justify-center hover:border-windows-accent ${newCalendarColor.startsWith('#') ? 'ring-2 ring-offset-2 ring-windows-accent dark:ring-offset-windows-content-dark' : ''}`}>
                      {newCalendarColor.startsWith('#') ? (
                          <div className="w-full h-full rounded-full" style={{ backgroundColor: newCalendarColor }} />
                      ) : (
                          <ICONS.plus className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    <input ref={newColorInputRef} type="color" value={newCalendarColor.startsWith('#') ? newCalendarColor : '#ffffff'} onChange={(e) => setNewCalendarColor(e.target.value)} className="absolute w-0 h-0 opacity-0"/>
                  </div>
                </div>
                <button type="submit" className="w-full px-4 py-2 mt-4 text-sm font-semibold rounded-md bg-windows-accent text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                  <ICONS.plus className="w-5 h-5" />
                  Adicionar Calendário
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
      
      {/* Modal de Confirmação para Excluir Calendário */}
      <ConfirmationModal
        isOpen={!!calendarToDelete}
        onClose={() => setCalendarToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Calendário?"
        isDestructive
        confirmText="Sim, Excluir"
        securityWord="EXCLUIR"
        message={
          <>
            <p>Você tem certeza que deseja excluir o calendário <strong className="text-windows-text-primary-light dark:text-windows-text-primary-dark">{calendarToDelete?.name}</strong>?</p>
            <p className="font-bold text-red-600 dark:text-red-400">Esta ação é irreversível e todos os eventos associados a este calendário também serão excluídos permanentemente.</p>
          </>
        }
      />
    </>
  );
};

export default CalendarManager;