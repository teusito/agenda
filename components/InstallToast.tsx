import React, { useContext } from 'react';
import { AppContext } from '../App';
import { AppContextType } from '../types';
import { ICONS } from '../constants';

/**
 * Componente que exibe uma notificação ("toast") na parte inferior da tela,
 * sugerindo ao usuário que instale a aplicação como um Progressive Web App (PWA).
 * Este toast só aparece quando o navegador dispara o evento `beforeinstallprompt`.
 */
const InstallToast: React.FC = () => {
  // Acessa o contexto global para obter o estado e as funções relacionadas à instalação do PWA.
  const { showInstallToast, triggerInstallPrompt, dismissInstallPrompt } = useContext(AppContext) as AppContextType;

  // Se o toast não deve ser exibido, não renderiza nada.
  if (!showInstallToast) {
    return null;
  }

  return (
    // Container do toast, posicionado na parte inferior central da tela, com animação de entrada.
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-50 animate-toast-in">
      <div className="bg-windows-content-dark/90 dark:bg-windows-content-light/90 backdrop-blur-lg rounded-xl shadow-2xl p-4 flex items-center justify-between gap-4">
        {/* Seção de ícone e texto */}
        <div className="flex items-center gap-3">
          <img src="agenda.ico" alt="Agenda Logo" className="w-10 h-10" />
          <div>
            <p className="font-bold text-white dark:text-black">Instalar Agenda</p>
            <p className="text-sm text-gray-300 dark:text-gray-700">Acesso rápido e offline.</p>
          </div>
        </div>
        {/* Seção de botões de ação */}
        <div className="flex items-center gap-2">
          <button
            onClick={triggerInstallPrompt} // Dispara o prompt de instalação do navegador
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-windows-accent text-white hover:opacity-90 transition-opacity"
          >
            Instalar
          </button>
          <button
            onClick={dismissInstallPrompt} // Dispensa o toast, permitindo que ele reapareça em uma sessão futura
            className="p-2 text-gray-300 dark:text-gray-700 hover:bg-white/20 dark:hover:bg-black/10 rounded-full"
            aria-label="Fechar"
          >
            <ICONS.x className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallToast;