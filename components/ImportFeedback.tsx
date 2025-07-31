import React from 'react';
import { ICONS } from '../constants';

/**
 * Interface para as propriedades do componente ImportFeedback.
 * @param isVisible - Controla se o feedback está visível.
 */
interface ImportFeedbackProps {
  isVisible: boolean;
}

/**
 * Componente que exibe uma animação de feedback visual quando
 * um arquivo de calendário (.ics) é importado com sucesso.
 * A animação simula um ícone de arquivo "voando" para o canto superior
 * direito da tela, onde o menu de sincronização poderia estar, dando
 * um feedback visual de que os dados foram "salvos".
 */
const ImportFeedback: React.FC<ImportFeedbackProps> = ({ isVisible }) => {
  // Se não estiver visível, não renderiza nada para economizar recursos.
  if (!isVisible) return null;

  return (
    // Contêiner que posiciona a animação no centro da tela.
    // `pointer-events-none` garante que o overlay não capture cliques do mouse.
    <div className="fixed inset-0 flex justify-center items-center z-[100] pointer-events-none">
      {/* Define os keyframes da animação diretamente no estilo do componente para encapsulamento. */}
      <style>
        {`
          @keyframes import-animation {
            0% {
              transform: translate(0, 0) scale(1);
              opacity: 1;
            }
            50% {
              transform: translate(0, 0) scale(1.1);
              opacity: 1;
            }
            100% {
              transform: translate(calc(50vw - 60px), calc(-50vh + 60px)) scale(0.2);
              opacity: 0;
            }
          }
          .animate-import {
            animation: import-animation 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          }
        `}
      </style>
      {/* O elemento visual que será animado. */}
      <div className="animate-import p-4 bg-windows-accent/90 rounded-full shadow-2xl">
        <ICONS.fileDown className="w-10 h-10 text-white" />
      </div>
    </div>
  );
};

export default ImportFeedback;