import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../utils/apiUtils';

const DebugBackend = () => {
  const [backendInfo, setBackendInfo] = useState({});

  useEffect(() => {
    const info = {
      environment: process.env.NODE_ENV,
      reactAppApiUrl: process.env.REACT_APP_API_URL,
      computedBaseUrl: getApiBaseUrl(),
      currentLocation: window.location.href,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
    };
    setBackendInfo(info);
  }, []);

  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: '#1a1a1a',
      color: '#00ff00',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      maxWidth: '400px',
      border: '1px solid #333'
    }}>
      <h4 style={{ margin: '0 0 10px 0', color: '#ffff00' }}>🔧 Backend Debug Info</h4>
      <div style={{ marginBottom: '5px' }}>
        <strong>Environment:</strong> {backendInfo.environment}
      </div>
      <div style={{ marginBottom: '5px' }}>
        <strong>REACT_APP_API_URL:</strong> {backendInfo.reactAppApiUrl || 'Not set'}
      </div>
      <div style={{ marginBottom: '5px' }}>
        <strong>Computed Base URL:</strong> {backendInfo.computedBaseUrl}
      </div>
      <div style={{ marginBottom: '5px' }}>
        <strong>Current Location:</strong> {backendInfo.currentLocation}
      </div>
      <div style={{ marginBottom: '5px' }}>
        <strong>Protocol:</strong> {backendInfo.protocol}
      </div>
      <div style={{ marginBottom: '5px' }}>
        <strong>Hostname:</strong> {backendInfo.hostname}
      </div>
      <div style={{ 
        marginTop: '10px', 
        padding: '5px', 
        background: '#333', 
        borderRadius: '4px',
        fontSize: '10px'
      }}>
        <strong>Status:</strong> {backendInfo.reactAppApiUrl ? '✅ Backend URL Configured' : '❌ No Backend URL Set'}
      </div>
    </div>
  );
};

export default DebugBackend; 