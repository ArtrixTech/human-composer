import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import FloatingWidget from './components/FloatingWidget';

const isWidget =
  new URLSearchParams(window.location.search).get('window') === 'floating-widget';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{isWidget ? <FloatingWidget /> : <App />}</React.StrictMode>,
);
