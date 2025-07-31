import React from 'react';

/**
 * Interface para as propriedades do componente LoginView.
 * @param onSignIn - Função a ser chamada quando o usuário clica no botão "Entrar".
 */
interface LoginViewProps {
  onSignIn: () => void;
}

/**
 * Componente que renderiza a tela de login/entrada da aplicação.
 * É a primeira tela que o usuário vê se não estiver logado.
 * Atualmente, oferece um único modo de entrada local (offline).
 */
const LoginView: React.FC<LoginViewProps> = ({ onSignIn }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-windows-bg-light dark:bg-windows-bg-dark text-windows-text-primary-light dark:text-windows-text-primary-dark font-sans">
      <div className="text-center p-8 max-w-sm mx-auto">
        {/* Logo e nome do aplicativo */}
        <div className="mx-auto mb-6 flex items-center justify-center w-24 h-24 bg-windows-content-light dark:bg-windows-content-dark rounded-3xl shadow-lg">
           <img src="agenda.ico" alt="Agenda Logo" className="w-14 h-14" />
        </div>
        <h1 className="text-4xl font-bold mb-2">Agenda</h1>
        <p className="text-windows-text-secondary-light dark:text-windows-text-secondary-dark mb-8">
          Sua vida, organizada.
        </p>
        
        {/* Botão de login principal */}
        <button
          onClick={onSignIn}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-windows-accent text-white rounded-lg font-semibold shadow-md hover:opacity-90 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-windows-bg-dark"
        >
          Entrar
        </button>
        
      </div>
    </div>
  );
};

export default LoginView;