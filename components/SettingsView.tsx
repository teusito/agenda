import React, { useContext, useState, useEffect, useRef } from 'react';
import { AppContextType } from '../types';
import { ICONS } from '../constants';
import { AppContext } from '../App';

/**
 * Interface para as propriedades do componente SettingsView.
 * @param onOpenCalendarManager - Função para abrir o modal de gerenciamento de calendários.
 */
interface SettingsViewProps {
  onOpenCalendarManager: () => void;
}

/**
 * Componente que renderiza a tela de Configurações da aplicação.
 * Permite ao usuário gerenciar agendas, notificações, backup e modo de depuração.
 */
const SettingsView: React.FC<SettingsViewProps> = ({ 
  onOpenCalendarManager, 
}) => {
  
  // Acessa o contexto global para obter estado e funções.
  const { 
    events,
    calendars,
    importICS,
    triggerImportAnimation,
    logOut,
    notificationPermission,
    requestNotificationPermission,
    isDebugMode,
    setIsDebugMode,
    logDebug,
  } = useContext(AppContext) as AppContextType;

  // Estado para o input de importação e mensagens de erro.
  const importInputRef = useRef<HTMLInputElement>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  // Efeito para limpar a mensagem de erro após 5 segundos.
  useEffect(() => {
    if (dataError) {
      const timer = setTimeout(() => setDataError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [dataError]);


  /**
   * Manipulador para exportar os dados do calendário para um arquivo .ics.
   * Converte todos os eventos em uma string no formato iCalendar e inicia o download.
   */
  const handleExport = () => {
    setDataError(null);
    logDebug("Iniciando exportação de dados para .ics.");
    
    if (events.length === 0) {
      setDataError("Sua agenda está vazia. Não há eventos para exportar.");
      logDebug("Exportação cancelada: sem eventos.");
      return;
    }
    
    const calendarMap = new Map(calendars.map(c => [c.id, c.name]));
    
    // Formata a data para o padrão iCalendar (ex: 20240101T120000).
    const formatDT = (date: Date): string => {
        return date.toISOString().replace(/[-:.]/g, '').slice(0, 15);
    };

    // Escapa caracteres especiais em textos conforme a especificação iCalendar.
    const escapeText = (text: string = ''): string => {
        return text.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
    };

    // Constrói a string do arquivo .ics.
    let icsString = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Agenda//App//PT',
    ];

    events.forEach(event => {
        const { date, startTime, title, description, id, calendarId } = event;
        try {
            const startDate = new Date(`${date}T${startTime}`);
            if (isNaN(startDate.getTime())) return; // Pula eventos com data inválida.
            
            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Assume 1h de duração.

            icsString.push(
                'BEGIN:VEVENT',
                `UID:${id}@agenda.local`,
                `DTSTAMP:${formatDT(new Date())}Z`,
                `DTSTART:${formatDT(startDate)}`,
                `DTEND:${formatDT(endDate)}`,
                `SUMMARY:${escapeText(title)}`,
                `DESCRIPTION:${escapeText(description)}`,
                `CATEGORIES:${escapeText(calendarMap.get(calendarId) || 'Geral')}`,
                'END:VEVENT'
            );
        } catch(e) {
            logDebug(`Erro ao processar evento ${id} para exportação:`, e);
        }
    });

    icsString.push('END:VCALENDAR');
    
    // Cria um Blob e simula um clique em um link para fazer o download do arquivo.
    const file = new Blob([icsString.join('\r\n')], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = 'agenda.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    logDebug("Exportação concluída com sucesso.");
  };

  /**
   * Manipulador para o clique no botão de importação, que aciona o input de arquivo oculto.
   */
  const handleImportClick = () => {
    setDataError(null);
    importInputRef.current?.click();
  };

  /**
   * Manipulador para quando um arquivo de importação é selecionado pelo usuário.
   * Lê o arquivo e passa o conteúdo para a função `importICS` do contexto.
   */
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    logDebug(`Iniciando importação do arquivo: ${file.name}`);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        const content = event.target?.result as string;
        if (content) {
            try {
                const { eventsImported, calendarsCreated } = await importICS(content);
                triggerImportAnimation(); // Dispara animação de feedback visual.
                logDebug(`Importação bem-sucedida: ${eventsImported} eventos, ${calendarsCreated} novos calendários.`);
            } catch (error: any) {
                const errorMessage = `Erro ao importar o arquivo: ${error.message}`;
                setDataError(errorMessage);
                logDebug(errorMessage, error);
            }
        }
    };
    reader.onerror = () => {
        const errorMessage = `Erro: Não foi possível ler o arquivo selecionado.`;
        setDataError(errorMessage);
        logDebug(errorMessage, reader.error);
    };
    reader.readAsText(file);

    e.target.value = ''; // Limpa o input para permitir selecionar o mesmo arquivo novamente.
  };

  /**
   * Retorna o texto e a cor para o status da permissão de notificação.
   */
  const getNotificationStatusText = () => {
    switch(notificationPermission) {
        case 'granted': return { text: 'Alertas de eventos estão ativos.', color: 'text-green-600 dark:text-green-400' };
        case 'denied': return { text: 'Alertas bloqueados. Altere nas configurações do navegador.', color: 'text-red-600 dark:text-red-400' };
        default: return { text: 'Alertas de eventos não estão ativos.', color: 'text-windows-text-secondary-light dark:text-windows-text-secondary-dark' };
    }
  };

  /**
   * Dispara uma notificação de teste para o usuário.
   */
  const handleTestNotification = () => {
    logDebug("Testando notificação.");
    if (notificationPermission === 'granted') {
        new Notification('Agenda: Teste de Alerta', {
            body: 'Se você pode ver isso, as notificações estão funcionando!',
            icon: '/agenda.ico',
        });
        logDebug("Notificação de teste enviada.");
    } else {
        alert('As notificações não estão habilitadas. Por favor, permita as notificações para testá-las.');
        logDebug("Teste de notificação falhou: permissão não concedida.");
    }
  };


  return (
    <div className="h-full flex flex-col text-windows-text-primary-light dark:text-windows-text-primary-dark relative">
      <div className="flex-grow overflow-y-auto p-4 sm:p-8">
        <div className="w-full max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">Configurações</h1>
          
          <div className="space-y-6">
            
            {/* Seção de Gerenciamento de Agendas */}
            <div className="p-6 bg-windows-content-light dark:bg-windows-content-dark rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Agendas</h2>
                <p className="text-sm text-windows-text-secondary-light dark:text-windows-text-secondary-dark mb-4">
                    Crie, edite e organize seus calendários.
                </p>
                 <button
                    onClick={onOpenCalendarManager}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                >
                    <ICONS.folder className="w-5 h-5" />
                    Gerenciar Agendas
                </button>
            </div>

            {/* Seção de Notificações */}
            <div className="p-6 bg-windows-content-light dark:bg-windows-content-dark rounded-xl shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Notificações</h2>
              <p className="text-sm text-windows-text-secondary-light dark:text-windows-text-secondary-dark mb-4">
                Receba alertas no seu dispositivo quando um evento estiver para começar.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className={`text-sm font-medium ${getNotificationStatusText().color}`}>
                  {getNotificationStatusText().text}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={requestNotificationPermission}
                    disabled={notificationPermission !== 'default'}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Habilitar Alertas
                  </button>
                  {isDebugMode && (
                    <button
                      onClick={handleTestNotification}
                      className="px-4 py-2 text-sm font-semibold rounded-md bg-yellow-100 dark:bg-yellow-800/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-800/50 transition-colors"
                    >
                      Testar Alerta
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Seção de Backup e Restauração */}
            <div id="local-file-sync-section" className='p-6 bg-windows-content-light dark:bg-windows-content-dark rounded-xl shadow-sm'>
                <h2 className="text-xl font-semibold mb-2">Backup e Restauração</h2>
                <p className="text-sm text-windows-text-secondary-light dark:text-windows-text-secondary-dark mb-4">
                    Exporte seus dados para um arquivo de backup ou importe um arquivo existente.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={handleExport}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                  >
                    Exportar Agenda (.ics)
                  </button>
                  <button
                    onClick={handleImportClick}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                  >
                    Importar Agenda (.ics)
                  </button>
                  <input type="file" accept=".ics,text/calendar" ref={importInputRef} onChange={handleFileImport} className="hidden" />
                </div>
                {dataError && (
                  <div className="mt-4 text-sm p-3 rounded-md bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-600/50 animate-in fade-in">
                    {dataError}
                  </div>
                )}
            </div>

            {/* Seção de Depuração */}
            <div className="p-6 bg-windows-content-light dark:bg-windows-content-dark rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Depuração</h2>
                <div className="flex items-center justify-between">
                    <p className="text-sm text-windows-text-secondary-light dark:text-windows-text-secondary-dark">
                    Habilitar modo de desenvolvedor para opções avançadas.
                    </p>
                    <label htmlFor="debug-switch" className="flex items-center cursor-pointer">
                    <div className="relative">
                        <input 
                        type="checkbox" 
                        id="debug-switch" 
                        className="sr-only" 
                        checked={isDebugMode}
                        onChange={(e) => setIsDebugMode(e.target.checked)}
                        />
                        <div className={`block w-14 h-8 rounded-full transition-colors ${isDebugMode ? 'bg-windows-accent' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isDebugMode ? 'translate-x-6' : ''}`}></div>
                    </div>
                    </label>
                </div>
            </div>

            {/* Seção de Sair */}
            <div className="p-6 bg-windows-content-light dark:bg-windows-content-dark rounded-xl shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Sessão</h2>
              <p className="text-sm text-windows-text-secondary-light dark:text-windows-text-secondary-dark mb-4">
                Finalizar a sessão atual e retornar para a tela de entrada.
              </p>
              <button
                onClick={logOut}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;