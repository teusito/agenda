// Importa as bibliotecas React e ReactDOM, essenciais para a aplicação.
import React from 'react';
import ReactDOM from 'react-dom/client';
// Importa o componente principal da aplicação.
import App from './App';

/**
 * Ponto de entrada da aplicação.
 * Este script encontra o elemento 'root' no HTML e renderiza o componente principal <App /> dentro dele.
 */

// Procura pelo elemento HTML com o id 'root', que servirá como contêiner para a aplicação React.
const rootElement = document.getElementById('root');

// Se o elemento 'root' não for encontrado no DOM, lança um erro para que o problema seja identificado rapidamente.
if (!rootElement) {
  throw new Error("Não foi possível encontrar o elemento 'root' para montar a aplicação.");
}

// Cria a "raiz" da aplicação React no elemento DOM encontrado.
// Esta é a nova API do React 18 para renderização.
const root = ReactDOM.createRoot(rootElement);

// Renderiza o componente <App /> dentro da raiz.
// O <React.StrictMode> é um wrapper que ajuda a detectar potenciais problemas na aplicação
// durante o desenvolvimento, como o uso de APIs depreciadas, efeitos colaterais inesperados, etc.
// Ele não afeta a build de produção.
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
