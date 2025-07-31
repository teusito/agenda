import React, { useState, useContext, useEffect, useRef } from 'react';
import { View, AppContextType, Theme } from '../types';
import { ICONS } from '../constants';
import { AppContext } from '../App';

/**
 * Interface para as propriedades do componente SideMenu.
 * @param onUndo - Função para desfazer a última ação.
 * @param canUndo - Booleano que indica se a ação de desfazer está disponível.
 * @param onRedo - Função para refazer a última ação desfeita.
 * @param canRedo - Booleano que indica se a ação de refazer está disponível.
 */
interface SideMenuProps {
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
}

/**
 * Componente para um item de menu principal (ex: Calendário, Configurações).
 * @param label - O texto do item de menu.
 * @param icon - O ícone do item de menu.
 * @param onClick - A função a ser executada ao clicar.
 * @param isActive - Booleano que indica se este é o item de menu ativo.
 */
const MenuItem: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  isActive?: boolean;
}> = ({ label, icon, onClick, isActive }) => (
  <button
    onClick={onClick}
    className={`flex items-center w-full text-left p-3 rounded-lg transition-colors duration-200
      ${isActive
        ? 'bg-windows-accent/20 text-windows-accent font-semibold' // Estilo para item ativo
        : 'text-windows-text-primary-light dark:text-windows-text-primary-dark hover:bg-slate-200 dark:hover:bg-slate-700' // Estilo padrão
      }`}
  >
    <div className="w-6 h-6 mr-4 flex items-center justify-center">{icon}</div>
    <span>{label}</span>
  </button>
);

/**
 * Componente para um item de submenu (ex: Criar Evento, Desfazer).
 * @param label - O texto do item de submenu.
 * @param icon - O ícone do item de submenu.
 * @param onClick - A função a ser executada ao clicar.
 * @param disabled - Booleano que desabilita o botão.
 */
const SubMenuItem: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}> = ({ label, icon, onClick, disabled }) => (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center w-full text-left py-2 pr-3 pl-4 text-sm rounded-lg transition-colors
        text-windows-text-secondary-light dark:text-windows-text-secondary-dark hover:bg-slate-200 dark:hover:bg-slate-700
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
    >
      <div className="w-6 h-6 mr-4 flex items-center justify-center">{icon}</div>
      <span>{label}</span>
    </button>
);

/**
 * Componente que renderiza o seletor de tema (Sistema, Claro, Escuro).
 */
const ThemeSelector: React.FC = () => {
    const { theme, setTheme } = useContext(AppContext) as AppContextType;

    const themes: { name: Theme, icon: JSX.Element, label: string }[] = [
        { name: 'system', icon: <ICONS.monitor className="w-5 h-5"/>, label: 'Sistema' },
        { name: 'light', icon: <ICONS.sun className="w-5 h-5"/>, label: 'Claro' },
        { name: 'dark', icon: <ICONS.moon className="w-5 h-5"/>, label: 'Escuro' },
    ];
    
    return (
      <div className="flex items-center justify-around p-1 rounded-lg bg-slate-200 dark:bg-slate-700">
          {themes.map(t => (
              <button
                  key={t.name}
                  onClick={() => setTheme(t.name)}
                  title={`Tema ${t.label}`}
                  className={`flex-1 flex justify-center items-center p-2 rounded-md transition-colors text-windows-text-primary-light dark:text-windows-text-primary-dark
                      ${theme === t.name ? 'bg-windows-content-light dark:bg-windows-content-dark shadow-sm' : 'hover:bg-slate-300 dark:hover:bg-slate-600'}`}
              >
                  {t.icon}
              </button>
          ))}
      </div>
    );
};


/**
 * Componente principal do menu lateral (Dock) que controla a navegação da aplicação.
 */
