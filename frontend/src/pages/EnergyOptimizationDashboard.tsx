import React, { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { getApiUrl } from '../config/api'; // Ensure this path is correct
import { useTheme } from '../components/ThemeProvider';
import AnnotationPlugin from 'chartjs-plugin-annotation';
import { Chart } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  AnnotationPlugin
);

// --- Interface Definitions ---
interface AnomalyData {
  prediction: string;
  prescription: {
    possible_reason: string;
    cause: string;
    solution: string;
  };
  history: {
    timestamp: string;
    power_kw: number;
    power_factor: number;
    label: string;
  }[];
  anomaly_counter: Record<string, number>;
  total_consumption: number;
  current_timestamp: string;
}

interface HistoricalData {
  monthly: { month: string; consumption: number }[];
  weekly: { week: string; week_label: string; consumption: number }[];
  daily: { date: string; y: number; anomaly_intensity: number }[];
}

interface BatchData {
  batches: { batch_id: number; consumption: number; total_anomalies: number }[];
}

interface TestResults {
  results: { timestamp: string; y: number; yhat: number }[];
}

interface ForecastData {
  forecast: {
    date: string;
    yhat: number;
    yhat_lower: number;
    yhat_upper: number;
    anomaly_intensity: number;
    is_month_end: boolean;
  }[];
}

