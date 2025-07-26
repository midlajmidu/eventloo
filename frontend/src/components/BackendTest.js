import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../utils/apiUtils';

const BackendTest = () => {
  const [connectionStatus, setConnectionStatus] = useState('Testing...');
  const [apiUrl, setApiUrl] = useState('');

  useEffect(() => {
    const testConnection = async () => {
      const baseUrl = getApiBaseUrl();
      setApiUrl(baseUrl);
      
      try {
        // Test the backend connection
        const response = await fetch(`${baseUrl}/admin/dashboard/summary/`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          setConnectionStatus('✅ Backend Connected Successfully!');
        } else {
          setConnectionStatus(`❌ Backend Error: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        setConnectionStatus(`❌ Connection Failed: ${error.message}`);
      }
    };

    testConnection();
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: '#1a1a1a',
      color: '#00ff00',
      padding: '20px',
      borderRadius: '10px',
      fontSize: '14px',
      fontFamily: 'monospace',
      zIndex: 10000,
      maxWidth: '500px',
      border: '2px solid #333',
      textAlign: 'center'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#ffff00' }}>🔧 Backend Connection Test</h3>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Current API URL:</strong>
        <div style={{ 
          background: '#333', 
          padding: '8px', 
          borderRadius: '4px',
          marginTop: '5px',
          wordBreak: 'break-all'
        }}>
          {apiUrl}
        </div>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Connection Status:</strong>
        <div style={{ 
          background: '#333', 
          padding: '8px', 
          borderRadius: '4px',
          marginTop: '5px'
        }}>
          {connectionStatus}
        </div>
      </div>
      
      <div style={{ 
        marginTop: '15px', 
        padding: '10px', 
        background: '#333', 
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        <strong>Environment:</strong> {process.env.NODE_ENV}<br/>
        <strong>REACT_APP_API_URL:</strong> {process.env.REACT_APP_API_URL || 'Not set'}
      </div>
      
      <button 
        onClick={() => window.location.reload()}
        style={{
          marginTop: '15px',
          padding: '8px 16px',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Refresh Test
      </button>
    </div>
  );
};

export default BackendTest; 