const SideMenu: React.FC<SideMenuProps> = ({ onUndo, canUndo, onRedo, canRedo }) => {
  // Acessa o contexto global para obter estado e funções de navegação e UI.
  const { 
    currentView, 
    setCurrentView, 
    openEventModal, 
    getSyncedTime, 
    goToToday,
  } = useContext(AppContext) as AppContextType;

  // Estado para controlar se o menu está aberto ou fechado.
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * Efeito para fechar o menu quando o usuário clica fora dele.
   */
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      // Se o clique foi fora do elemento do menu, fecha o menu.
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    // Limpa o event listener quando o componente é desmontado para evitar vazamentos de memória.
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  /**
   * Manipulador para navegação principal.
   * Muda a visualização atual e fecha o menu.
   * Se a navegação for para o calendário, chama `goToToday` para centralizá-lo.
   * @param view - A tela para a qual navegar ('calendar' ou 'settings').
   */
  const handleNavigation = (view: View) => {
    if (view === 'calendar') {
      goToToday();
    } else {
      setCurrentView(view);
    }
    setIsOpen(false);
  };
  
  /**
   * Manipulador genérico para ações que devem fechar o menu após a execução.
   * @param action - A função a ser executada.
   */
  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  }
  
  /**
   * Manipulador específico para criar um novo evento.
   * Obtém a data e hora atuais e abre o modal de evento em modo de criação.
   */
  const handleCreateNew = () => handleAction(() => {
    const today = getSyncedTime();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    openEventModal(null, date);
  });

  return (
    <>
      {/* Overlay escuro que aparece atrás do menu quando ele está aberto */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      ></div>

      {/* Corpo do Menu Lateral */}
      <div
        ref={menuRef}
        className={`fixed top-0 left-0 h-full bg-windows-bg-light/90 dark:bg-windows-bg-dark/90 backdrop-blur-xl shadow-2xl border-r border-windows-border-light dark:border-windows-border-dark w-72 p-4 z-50 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Cabeçalho do Menu */}
        <div className="flex items-center gap-3 mb-6 px-2">
            <img src="agenda.ico" alt="Agenda Logo" className="w-8 h-8"/>
            <h2 className="text-xl font-bold text-windows-text-primary-light dark:text-windows-text-primary-dark">Agenda</h2>
        </div>
        
        {/* Navegação Principal */}
        <nav className="flex flex-col space-y-1">
          <MenuItem 
            label="Calendário" 
            icon={<ICONS.calendar className="w-5 h-5"/>} 
            onClick={() => handleNavigation('calendar')}
            isActive={currentView === 'calendar'}
          />
          {/* Submenu do Calendário, visível apenas na tela de calendário */}
          {currentView === 'calendar' && (
              <div className="space-y-1 ml-4 border-l-2 border-slate-200 dark:border-slate-700 pl-2 py-1 animate-in fade-in duration-300">
                <SubMenuItem label="Criar Evento" icon={<ICONS.plus className="w-4 h-4" />} onClick={handleCreateNew} />
                <SubMenuItem label="Desfazer" icon={<ICONS.undo className="w-4 h-4" />} onClick={() => handleAction(onUndo)} disabled={!canUndo} />
                <SubMenuItem label="Refazer" icon={<ICONS.redo className="w-4 h-4" />} onClick={() => handleAction(onRedo)} disabled={!canRedo} />
              </div>
          )}

          <MenuItem 
            label="Configurações" 
            icon={<ICONS.settings className="w-5 h-5"/>} 
            onClick={() => handleNavigation('settings')}
            isActive={currentView === 'settings'}
          />
        </nav>
        
        {/* Seção de Tema */}
        <div className="mt-6 pt-4 border-t border-windows-border-light dark:border-windows-border-dark">
          <ThemeSelector />
        </div>
        
        {/* Espaço flexível para empurrar o conteúdo final para baixo (se houver) */}
        <div className="flex-grow"></div>
      </div>

      {/* Botão flutuante para abrir/fechar o menu */}
      <button
        onClick={() => setIsOpen(p => !p)}
        aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
        className="fixed bottom-5 left-5 w-16 h-16 bg-white/70 dark:bg-black/50 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-black/30 flex items-center justify-center text-windows-text-primary-light dark:text-windows-text-primary-dark transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 z-50"
      >
        <div className="w-8 h-8 flex items-center justify-center">
          {isOpen ? <ICONS.x className="w-7 h-7" /> : <img src="agenda.ico" alt="Menu" className="w-full h-full" />}
        </div>
      </button>
    </>
  );
};

export default SideMenu;