import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Remove credentials left by older releases. Authentication tokens now live
// only in secure HttpOnly cookies and are never exposed to JavaScript.
localStorage.removeItem('access_token');
localStorage.removeItem('token');
localStorage.removeItem('refresh_token');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 
