import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';

/**
 * Interface para as propriedades do componente ConfirmationModal.
 * @param isOpen - Controla se o modal está visível.
 * @param onClose - Função chamada ao fechar o modal (clicando no botão de cancelar ou fora).
 * @param onConfirm - Função chamada ao confirmar a ação.
 * @param title - O título do modal.
 * @param message - O conteúdo (corpo) da mensagem do modal. Pode ser um texto ou um elemento React.
 * @param confirmText - O texto para o botão de confirmação (padrão: "Confirmar").
 * @param cancelText - O texto para o botão de cancelamento (padrão: "Cancelar").
 * @param isDestructive - Se `true`, estiliza o botão de confirmação em vermelho para indicar uma ação perigosa.
 * @param securityWord - Uma palavra que o usuário deve digitar para habilitar o botão de confirmação, como uma camada extra de segurança.
 */
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  securityWord?: string;
}

/**
 * Componente de modal genérico para solicitar confirmação do usuário.
 * É especialmente útil para ações destrutivas como exclusão, onde uma
 * verificação adicional (como digitar uma palavra de segurança) pode ser necessária.
 */
const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDestructive = false,
  securityWord,
}) => {
  // Estado para armazenar a palavra de segurança digitada pelo usuário.
  const [inputWord, setInputWord] = useState('');

  // Efeito para limpar o campo de input sempre que o modal for aberto.
  useEffect(() => {
    if (isOpen) {
      setInputWord('');
    }
  }, [isOpen]);

  // Se o modal não estiver aberto, não renderiza nada para economizar recursos.
  if (!isOpen) return null;

  // Verifica se o botão de confirmação deve estar desabilitado.
  // Se uma `securityWord` for fornecida, o input do usuário deve corresponder a ela.
  const isConfirmDisabled = securityWord ? inputWord !== securityWord : false;

  // Define as classes de cor do botão de confirmação com base na prop `isDestructive`.
  const confirmButtonClasses = isDestructive
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-windows-accent hover:opacity-90';

  return (
    // Overlay do modal: um fundo semi-transparente que cobre a tela inteira.
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity duration-300 animate-in fade-in">
      {/* Container do modal */}
      <div className="bg-windows-content-light dark:bg-windows-content-dark rounded-xl shadow-2xl w-full max-w-md m-4 p-6 transform transition-all duration-300 scale-95 animate-in fade-in zoom-in-95">
        <div className="flex items-start space-x-4">
          {/* Ícone de alerta (triângulo) para ações destrutivas */}
          {isDestructive && (
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
              <ICONS.alertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
            </div>
          )}
          {/* Conteúdo de texto do modal (título e mensagem) */}
          <div className="flex-1">
            <h3 className="text-lg font-bold text-windows-text-primary-light dark:text-windows-text-primary-dark" id="modal-title">
              {title}
            </h3>
            <div className="mt-2">
              <div className="text-sm text-windows-text-secondary-light dark:text-windows-text-secondary-dark space-y-2">
                {message}
              </div>
            </div>
          </div>
        </div>

        {/* Campo de input para a palavra de segurança (renderizado condicionalmente) */}
        {securityWord && (
          <div className="mt-4">
            <label htmlFor="security-word" className="block text-sm font-medium text-windows-text-secondary-light dark:text-windows-text-secondary-dark">
              Para confirmar, digite <strong className="text-windows-text-primary-light dark:text-windows-text-primary-dark">{securityWord}</strong> abaixo:
            </label>
            <input
              type="text"
              id="security-word"
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
              className="mt-1 w-full bg-slate-100 dark:bg-slate-800 border border-windows-border-light dark:border-windows-border-dark rounded-md p-2 focus:ring-2 focus:ring-red-500 focus:outline-none text-windows-text-primary-light dark:text-windows-text-primary-dark"
              autoFocus
            />
          </div>
        )}

        {/* Botões de ação (Confirmar e Cancelar) */}
        <div className="mt-6 flex flex-col sm:flex-row-reverse sm:space-x-3 sm:space-x-reverse">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirmDisabled}
            className={`w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors ${confirmButtonClasses} ${isConfirmDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {confirmText}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full sm:w-auto sm:mt-0 inline-flex justify-center rounded-md border border-windows-border-light dark:border-windows-border-dark bg-windows-content-light dark:bg-windows-content-dark px-4 py-2 text-sm font-semibold text-windows-text-primary-light dark:text-windows-text-primary-dark shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;