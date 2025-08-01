export const API_CONFIG = {
  BASE_URL: 'http://16.171.14.246:5000/', // Your local backend API base URL
  ENDPOINTS: {
    REAL_TIME_DATA: '/data',
    HISTORICAL_DATA: '/historical_data',
    BATCH_DATA: '/batch_data',
    TEST_RESULTS: '/test_results',
    FORECAST: '/forecast',
  },
  // Add external URLs or specific webhook URLs outside of the BASE_URL pattern
  N8N_WEBHOOK_ANOMALY_ALERT: 'https://shrijit.app.n8n.cloud/webhook/9e10c4ec-3241-4bd7-8b4d-2bd40568b7d5', // Your n8n webhook Production URL
} as const;

// Update the getApiUrl function to handle the new N8N_WEBHOOK_ANOMALY_ALERT
export const getApiUrl = (endpoint: keyof typeof API_CONFIG.ENDPOINTS | 'N8N_WEBHOOK_ANOMALY_ALERT'): string => {
  if (endpoint === 'N8N_WEBHOOK_ANOMALY_ALERT') {
    return API_CONFIG.N8N_WEBHOOK_ANOMALY_ALERT;
  }
  // For other endpoints, concatenate with BASE_URL
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS[endpoint]}`;
};