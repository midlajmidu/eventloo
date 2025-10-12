import React, { useState } from 'react';
import { authAPI } from '../services/api';
import { getApiBaseUrl, debugApiConfig } from '../utils/apiUtils';

const BackendTest = () => {
  const [testResults, setTestResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message, type = 'info') => {
    setTestResults(prev => [...prev, { message, type, timestamp: new Date().toISOString() }]);
  };

  const runTests = async () => {
    setLoading(true);
    setTestResults([]);
    
    try {
      // Test 1: API Configuration
      addResult('🔧 Testing API configuration...', 'info');
      debugApiConfig();
      addResult(`✅ API Base URL: ${getApiBaseUrl()}`, 'success');
      
      // Test 2: Backend Health Check
      addResult('🏥 Testing backend health...', 'info');
      try {
        const response = await fetch(`${getApiBaseUrl().replace('/api', '')}/`);
        if (response.ok) {
          const data = await response.json();
          addResult(`✅ Backend is healthy: ${JSON.stringify(data)}`, 'success');
        } else {
          addResult(`❌ Backend health check failed: ${response.status}`, 'error');
        }
      } catch (error) {
        addResult(`❌ Backend health check error: ${error.message}`, 'error');
      }

      // Test 3: API Test Endpoint
      addResult('🧪 Testing API test endpoint...', 'info');
      try {
        const response = await fetch(`${getApiBaseUrl().replace('/api', '')}/api/test/`);
        if (response.ok) {
          const data = await response.json();
          addResult(`✅ API test successful: ${JSON.stringify(data)}`, 'success');
        } else {
          addResult(`❌ API test failed: ${response.status}`, 'error');
        }
      } catch (error) {
        addResult(`❌ API test error: ${error.message}`, 'error');
      }

      // Test 4: CORS Test
      addResult('🌐 Testing CORS configuration...', 'info');
      try {
        const response = await fetch(`${getApiBaseUrl()}/profile/`, {
          method: 'OPTIONS',
          headers: {
            'Origin': window.location.origin,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'authorization,content-type',
          }
        });
        if (response.ok) {
          addResult('✅ CORS preflight successful', 'success');
        } else {
          addResult(`❌ CORS preflight failed: ${response.status}`, 'error');
        }
      } catch (error) {
        addResult(`❌ CORS test error: ${error.message}`, 'error');
      }

      // Test 5: Authentication Endpoint
      addResult('🔐 Testing authentication endpoint...', 'info');
      try {
        const response = await fetch(`${getApiBaseUrl()}/token/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'testpassword'
          })
        });
        
        if (response.status === 400) {
          addResult('✅ Authentication endpoint is accessible (expected 400 for invalid credentials)', 'success');
        } else if (response.status === 401) {
          addResult('✅ Authentication endpoint is accessible (expected 401 for invalid credentials)', 'success');
        } else {
          addResult(`⚠️ Authentication endpoint returned unexpected status: ${response.status}`, 'warning');
        }
      } catch (error) {
        addResult(`❌ Authentication endpoint error: ${error.message}`, 'error');
      }

    } catch (error) {
      addResult(`❌ Test suite error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Backend Connection Test</h2>
      
      <button 
          onClick={runTests}
        disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 mb-4"
      >
          {loading ? 'Running Tests...' : 'Run Connection Tests'}
      </button>
      
        <div className="space-y-2">
          {testResults.map((result, index) => (
            <div
              key={index}
              className={`p-3 rounded ${
                result.type === 'success' ? 'bg-green-100 text-green-800' :
                result.type === 'error' ? 'bg-red-100 text-red-800' :
                result.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}
            >
              <div className="font-mono text-sm">{result.message}</div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(result.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>

        {testResults.length > 0 && (
          <div className="mt-4 p-4 bg-gray-100 rounded">
            <h3 className="font-bold mb-2">Summary:</h3>
            <ul className="text-sm space-y-1">
              <li>• Total tests: {testResults.length}</li>
              <li>• Successful: {testResults.filter(r => r.type === 'success').length}</li>
              <li>• Errors: {testResults.filter(r => r.type === 'error').length}</li>
              <li>• Warnings: {testResults.filter(r => r.type === 'warning').length}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackendTest; 