// --- EnergyOptimizationDashboard Component ---
export const EnergyOptimizationDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();

  // State Declarations
  const [anomalyData, setAnomalyData] = useState<AnomalyData | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData | null>(null);
  const [batchData, setBatchData] = useState<BatchData | null>(null);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forecastParams, setForecastParams] = useState({
    startDate: '2025-05-12',
    endDate: '2025-05-26',
    production: 288000,
    anomalyIntensity: 5
  });
  // State to track the timestamp of the last anomaly reported to n8n
  const [lastAnomalyTimestamp, setLastAnomalyTimestamp] = useState<string | null>(null); 

  // Theme-aware chart colors
  const axisColor = theme === 'dark' ? '#f8fafc' : '#0f172a';
  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const cardBg = 'bg-card';
  const textMain = 'text-text';
  const textMuted = 'text-muted-foreground';
  const primary = 'text-primary';

  // --- Data Fetching Functions ---
  const fetchData = async () => {
    try {
      const response = await fetch(getApiUrl('REAL_TIME_DATA'));
      const data = await response.json();
      setAnomalyData(data);
    } catch (error) {
      console.error('Error fetching real-time data:', error);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch(getApiUrl('HISTORICAL_DATA'));
      const data = await response.json();
      setHistoricalData(data);
    } catch (error) {
      console.error('Error fetching historical data:', error);
    }
  };

  const fetchBatchData = async () => {
    try {
      const response = await fetch(getApiUrl('BATCH_DATA'));
      const data = await response.json();
      setBatchData(data);
    } catch (error) {
      console.error('Error fetching batch data:', error);
    }
  };

  const fetchTestResults = async () => {
    try {
      const response = await fetch(getApiUrl('TEST_RESULTS'));
      const data = await response.json();
      setTestResults(data);
    } catch (error) {
      console.error('Error fetching test results:', error);
    }
  };

  const generateForecast = async () => {
    try {
      const response = await fetch(getApiUrl('FORECAST'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_date: forecastParams.startDate,
          end_date: forecastParams.endDate,
          production: forecastParams.production,
          anomaly_intensity: forecastParams.anomalyIntensity
        })
      });
      const data = await response.json();
      setForecastData(data);
    } catch (error) {
      console.error('Error generating forecast:', error);
    }
  };

  // --- useEffect for Initial Data Fetching and Intervals ---
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([
        fetchData(),
        fetchHistoricalData(),
        fetchBatchData(),
        fetchTestResults(),
        generateForecast()
      ]);
      setLoading(false);
    };

    initializeData();

    // Set up intervals for real-time updates
    const dataInterval = setInterval(fetchData, 5000); // Fetches anomalyData every 10 seconds
    const historicalInterval = setInterval(fetchHistoricalData, 300000); // Less frequent updates

    return () => {
      clearInterval(dataInterval);
      clearInterval(historicalInterval);
    };
  }, []); // Empty dependency array means this runs once on mount


  // --- NEW useEffect for Webhook Triggering based on Anomaly Detection ---
  useEffect(() => {
    // Only proceed if anomalyData has been loaded and is not null
    if (anomalyData) {
      // Check if an anomaly is detected (prediction is not 'normal')
      if (anomalyData.prediction !== 'normal') {
        // Prevent sending the same anomaly multiple times if the timestamp hasn't changed
        // This is crucial for real-time updates where the same anomaly might persist
        if (anomalyData.current_timestamp !== lastAnomalyTimestamp) {
          console.log("Anomaly detected! Triggering n8n webhook...");

          const sendAnomalyToWebhook = async () => {
            try {
              // Get the n8n webhook URL from your updated config (config/api.ts)
              const webhookUrl = getApiUrl('N8N_WEBHOOK_ANOMALY_ALERT');

              // Prepare the data payload to send to n8n
              const anomalyInfo = {
                timestamp: anomalyData.current_timestamp,
                prediction: anomalyData.prediction,
                // Get the latest power_kw and power_factor from history
                current_power_kw: anomalyData.history[anomalyData.history.length - 1]?.power_kw,
                current_power_factor: anomalyData.history[anomalyData.history.length - 1]?.power_factor,
                total_consumption_today: anomalyData.total_consumption,
                
                // Include the full prescription details
                prescription: {
                  possible_reason: anomalyData.prescription.possible_reason,
                  cause: anomalyData.prescription.cause,
                  solution: anomalyData.prescription.solution,
                },
                
                // Include anomaly counts (filtered to non-normal anomalies)
                anomaly_counts: Object.entries(anomalyData.anomaly_counter)
                                    .filter(([label]) => label !== 'normal')
                                    .reduce((acc, [label, count]) => ({ ...acc, [label]: count }), {}),
              };

              // Send the POST request to the n8n webhook
              const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(anomalyInfo),
              });

              if (response.ok) {
                console.log('Anomaly information sent to n8n webhook successfully!');
                // Mark this anomaly timestamp as reported to prevent immediate re-trigger
                setLastAnomalyTimestamp(anomalyData.current_timestamp);
              } else {
                const errorText = await response.text();
                console.error(`Failed to send anomaly information to n8n webhook: ${response.status} - ${response.statusText}`, errorText);
              }
            } catch (error) {
              console.error('Error sending anomaly information to n8n webhook:', error);
            }
          };
          sendAnomalyToWebhook();
        } else {
          console.log("Anomaly detected, but already reported for this specific timestamp. Skipping webhook re-trigger.");
        }
      } else {
        // If the system returns to 'normal' prediction, reset the lastAnomalyTimestamp
        // This allows new anomalies to be reported once they re-occur
        if (lastAnomalyTimestamp !== null) {
          console.log("System is back to normal. Resetting anomaly tracker.");
          setLastAnomalyTimestamp(null);
        }
      }
    }
  }, [anomalyData, lastAnomalyTimestamp]); // Dependencies: Re-run this effect when anomalyData or lastAnomalyTimestamp changes


  // --- Loading State Display ---
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-background text-text transition-colors duration-300">
        Loading...
      </div>
    );
  }

  // --- Main Component Render (JSX) ---
  return (
    <div className="min-h-screen bg-background text-text transition-colors duration-300">
      <div className="container mx-auto px-4 py-8">
        {/* Header with back button */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-background hover:bg-primary/90 transition-colors duration-200"
          >
            <ArrowLeft size={20} />
            Back
          </button>
        </div>

        <div className={`${cardBg} p-6 rounded-xl mb-8 transition-colors duration-300`}>
          <h1 className="text-2xl font-bold text-text">Energy Optimization Dashboard</h1>
          <div className={`text-sm ${textMuted}`}>Last updated: {anomalyData?.current_timestamp}</div>
        </div>

        {/* KPI Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className={`${cardBg} p-4 rounded-xl text-center transition-colors duration-300`}>
            <div className={`text-sm ${textMuted}`}>Current Power</div>
            <div className={`text-2xl font-semibold ${primary}`}>
              {anomalyData?.history[anomalyData.history.length - 1]?.power_kw.toFixed(1)} kW
            </div>
          </div>
          <div className={`${cardBg} p-4 rounded-xl text-center transition-colors duration-300`}>
            <div className={`text-sm ${textMuted}`}>Power Factor</div>
            <div className={`text-2xl font-semibold ${primary}`}>
              {anomalyData?.history[anomalyData.history.length - 1]?.power_factor.toFixed(2)}
            </div>
          </div>
          <div className={`${cardBg} p-4 rounded-xl text-center transition-colors duration-300`}>
            <div className={`text-sm ${textMuted}`}>Total Consumption Today</div>
            <div className={`text-2xl font-semibold ${primary}`}>
              {anomalyData?.total_consumption.toFixed(1)} kWh
            </div>
          </div>
          <div className={`${cardBg} p-4 rounded-xl text-center transition-colors duration-300`}>
            <div className={`text-sm ${textMuted}`}>Anomalies Today</div>
            <div className={`text-2xl font-semibold ${primary}`}>
              {Object.entries(anomalyData?.anomaly_counter || {})
                .filter(([label]) => label !== 'normal')
                .reduce((sum, [_, count]) => sum + count, 0)}
            </div>
          </div>
          <div className={`${cardBg} p-4 rounded-xl text-center transition-colors duration-300`}>
            <div className={`text-sm ${textMuted}`}>System Status</div>
            <div className={`text-2xl font-semibold ${anomalyData?.prediction === 'normal' ? primary : 'text-destructive'}`}>{anomalyData?.prediction === 'normal' ? 'Normal' : 'Anomaly Detected'}</div>
          </div>
        </div>

        {/* Real-time Monitoring Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className={`${cardBg} p-4 rounded-xl transition-colors duration-300`}>
            <h3 className="text-lg font-semibold mb-4 text-text">Power (kW) - Real-time</h3>
            <div className="h-[300px]">
              <Line
                data={{
                  labels: anomalyData?.history.map(h => h.timestamp) || [],
                  datasets: [{
                    label: 'Power (kW)',
                    data: anomalyData?.history.map(h => h.power_kw) || [],
                    borderColor: theme === 'dark' ? '#00FFCC' : '#0f172a',
                    backgroundColor: theme === 'dark' ? 'rgba(0,255,204,0.1)' : 'rgba(15,23,42,0.1)',
                    pointBackgroundColor: anomalyData?.history.map(h => {
                      const power = h.power_kw;
                      const normalColor = theme === 'dark' ? '#00FFCC' : '#0f172a';
                      return (power >= 50 && (power < 350 || power > 400)) ? 'red' : normalColor;
                    }) || [],
                    fill: true,
                    tension: 0.4
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: { ticks: { color: axisColor }, grid: { color: gridColor } },
                    x: { ticks: { color: axisColor }, grid: { color: gridColor } }
                  },
                  plugins: { 
                    legend: { labels: { color: axisColor } },
                    annotation: {
                      annotations: {
                        upperLimit: {
                          type: 'line',
                          yMin: 400,
                          yMax: 400,
                          borderColor: 'rgb(255, 99, 132)',
                          borderWidth: 2,
                          label: {
                            content: 'Upper Limit',
                            display: true,
                            position: 'end'
                          }
                        },
                        lowerLimit: {
                          type: 'line',
                          yMin: 350,
                          yMax: 350,
                          borderColor: 'rgb(255, 99, 132)',
                          borderWidth: 2,
                          label: {
                            content: 'Lower Limit',
                            display: true,
                            position: 'start'
                          }
                        }
                      }
                    }
                  } // Corrected closing brace for plugins object
                }}
              />
            </div>
          </div>
          <div className={`${cardBg} p-4 rounded-xl transition-colors duration-300`}>
            <h3 className="text-lg font-semibold mb-4 text-text">Power Factor - Real-time</h3>
            <div className="h-[300px]">
              <Line
                data={{
                  labels: anomalyData?.history.map(h => h.timestamp) || [],
                  datasets: [{
                    label: 'Power Factor',
                    data: anomalyData?.history.map(h => h.power_factor) || [],
                    borderColor: theme === 'dark' ? '#00FFCC' : '#0f172a',
                    backgroundColor: theme === 'dark' ? 'rgba(0,255,204,0.1)' : 'rgba(15,23,42,0.1)',
                    pointBackgroundColor: anomalyData?.history.map(h => {
                      const powerFactor = h.power_factor;
                      const normalColor = theme === 'dark' ? '#00FFCC' : '#0f172a';
                      return (powerFactor >= 0.1 && (powerFactor < 0.70 || powerFactor > 0.95)) ? 'red' : normalColor;
                    }) || [],
                    fill: true,
                    tension: 0.4
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: { ticks: { color: axisColor }, grid: { color: gridColor } },
                    x: { ticks: { color: axisColor }, grid: { color: gridColor } }
                  },
                  plugins: { 
                    legend: { labels: { color: axisColor } },
                    annotation: {
                      annotations: {
                        upperLimit: {
                          type: 'line',
                          yMin: 0.95,
                          yMax: 0.95,
                          borderColor: 'rgb(255, 99, 132)',
                          borderWidth: 2,
                          label: {
                            content: 'Upper Limit',
                            display: true,
                            position: 'end'
                          }
                        },
                        lowerLimit: {
                          type: 'line',
                          yMin: 0.70,
                          yMax: 0.70,
                          borderColor: 'rgb(255, 99, 132)',
                          borderWidth: 2,
                          label: {
                            content: 'Lower Limit',
                            display: true,
                            position: 'start'
                          }
                        }
                      }
                    }
                  } // Corrected closing brace for plugins object
                }}
              />
            </div>
          </div>
        </div>

        {/* Anomaly Section */}
        <div className="bg-card p-6 rounded-xl mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Latest Anomaly Detection</h3>
            <div className={`px-4 py-2 rounded-full ${
              anomalyData?.prediction === 'normal' ? 'bg-green-500' : 'bg-red-500'
            }`}>
              {anomalyData?.prediction}
            </div>
          </div>
          <div className="flex gap-4 flex-wrap">
            {Object.entries(anomalyData?.anomaly_counter || {})
              .filter(([label]) => label !== 'normal')
              .map(([label, count]) => (
                <div key={label} className="bg-red-500 px-4 py-2 rounded-full">
                  {label}: {count}
                </div>
              ))}
          </div>
        </div>

        {/* Prescription Section */}
        <div className="bg-card p-6 rounded-xl mb-8">
          <h3 className="text-lg font-medium mb-4">Prescription</h3>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Possible Reason</div>
              <div className="text-lg">{anomalyData?.prescription.possible_reason}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Cause</div>
              <div className="text-lg">{anomalyData?.prescription.cause}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Solution</div>
              <div className="text-lg">{anomalyData?.prescription.solution}</div>
            </div>
          </div>
        </div>

        {/* Historical Analysis Section */}
        <div className="bg-card p-6 rounded-xl mb-8">
          <h3 className="text-lg font-medium mb-4">Historical Consumption Analysis</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-md mb-2">Monthly Consumption Trend</h4>
              <div className="h-[300px]">
                <Bar
                  data={{
                    labels: historicalData?.monthly.map(m => m.month) || [],
                    datasets: [{
                      label: 'Monthly Consumption',
                      data: historicalData?.monthly.map(m => m.consumption) || [],
                      backgroundColor: '#00FFCC'
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: { ticks: { color: axisColor }, grid: { color: gridColor } },
                      x: { ticks: { color: axisColor }, grid: { color: gridColor } }
                    },
                    plugins: { legend: { labels: { color: axisColor } } }
                  }}
                />
              </div>
            </div>
            <div>
              <h4 className="text-md mb-2">Weekly Consumption Trend</h4>
              <div className="h-[300px]">
                <Bar
                  data={{
                    labels: historicalData?.weekly.map(w => w.week_label) || [],
                    datasets: [{
                      label: 'Weekly Consumption',
                      data: historicalData?.weekly.map(w => w.consumption) || [],
                      backgroundColor: '#00FFCC'
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: { ticks: { color: axisColor }, grid: { color: gridColor } },
                      x: { ticks: { color: axisColor }, grid: { color: gridColor } }
                    },
                    plugins: { legend: { labels: { color: axisColor } } }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Daily Consumption Chart */}
        <div className="bg-card p-6 rounded-xl mb-8">
          <h3 className="text-lg font-medium mb-4">Daily Consumption with Anomaly Intensity</h3>
          <div className="h-[300px]">
            <Chart
              type='line'
              data={{
                labels: historicalData?.daily.map(d => d.date) || [],
                datasets: [
                  {
                    label: 'Daily Consumption',
                    data: historicalData?.daily.map(d => d.y) || [],
                    borderColor: '#00FFCC',
                    backgroundColor: 'rgba(0, 255, 204, 0.1)',
                    fill: true,
                    yAxisID: 'y',
                    type: 'line'
                  },
                  {
                    label: 'Anomaly Intensity',
                    data: historicalData?.daily.map(d => d.anomaly_intensity) || [],
                    borderColor: 'rgba(255, 99, 132, 0.5)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    type: 'bar',
                    yAxisID: 'y1'
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { ticks: { color: axisColor }, grid: { color: gridColor } },
                  y1: { ticks: { color: axisColor }, grid: { color: gridColor } },
                  x: { ticks: { color: axisColor }, grid: { color: gridColor } }
                },
                plugins: { legend: { labels: { color: axisColor } } }
              }}
            />
          </div>
        </div>

        {/* Batchwise Consumption Chart */}
        <div className="bg-card p-6 rounded-xl mb-8">
          <h3 className="text-lg font-medium mb-4">Yesterday's Batchwise Consumption</h3>
          <div className="h-[300px]">
            <Chart
              type='bar'
              data={{
                labels: batchData?.batches.map(b => `Batch ${b.batch_id}`) || [],
                datasets: [
                  {
                    label: 'Energy Consumption (kWh)',
                    data: batchData?.batches.map(b => b.consumption) || [],
                    backgroundColor: 'rgba(0, 255, 204, 0.7)',
                    borderColor: 'rgba(0, 255, 204, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                  },
                  {
                    label: 'Total Anomalies',
                    data: batchData?.batches.map(b => b.total_anomalies) || [],
                    type: 'line',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    yAxisID: 'y1'
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { ticks: { color: axisColor }, grid: { color: gridColor } },
                  y1: { ticks: { color: axisColor }, grid: { color: gridColor } },
                  x: { ticks: { color: axisColor }, grid: { color: gridColor } }
                },
                plugins: { legend: { labels: { color: axisColor } } }
              }}
            />
          </div>
        </div>

        {/* Test Results Chart */}
        <div className="bg-card p-6 rounded-xl mb-8">
          <h3 className="text-lg font-medium mb-4">Actual vs Predictions - Model Results</h3>
          <div className="h-[300px]">
            <Line
              data={{
                labels: testResults?.results.map(r => r.timestamp) || [],
                datasets: [
                  {
                    label: 'Actual Consumption',
                    data: testResults?.results.map(r => r.y) || [],
                    borderColor: 'rgba(0, 255, 204, 1)',
                    backgroundColor: 'rgba(0, 255, 204, 0.1)',
                    fill: true
                  },
                  {
                    label: 'Predicted Consumption',
                    data: testResults?.results.map(r => r.yhat) || [],
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    fill: true,
                    borderDash: [5, 5]
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { ticks: { color: axisColor }, grid: { color: gridColor } },
                  x: { ticks: { color: axisColor }, grid: { color: gridColor } }
                },
                plugins: { legend: { labels: { color: axisColor } } }
              }}
            />
          </div>
        </div>

        {/* Forecasting Section */}
        <div className="bg-card p-6 rounded-xl">
          <h3 className="text-lg font-medium mb-4">Energy Consumption Forecast</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Start Date</label>
              <input
                type="date"
                className="w-full bg-background border border-gray-600 rounded p-2 text-text"
                value={forecastParams.startDate}
                onChange={(e) => setForecastParams(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">End Date</label>
              <input
                type="date"
                className="w-full bg-background border border-gray-600 rounded p-2 text-text"
                value={forecastParams.endDate}
                onChange={(e) => setForecastParams(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Total Production (kg)</label>
              <input
                type="number"
                className="w-full bg-background border border-gray-600 rounded p-2 text-text"
                value={forecastParams.production}
                onChange={(e) => setForecastParams(prev => ({ ...prev, production: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Anomaly Intensity (%)</label>
              <input
                type="number"
                className="w-full bg-background border border-gray-600 rounded p-2 text-text"
                value={forecastParams.anomalyIntensity}
                onChange={(e) => setForecastParams(prev => ({ ...prev, anomalyIntensity: Number(e.target.value) }))}
                min={0}
                max={100}
              />
            </div>
          </div>
          <button
            onClick={generateForecast}
            className="w-full bg-primary text-background py-2 rounded font-medium hover:bg-primary/90 transition-colors"
          >
            Generate Forecast
          </button>
          <div className="h-[300px] mt-4">
            <Chart
              type='line'
              data={{
                labels: forecastData?.forecast.map(f => f.date) || [],
                datasets: [
                  {
                    label: 'Forecasted Consumption',
                    data: forecastData?.forecast.map(f => f.yhat) || [],
                    borderColor: 'rgba(0, 255, 204, 1)',
                    backgroundColor: 'rgba(0, 255, 204, 0.1)',
                    fill: true,
                    yAxisID: 'y',
                    type: 'line'
                  },
                  {
                    label: 'Confidence Interval',
                    data: forecastData?.forecast.map(f => f.yhat_upper) || [],
                    borderColor: 'rgba(0, 255, 204, 0.3)',
                    backgroundColor: 'rgba(0, 255, 204, 0.4)',
                    fill: '+1',
                    pointRadius: 0,
                    yAxisID: 'y',
                    type: 'line'
                  },
                  {
                    label: 'Lower Bound',
                    data: forecastData?.forecast.map(f => f.yhat_lower) || [],
                    borderColor: 'rgba(0, 255, 204, 0.3)',
                    backgroundColor: 'rgba(0, 255, 204, 0.1)',
                    fill: false,
                    pointRadius: 0,
                    yAxisID: 'y',
                    type: 'line'
                  },
                  {
                    label: 'Anomaly Intensity',
                    data: forecastData?.forecast.map(f => f.anomaly_intensity) || [],
                    type: 'bar',
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    yAxisID: 'y1'
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { ticks: { color: axisColor }, grid: { color: gridColor } },
                  y1: { ticks: { color: axisColor }, grid: { color: gridColor } },
                  x: { ticks: { color: axisColor }, grid: { color: gridColor } }
                },
                plugins: { legend: { labels: { color: axisColor } } }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};