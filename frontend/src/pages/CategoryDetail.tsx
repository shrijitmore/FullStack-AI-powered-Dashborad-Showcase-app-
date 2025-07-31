import { useState, useEffect, useRef } from 'react';
import annotationPlugin from 'chartjs-plugin-annotation';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Line, Bar, Pie, Chart } from 'react-chartjs-2';
import { ChevronLeft, Search, ArrowUpIcon, ArrowDownIcon, MinusIcon, Upload } from 'lucide-react';
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
  TooltipItem,
  ArcElement,
  ChartOptions,
  ChartType,
  ScaleOptionsByType,
  ScriptableContext,
  ChartDataset,
  Point,
  BubbleDataPoint,
  Scale,
  CoreScaleOptions,
  Tick
} from 'chart.js';
import { loadData } from '../utils/dataLoader';
import type { MonitoringData } from '../types';
import { format, parseISO } from 'date-fns';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useTheme } from '../components/ThemeProvider';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  annotationPlugin
);

const API_BASE_URL = 'https://dashboard-backend-8spg.onrender.com/api';

type Card = {
  title: string;
  value: string;
  unit: string;
  description: string;
  trend: 'up' | 'down' | 'neutral';
};

type ChartConfig = {
  chartType: 'line' | 'bar' | 'pie';
  title: string;
  labels: string[];
  datasets: ChartDataset<ChartType, (number | [number, number] | Point | BubbleDataPoint | null)[]>[];
  options: ChartOptions<ChartType>;
};

type DisplayConfig = {
  displayType: 'chart' | 'cards';
  chartConfig?: ChartConfig;
  cards?: Card[];
};

type GeneratedResponse = {
  displayConfig: DisplayConfig;
};

type DepartmentCost = {
  _id: string;
  totalCost: number;
};

type AvgKWHDataPoint = {
  Date: string;
  avg_of_IF1: number;
  avg_of_IF2: number;
};

type KWHPartsDataPoint = {
  _id: string;
  machineData: { [key: string]: number | null };
};

type CombinedDataPoint = {
  date: string;
  sum_of_moltenmetal: number;
  sum_of_consumtion: number;
};

type MsebTimeZoneDataPoint = {
  date: string;
  zoneA: number;
  zoneB: number;
  zoneC: number;
  zoneD: number;
};

type ConsumptionByDepartmentData = {
  Date: string;
  Departments: {
    [key: string]: {
      [hour: string]: {
        consumption: number;
        P_F: number;
      };
    };
  };
};

// Theme-aware color constants
const chartColors = {
  primary: {
    light: '#2196F3',
    dark: '#64B5F6'
  },
  secondary: {
    light: '#FF6B6B',
    dark: '#FF8A8A'
  },
  success: {
    light: '#2ECC71',
    dark: '#4CAF50'
  },
  warning: {
    light: '#FFD93D',
    dark: '#FFC107'
  },
  danger: {
    light: '#FF0000',
    dark: '#FF5252'
  },
  background: {
    light: 'rgba(255, 255, 255, 0.9)',
    dark: 'rgba(19, 47, 76, 0.9)'
  },
  text: {
    light: '#1a1a1a',
    dark: '#ffffff'
  },
  grid: {
    light: 'rgba(0, 0, 0, 0.1)',
    dark: 'rgba(255, 255, 255, 0.1)'
  }
};

export function CategoryDetail() {
  const { theme } = useTheme();
  const { categoryName } = useParams<{ categoryName: string }>();
  const [data, setData] = useState<MonitoringData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDepartmentCostLoading, setIsDepartmentCostLoading] = useState(true);
  const [isAvgKWHLoading, setIsAvgKWHLoading] = useState(true);
  const [isKwhPartsLoading, setIsKwhPartsLoading] = useState(true);
  const [isCombinedDataLoading, setIsCombinedDataLoading] = useState(true);
  const [isMsebTimeZoneLoading, setIsMsebTimeZoneLoading] = useState(true);
  const [isConsumptionLoading, setIsConsumptionLoading] = useState(true);
  const [msebCostData, setMsebCostData] = useState({
    labels: ['Peak Hours', 'Normal Hours', 'Off-Peak Hours'],
    datasets: [
      {
        label: 'Zone A',
        data: [0, 0, 0],
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
      },
      {
        label: 'Zone B',
        data: [0, 0, 0],
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
      },
      {
        label: 'Zone C',
        data: [0, 0, 0],
        backgroundColor: 'rgba(255, 206, 86, 0.5)',
      },
      {
        label: 'Zone D',
        data: [0, 0, 0],
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      }
    ]
  });
  const [departmentCostData, setDepartmentCostData] = useState<{
    labels: string[];
    datasets: { data: number[]; backgroundColor: string[]; borderWidth: number; cutout: string; }[];
  }>({
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [
        '#FF6B6B',
        '#FFD93D',
        '#95D03A',
        '#2ECC71',
        '#a6d0ed'
      ],
      borderWidth: 0,
      cutout: '70%'
    }]
  });
  const [avgKWHData, setAvgKWHData] = useState<{
    labels: string[];
    datasets: ChartDataset<'line'>[];
  }>({ 
    labels: [],
    datasets: []
  });
  const [selectedOption, setSelectedOption] = useState<string>('combined');
  const [avgKWHChartOptions, setAvgKWHChartOptions] = useState<ChartOptions<'line'>>({
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        min: 0,
      },
    },
  });
  const [kwhPartsData, setKwhPartsData] = useState<KWHPartsDataPoint[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>('');
  const [kwhTrendData, setKwhTrendData] = useState<{
    labels: string[];
    datasets: ChartDataset<'line'>[];
  }>({
    labels: [],
    datasets: [{
      label: 'KWH/Tonne',
      data: [],
      borderColor: '#2196F3',
      backgroundColor: 'rgba(33, 150, 243, 0.1)',
      hoverBackgroundColor: 'rgba(33, 150, 243, 0.2)',
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 8,
      pointBackgroundColor: '#2196F3',
      pointHoverBackgroundColor: '#1976D2',
      pointBorderColor: '#fff',
      pointHoverBorderColor: '#fff',
      pointBorderWidth: 2,
      pointHoverBorderWidth: 3,
      borderWidth: 2,
      hoverBorderWidth: 3,
      fill: true,
    }]
  });
  const [kwhChartOptions, setKwhChartOptions] = useState<ChartOptions<'line'>>({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'KWH/Part',
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Date',
          font: {
            size: 12,
            weight: 'bold'
          }
        },
        ticks: {
          maxRotation: 0,
          minRotation: 0,
          callback: function(tickValue: string | number, index: number, ticks: Tick[]) {
            const label = ticks[index].label as string;
            if (label) {
              const parsedDate = parseISO(label);
              if (!isNaN(parsedDate.getTime())) {
                return format(parsedDate, 'dd MMM yy');
              }
            }
            return tickValue;
          }
        }
      }
    },
  });
  const [combinedData, setCombinedData] = useState<{
    labels: string[];
    datasets: ChartDataset<"line" | "bar">[];
  }>({ labels: [], datasets: [] });
  const [yAxisMin, setYAxisMin] = useState<number | undefined>(undefined);
  const [msebTimeZoneData, setMsebTimeZoneData] = useState<{
    labels: string[];
    datasets: ChartDataset<'bar'>[];
  }>({ 
    labels: [],
    datasets: []
  });
  const [consumptionData, setConsumptionData] = useState<ConsumptionByDepartmentData[] | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDepartment, setSelectedDepartment] = useState<string>('Melting');
  const [selectedMetric, setSelectedMetric] = useState<'consumption' | 'P_F'>('consumption');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGeneratedGraph, setShowGeneratedGraph] = useState(false);
  const [generatedData, setGeneratedData] = useState<GeneratedResponse | null>(null);
  const chartRef = useRef<ChartJS | null>(null);
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme-aware chart options
  const getChartOptions = (): ChartOptions<'line'> => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: theme === 'dark' ? chartColors.text.dark : chartColors.text.light,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? chartColors.background.dark : chartColors.background.light,
        titleColor: theme === 'dark' ? chartColors.text.dark : chartColors.text.light,
        bodyColor: theme === 'dark' ? chartColors.text.dark : chartColors.text.light,
        borderColor: theme === 'dark' ? chartColors.grid.dark : chartColors.grid.light,
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: theme === 'dark' ? chartColors.grid.dark : chartColors.grid.light
        },
        ticks: {
          color: theme === 'dark' ? chartColors.text.dark : chartColors.text.light,
          maxRotation: 0,
          minRotation: 0,
          callback: function(tickValue: string | number, index: number, ticks: Tick[]) {
            const label = ticks[index].label as string;
            if (label) {
              const parsedDate = parseISO(label);
              if (!isNaN(parsedDate.getTime())) {
                return format(parsedDate, 'dd MMM yy');
              }
            }
            return tickValue;
          }
        }
      },
      y: {
        grid: {
          color: theme === 'dark' ? chartColors.grid.dark : chartColors.grid.light
        },
        ticks: {
          color: theme === 'dark' ? chartColors.text.dark : chartColors.text.light,
          callback: function(tickValue: string | number) {
            return `₹${(tickValue as number).toLocaleString('en-IN')}`;
          }
        }
      }
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allData = await loadData();
        const categoryData = allData.filter(
          (item: MonitoringData) => item.category === decodeURIComponent(categoryName ?? '')
        );
        setData(categoryData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [categoryName]);

  useEffect(() => {
    const fetchDepartmentCosts = async () => {
      try {
        setIsDepartmentCostLoading(true);
        const response = await fetch(`${API_BASE_URL}/aggregate-energy-costs`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        const costs: DepartmentCost[] = result.aggregatedCosts;

        setDepartmentCostData({
          labels: costs.map((cost: DepartmentCost) => cost._id),
          datasets: [{
            data: costs.map((cost: DepartmentCost) => cost.totalCost),
            backgroundColor: [
              '#FF6B6B',
              '#FFD93D',
              '#95D03A',
              '#2ECC71',
              '#a6d0ed'
            ],
            borderWidth: 0,
            cutout: '70%'
          }]
        });
      } catch (error) {
        console.error('Error fetching department costs:', error);
      } finally {
        setIsDepartmentCostLoading(false);
        setIsLoading(false);
      }
    };

    fetchDepartmentCosts();
  }, []);

  useEffect(() => {
    const fetchAvgKWHData = async () => {
      try {
        setIsAvgKWHLoading(true);
        const response = await fetch(`${API_BASE_URL}/avgKWH`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        const avgKWH: AvgKWHDataPoint[] = result.aggregatedData;

        const labels = avgKWH.map((data: AvgKWHDataPoint) => data.Date);
        const datasets: ChartDataset<'line'>[] = [];

        if (selectedOption === 'combined') {
          datasets.push({
            label: 'Combined Average KWH',
            data: avgKWH.map((data: AvgKWHDataPoint) => (data.avg_of_IF1 + data.avg_of_IF2) / 2),
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: function(context: ScriptableContext<'line'>) {
              const value = context.raw as number;
              return value > 675 ? '#FF0000' : '#2196F3';
            },
            pointBorderColor: function(context: ScriptableContext<'line'>) {
              const value = context.raw as number;
              return value > 675 ? '#FF0000' : '#2196F3';
            },
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 8,
            pointBorderWidth: 2,
            pointHoverBorderWidth: 3,
          });
        } else if (selectedOption === 'IF1') {
          datasets.push({
            label: 'Average KWH - IF1',
            data: avgKWH.map((data: AvgKWHDataPoint) => data.avg_of_IF1),
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: function(context: ScriptableContext<'line'>) {
              const value = context.raw as number;
              return value > 675 ? '#FF0000' : '#2196F3';
            },
            pointBorderColor: function(context: ScriptableContext<'line'>) {
              const value = context.raw as number;
              return value > 675 ? '#FF0000' : '#2196F3';
            },
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 8,
            pointBorderWidth: 2,
            pointHoverBorderWidth: 3,
          });
        } else if (selectedOption === 'IF2') {
          datasets.push({
            label: 'Average KWH - IF2',
            data: avgKWH.map((data: AvgKWHDataPoint) => data.avg_of_IF2),
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: function(context: ScriptableContext<'line'>) {
              const value = context.raw as number;
              return value > 675 ? '#FF0000' : '#2196F3';
            },
            pointBorderColor: function(context: ScriptableContext<'line'>) {
              const value = context.raw as number;
              return value > 675 ? '#FF0000' : '#2196F3';
            },
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 8,
            pointBorderWidth: 2,
            pointHoverBorderWidth: 3,
          });
        }

        setAvgKWHData({
          labels,
          datasets,
        });

        const allDataPoints = datasets.flatMap(dataset => dataset.data as number[]);
        const minYValue = allDataPoints.length > 0 ? Math.min(...allDataPoints) : 0;

        setAvgKWHChartOptions({
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              min: (minYValue < 0 ? 0 : minYValue) - 10,
              title: {
                display: true,
                text: 'KWH/Tonne',
                font: {
                  size: 12,
                  weight: 'bold'
                },
                color: chartColors.text.light
              },
              grid: {
                color: chartColors.grid.light
              },
              ticks: {
                color: chartColors.text.light,
                padding: 8,
                font: {
                  size: 11,
                },
              }
            },
            x: {
              title: {
                display: true,
                text: 'Date',
                font: {
                  size: 14,
                  weight: 'bold'
                },
                color: chartColors.text.light
              },
              ticks: {
                maxRotation: 45,
                minRotation: 45,
                callback: function(tickValue: string | number, index: number, ticks: Tick[]) {
                  const label = ticks[index].label as string;
                  if (label) {
                    const parsedDate = parseISO(label);
                    if (!isNaN(parsedDate.getTime())) {
                      return format(parsedDate, 'dd MMM yy');
                    }
                  }
                  return tickValue;
                },
                color: chartColors.text.light,
                padding: 8,
                font: {
                  size: 11,
                },
              }
            }
          },
          plugins: {
            annotation: {
              annotations: {
                thresholdLine: {
                  type: 'line',
                  yMin: 675,
                  yMax: 675,
                  borderColor: '#FF0000',
                  borderWidth: 2,
                  borderDash: [5, 5],
                  label: {
                    content: 'Threshold (675)',
                    display: true,
                    position: 'end',
                    backgroundColor: 'rgba(255, 0, 0, 0.8)',
                    color: 'white',
                    padding: 4
                  }
                }
              }
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: theme === 'dark' ? 'rgba(19, 47, 76, 0.9)' : 'rgba(255, 255, 255, 0.9)',
              titleColor: chartColors.text.light,
              bodyColor: chartColors.text.light,
              borderColor: chartColors.grid.light,
              borderWidth: 1,
            },
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: chartColors.text.light,
                font: {
                  size: 12
                }
              }
            }
          }
        });
      } catch (error) {
        console.error('Error fetching average KWH data:', error);
      } finally {
        setIsAvgKWHLoading(false);
        setIsLoading(false);
      }
    };

    fetchAvgKWHData();
  }, [selectedOption, chartColors.text.light, chartColors.grid.light, theme]);

  useEffect(() => {
    const fetchKWHPartsData = async () => {
      try {
        setIsKwhPartsLoading(true);
        const response = await fetch(`${API_BASE_URL}/KWHParts`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        const aggregatedData: KWHPartsDataPoint[] = result.aggregatedData;
        setKwhPartsData(aggregatedData);

        const machineMinValues: number[] = [];
        aggregatedData.forEach((data: KWHPartsDataPoint) => {
          Object.values(data.machineData).forEach((value: number | null) => {
            if (value !== null && value !== undefined) {
              machineMinValues.push(value);
            }
          });
        });

        const minYValue = machineMinValues.length > 0 ? Math.min(...machineMinValues) : 0;

        setKwhTrendData({
          labels: aggregatedData.map((data: KWHPartsDataPoint) => data._id),
          datasets: [{
            label: 'KWH/Tonne',
            data: aggregatedData.map((data: KWHPartsDataPoint) => {
              if (selectedMachine) {
                return data.machineData[selectedMachine] || 0;
              } else {
                const values = Object.values(data.machineData);
                const validValues = values.filter((value: number | null) => value !== null && value !== undefined) as number[];
                return validValues.length > 0 ? 
                  validValues.reduce((acc: number, curr: number) => acc + curr, 0) / validValues.length : 
                  0;
              }
            }),
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            hoverBackgroundColor: 'rgba(33, 150, 243, 0.2)',
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 8,
            pointBackgroundColor: '#2196F3',
            pointHoverBackgroundColor: '#1976D2',
            pointBorderColor: '#fff',
            pointHoverBorderColor: '#fff',
            borderWidth: 2,
            hoverBorderWidth: 3,
            fill: true,
          }]
        });

        setKwhChartOptions((prevOptions: ChartOptions<'line'>) => ({
          ...prevOptions,
          scales: {
            y: {
              ...(prevOptions.scales?.y as ScaleOptionsByType<'linear'>),
              min: minYValue,
              title: {
                ...(prevOptions.scales?.y as ScaleOptionsByType<'linear'>).title,
                color: chartColors.text.light
              },
              ticks: {
                ...(prevOptions.scales?.y as ScaleOptionsByType<'linear'>).ticks,
                color: chartColors.text.light
              }
            },
            x: {
              ...(prevOptions.scales?.x as ScaleOptionsByType<'category'>),
              title: {
                ...(prevOptions.scales?.x as ScaleOptionsByType<'category'>).title,
                color: chartColors.text.light
              },
              ticks: {
                ...(prevOptions.scales?.x as ScaleOptionsByType<'category'>).ticks,
                color: chartColors.text.light
              }
            }
          },
          plugins: {
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: theme === 'dark' ? 'rgba(19, 47, 76, 0.9)' : 'rgba(255, 255, 255, 0.9)',
              titleColor: chartColors.text.light,
              bodyColor: chartColors.text.light,
              borderColor: chartColors.grid.light,
              borderWidth: 1,
            },
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: chartColors.text.light
              }
            }
          }
        }));

      } catch (error) {
        console.error('Error fetching KWH parts data:', error);
      } finally {
        setIsKwhPartsLoading(false);
        setIsLoading(false);
      }
    };

    fetchKWHPartsData();
  }, [selectedMachine, chartColors.text.light, chartColors.grid.light, theme]); 

  useEffect(() => {
    const fetchCombinedData = async () => {
      try {
        setIsCombinedDataLoading(true);
        const response = await fetch(`${API_BASE_URL}/ConsumptionMoltenMetal`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        const aggregatedData: CombinedDataPoint[] = result.aggregatedData;

        const labels = aggregatedData.map((data: CombinedDataPoint) => data.date);
        const moltenMetalData = aggregatedData.map((data: CombinedDataPoint) => data.sum_of_moltenmetal);
        const consumptionData = aggregatedData.map((data: CombinedDataPoint) => data.sum_of_consumtion);

        const minYValue = Math.min(...consumptionData, ...moltenMetalData);
        setYAxisMin(minYValue < 0 ? 0 : minYValue); 

        setCombinedData({
          labels,
          datasets: [
            {
              type: 'line',
              label: 'Molten Metal',
              data: moltenMetalData,
              borderColor: '#FFD700',
              fill: false,
              borderWidth: 3,
              pointRadius: 4
            },
            {
              type: 'bar',
              label: 'Consumption',
              data: consumptionData,
              backgroundColor: (context: ScriptableContext<'bar'>) => {
                const index = context.dataIndex;
                const consumption = consumptionData[index];
                const moltenMetal = moltenMetalData[index];
                return (consumption/(moltenMetal/1000)) > 1020 ? '#FF5252' : '#2196F3';
              },
              borderWidth: 2,
              order: 0, 
            },
          ]
        });
      } catch (error) {
        console.error('Error fetching combined data:', error);
      } finally {
        setIsCombinedDataLoading(false);
        setIsLoading(false);
      }
    };

    fetchCombinedData();
  }, []);

  useEffect(() => {
    const fetchTimeZoneData = async () => {
      try {
        setIsMsebTimeZoneLoading(true);
        const response = await fetch(`${API_BASE_URL}/TimeZone`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        
        if (!result.aggregatedData || !Array.isArray(result.aggregatedData)) {
          console.error('Invalid data format received:', result);
          return;
        }

        const dates = result.aggregatedData.map((item: MsebTimeZoneDataPoint) => item.date);
        
        const datasets: ChartDataset<'bar'>[] = [
          {
            label: 'Zone A',
            data: result.aggregatedData.map((item: MsebTimeZoneDataPoint) => item.zoneA),
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            stack: 'Stack 0',
          },
          {
            label: 'Zone B',
            data: result.aggregatedData.map((item: MsebTimeZoneDataPoint) => item.zoneB),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            stack: 'Stack 0',
          },
          {
            label: 'Zone C',
            data: result.aggregatedData.map((item: MsebTimeZoneDataPoint) => item.zoneC),
            backgroundColor: 'rgba(255, 206, 86, 0.5)',
            stack: 'Stack 0',
          },
          {
            label: 'Zone D',
            data: result.aggregatedData.map((item: MsebTimeZoneDataPoint) => item.zoneD),
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            stack: 'Stack 0',
          }
        ];

        setMsebTimeZoneData({
          labels: dates,
          datasets: datasets
        });
      } catch (error) {
        console.error('Error fetching time zone data:', error);
      } finally {
        setIsMsebTimeZoneLoading(false);
        setIsLoading(false);
      }
    };

    fetchTimeZoneData();
  }, []);

  useEffect(() => {
    const fetchConsumptionData = async () => {
      try {
        setIsConsumptionLoading(true);
        const response = await fetch(`${API_BASE_URL}/consumption`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        setConsumptionData(result.aggregatedData);
      } catch (error) {
        console.error('Error fetching consumption data:', error);
      } finally {
        setIsConsumptionLoading(false);
        setIsLoading(false);
      }
    };

    fetchConsumptionData();
  }, []);

  const baseChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        min: yAxisMin,
        title: {
          display: true,
          text: 'Consumption (kWh/Tonne)',
          font: {
            size: 12,
            weight: 'bold'
          },
          color: chartColors.text.light
        },
        grid: {
          color: chartColors.grid.light
        },
        ticks: {
          color: chartColors.text.light,
          padding: 8,
          font: {
            size: 11,
          },
        }
      },
      x: {
        grid: {
          color: chartColors.grid.light
        },
        title: {
          display: true,
          text: 'Date',
          font: {
            size: 12,
            weight: 'bold'
          },
          color: chartColors.text.light
        },
        ticks: {
          color: chartColors.text.light,
          padding: 8,
          font: {
            size: 11,
          },
          maxRotation: 0,
          minRotation: 0,
          callback: function(tickValue: string | number, index: number, ticks: Tick[]) {
            const label = ticks[index].label as string;
            if (label) {
              const parsedDate = parseISO(label);
              if (!isNaN(parsedDate.getTime())) {
                return format(parsedDate, 'dd MMM yy');
              }
            }
            return tickValue;
          }
        }
      }
    },
    plugins: {
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: theme === 'dark' ? 'rgba(19, 47, 76, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: chartColors.text.light,
        bodyColor: chartColors.text.light,
        borderColor: chartColors.grid.light,
        borderWidth: 1,
      },
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: chartColors.text.light,
          font: {
            size: 12
          }
        }
      }
    },
  };

  const total = departmentCostData.datasets[0].data.reduce(
    (acc: number, curr: number) => acc + curr,
    0
  );

  const options: ChartOptions<'pie'> = {
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
          color: chartColors.text.light,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: theme === 'dark' ? 'rgba(19, 47, 76, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: chartColors.text.light,
        bodyColor: chartColors.text.light,
        borderColor: chartColors.grid.light,
        borderWidth: 1,
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        callbacks: {
          label: (context: TooltipItem<'pie'>) => {
            const value = context.raw as number;
            const percentage = ((value / total) * 100).toFixed(1);
            return [
              `Amount: ₹${value.toLocaleString('en-IN')}`,
              `Percentage: ${percentage}%`
            ];
          }
        }
      }
    },
    animation: {
      duration: 2000,
      animateRotate: true,
      animateScale: true
    },
    elements: {
      arc: {
        borderWidth: 0,
        hoverBorderWidth: 3,
        hoverBorderColor: chartColors.background.light,
        hoverOffset: 15
      }
    },
    hover: {
      mode: 'nearest',
      intersect: true
    }
  };

  const msebChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: {
          color: chartColors.grid.light
        },
        title: {
          display: true,
          text: 'Date',
          color: chartColors.text.light
        },
        ticks: {
          color: chartColors.text.light
        }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        title: {
          display: true,
          text: 'Cost (₹)',
          color: chartColors.text.light
        },
        grid: {
          color: chartColors.grid.light
        },
        ticks: {
          color: chartColors.text.light,
          callback: function(tickValue: string | number) {
            return `${(tickValue as number / 1000).toFixed(0)}K`;
          }
        }
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: chartColors.text.light
        }
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(19, 47, 76, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: chartColors.text.light,
        bodyColor: chartColors.text.light,
        borderColor: chartColors.grid.light,
        borderWidth: 1,
        callbacks: {
          label: (context: TooltipItem<'bar'>) => {
            return `${context.dataset.label}: ₹${(context.raw as number).toLocaleString('en-IN', {
              maximumFractionDigits: 0
            })}`;
          }
        }
      }
    }
  };

  const prepareChartData = () => {
    if (!consumptionData) return null;

    const dayData = consumptionData.find((day: ConsumptionByDepartmentData) => day.Date === selectedDay);
    if (!dayData) return null;

    const departmentData = dayData.Departments[selectedDepartment];
    if (!departmentData) return null;

    const labels = Array.from({ length: 24 }, (_, i) => i.toString());
    const datasets: ChartDataset<'line'>[] = Object.entries(departmentData).map(([machineId, hourlyData]: [string, any]) => ({
      label: `${machineId} ${selectedMetric === 'P_F' ? 'Power Factor' : 'Consumption'}`,
      data: labels.map(hour => hourlyData[hour]?.[selectedMetric] || null),
      borderColor: machineId === 'IF1' ? '#2196F3' : 
                  machineId === 'IF2' ? '#FF5722' : 
                  machineId === 'MM1' ? '#4CAF50' : '#FFC107',
      backgroundColor: 'transparent',
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 8,
      borderWidth: 2,
    }));

    return {
      labels,
      datasets,
    };
  };

  const matchesSearch = (heading: string): boolean => {
    return heading.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const handleGenerate = async () => {
    if (!searchQuery) return;
    
    setIsGenerating(true);
    setShowGeneratedGraph(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/chat-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: searchQuery }),
      });
      
      if (!response.ok) {
        const notRelevantData: GeneratedResponse = {
          displayConfig: {
            displayType: 'cards',
            cards: [{
              title: 'Not Relevant Query',
              value: 'N/A',
              unit: '',
              description: 'The search query is not related to available data. Please try a different search term.',
              trend: 'neutral'
            }]
          }
        };
        setGeneratedData(notRelevantData);
        return;
      }

      const data = await response.json();
      console.log('Raw response:', data);
      
      if (!data || !data.displayConfig || !data.displayConfig.displayType) {
        const notRelevantData: GeneratedResponse = {
          displayConfig: {
            displayType: 'cards',
            cards: [{
              title: 'Not Relevant Query',
              value: 'N/A',
              unit: '',
              description: 'The search query is not related to available energy monitoring data. Please try a different search term.',
              trend: 'neutral'
            }]
          }
        };
        setGeneratedData(notRelevantData);
        return;
      }

      const formattedData: GeneratedResponse = {
        displayConfig: {
          displayType: data.displayConfig.displayType,
          ...(data.displayConfig.cards && { cards: data.displayConfig.cards }),
          ...(data.displayConfig.chartConfig && { chartConfig: data.displayConfig.chartConfig })
        }
      };

      console.log('Formatted data:', formattedData);
      setGeneratedData(formattedData);
    } catch (error) {
      console.error('Error generating response:', error);
      const notRelevantData: GeneratedResponse = {
        displayConfig: {
          displayType: 'cards',
          cards: [{
            title: 'Error Processing Query',
            value: 'Error',
            unit: '',
            description: 'An error occurred while processing your search query. Please try again.',
            trend: 'neutral'
          }]
        }
      };
      setGeneratedData(notRelevantData);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setUploadMessage({
        type: 'error',
        message: 'Please upload a CSV file'
      });
      return;
    }

    setIsUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload-energy-data`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Upload failed');
      }

      const message = result.newRecords > 0 
        ? `Successfully uploaded ${result.totalRecords} records (${result.newRecords} new records added)`
        : `Successfully processed ${result.totalRecords} records (no new records added)`;

      setUploadMessage({
        type: 'success',
        message: message
      });

      console.log('Upload Results:', {
        totalRecords: result.totalRecords,
        newRecords: result.newRecords,
        message: result.message
      });

      window.location.reload();
    } catch (error) {
      setUploadMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Upload failed'
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup charts when component unmounts
      const charts = Object.values(ChartJS.instances) as ChartJS[];
      charts.forEach(chart => {
        chart.destroy();
      });
    };
  }, []);

  useEffect(() => {
    console.log('Generated Data State:', generatedData);
  }, [generatedData]);

  // Add this type guard/validator for chartConfig
  function isValidChartConfig(chartConfig: any): chartConfig is ChartConfig {
    return (
      chartConfig &&
      typeof chartConfig === 'object' &&
      Array.isArray(chartConfig.labels) &&
      Array.isArray(chartConfig.datasets) &&
      typeof chartConfig.chartType === 'string'
    );
  }

  // Add this type guard for Card
  function isValidCard(card: any): card is Card {
    return (
      card &&
      typeof card === 'object' &&
      typeof card.title === 'string' &&
      typeof card.value !== 'undefined' &&
      typeof card.trend === 'string'
    );
  }

  // Compute valid cards for generatedData
  const rawCards = generatedData?.displayConfig?.cards ?? [];
  console.log('Raw cards from backend:', rawCards);
  const validCards = rawCards.filter(isValidCard);
  console.log('Valid cards after filtering:', validCards);

  // Defensive MetricCard
  const MetricCard = ({ title, value, unit, description, trend }: Partial<Card>) => {
    const getTrendIcon = () => {
      switch (trend) {
        case 'up':
          return <ArrowUpIcon className="h-4 w-4 text-success" />;
        case 'down':
          return <ArrowDownIcon className="h-4 w-4 text-danger" />;
        default:
          return <MinusIcon className="h-4 w-4 text-gray-400" />;
      }
    };

    return (
      <div className="bg-card text-text rounded-lg shadow-sm p-6 transition-colors duration-300">
        <h3 className="text-sm font-medium text-muted-foreground">
          {title ?? 'No Title'}
        </h3>
        <div className="mt-2 flex items-baseline">
          <span className="text-3xl font-semibold text-text">
            {value ?? 'N/A'}
          </span>
          {unit && (
            <span className="ml-1 text-sm text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    );
  };

  // Add this before the return statement for debugging
  console.log('Full generatedData object:', generatedData);

  return (
    <div className="min-h-screen bg-background text-text transition-colors duration-300">
      <div className="sticky top-0 z-10 bg-background border-b border-border transition-colors duration-300">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="text-muted-foreground hover:text-text transition-colors duration-300"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-xl font-semibold text-text truncate">
                {decodeURIComponent(categoryName ?? '')}
              </h1>
            </div>
            
            <div className="relative w-full mt-4 sm:mt-0 sm:w-auto">
              <div className="flex gap-2">
                <div className="relative">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="h-[42px] px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 
                             disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md flex items-center gap-2
                             border border-transparent focus:outline-none focus:ring-2 focus:ring-green-500
                             transition-colors duration-300"
                  >
                    <Upload className="h-4 w-4" />
                    {isUploading ? 'Uploading...' : 'Upload CSV'}
                  </button>
                </div>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search headings..."
                    className="w-full h-[42px] pl-10 pr-4 border border-border rounded-lg bg-input
                             text-text placeholder-muted-foreground
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-md
                             transition-colors duration-300"
                  />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={!searchQuery || isGenerating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                           disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md
                           transition-colors duration-300"
                >
                  {isGenerating ? 'Generating...' : 'Generate'}
                </button>
              </div>
              {uploadMessage && (
                <div className={`mt-2 p-2 rounded-md ${uploadMessage.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'} transition-colors duration-300`}>
                  {uploadMessage.message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-text">Category Details</h1>
          <button
            onClick={() => navigate('/energy-optimization')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors duration-300"
          >
            View Energy Optimization Dashboard
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {matchesSearch('Cost of Energy by Department') && (
            <div className="bg-card text-text rounded-lg shadow-sm p-4 w-full transition-colors duration-300">
              <h2 className="text-base font-medium mb-4 text-text">
                Cost of Energy by Department
              </h2>
              <div className="relative h-[300px] sm:h-[400px] lg:h-64">
                {isDepartmentCostLoading ? (
                  <LoadingSpinner />
                ) : (
                  <Pie data={departmentCostData} options={options} />
                )}
                <div 
                  className="absolute top-1/2 right-2 transform -translate-y-1/2"
                  style={{ pointerEvents: 'none' }}
                >
                  <div className="text-right">
                    <div className="text-lg font-semibold text-text">
                      Total
                    </div>
                    <div className="text-base text-muted-foreground">
                      ₹ {total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {matchesSearch('Average KWH/Tonne Trend') && (
            <div className="bg-card text-text rounded-lg shadow-sm p-4 transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-medium text-text">
                  Average KWH/Tonne Trend
                </h2>
                <div className="relative">
                  <select
                    value={selectedOption}
                    onChange={(e) => setSelectedOption(e.target.value)}
                    className="px-3 py-1 rounded bg-input text-text border border-border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300"
                  >
                    <option value="combined">Combined Average</option>
                    <option value="IF1">IF1 Average</option>
                    <option value="IF2">IF2 Average</option>
                  </select>
                </div>
              </div>
              <div className="h-[300px] sm:h-[400px] lg:h-64 overflow-x-auto scrollbar-hidden">
                {isAvgKWHLoading ? (
                  <LoadingSpinner />
                ) : (
                  <div style={{ minWidth: '464px', height: '232px' }}>
                    <Line data={avgKWHData} options={avgKWHChartOptions} />
                  </div>
                )}
              </div>
            </div>
          )}

          {matchesSearch('Average KWH/Part') && (
            <div className="bg-card text-text rounded-lg shadow-sm p-4 transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-medium text-text">
                  Average KWH/Part
                </h2>
                <select 
                  value={selectedMachine}
                  onChange={(e) => setSelectedMachine(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-border rounded-md bg-input text-text focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-300"
                >
                  <option value="">All Machines</option>
                  {kwhPartsData.length > 0 && Object.keys(kwhPartsData[0].machineData || {}).map((machineId: string) => (
                    <option key={machineId} value={machineId}>{machineId}</option>
                  ))}
                </select>
              </div>
              <div className="h-[300px] sm:h-[400px] lg:h-64 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {isKwhPartsLoading ? (
                  <LoadingSpinner />
                ) : (
                  <div style={{ minWidth: '464px', height: '100%' }}>
                    <Line data={kwhTrendData} options={kwhChartOptions} />
                  </div>
                )}
              </div>
            </div>
          )}

          {matchesSearch('Consumption and Molten Metal Trend') && (
            <div className="lg:col-span-2 bg-card text-text rounded-lg shadow-sm p-4 transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-medium text-text">
                  Consumption and Molten Metal Trend
                </h2>
              </div>
              <div className="h-[300px] sm:h-[400px] lg:h-64">
                {isCombinedDataLoading ? (
                  <LoadingSpinner />
                ) : (
                  <Chart 
                    type="line"
                    data={combinedData as any}
                    options={baseChartOptions} 
                  />
                )}
              </div>
            </div>
          )}

          {matchesSearch('Cost Distribution by Time Zone') && (
            <div className="lg:col-span-1 bg-card text-text rounded-lg shadow-sm p-4 transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-medium text-text">
                  Cost (₹) wrt MSEB Time Zone
                </h2>
              </div>
              <div className="h-[300px] sm:h-[400px] lg:h-64">
                {isMsebTimeZoneLoading ? (
                  <LoadingSpinner />
                ) : (
                  <Bar 
                    data={msebTimeZoneData} 
                    options={{
                      ...msebChartOptions,
                      scales: {
                        ...msebChartOptions.scales,
                        y: {
                          ...(msebChartOptions.scales?.y as ScaleOptionsByType<'linear'>),
                          ticks: {
                            ...(msebChartOptions.scales?.y as ScaleOptionsByType<'linear'>).ticks,
                            callback: function(context: any) {
                              return `${(context.raw as number / 1000).toFixed(0)}K`;
                            },
                          },
                        },
                        x: {
                          ...(msebChartOptions.scales?.x as ScaleOptionsByType<'category'>),
                          ticks: {
                            ...(msebChartOptions.scales?.x as ScaleOptionsByType<'category'>).ticks,
                            callback: function(tickValue: string | number, index: number, ticks: Tick[]) {
                              const label = ticks[index].label as string;
                              if (label) {
                                const parsedDate = parseISO(label);
                                if (!isNaN(parsedDate.getTime())) {
                                  return format(parsedDate, 'dd MMM yy');
                                }
                              }
                              return tickValue;
                            },
                            padding: 5,
                            font: {
                              size: 10,
                              family: 'Arial',
                              weight: 'normal',
                            },
                          },
                          title: {
                            display: true,
                            text: 'Date',
                            padding: {
                              top: 10,
                              bottom: 10
                            },
                            font: {
                              size: 12,
                              weight: 'bold',
                            }
                          }
                        }
                      }
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {matchesSearch('Daily Consumption Trend') && (
            <div className="col-span-full bg-card text-text rounded-lg shadow-sm p-4 transition-colors duration-300">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <h2 className="text-base font-medium text-text">
                  Daily Consumption Trend
                </h2>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
                  <input
                    type="date"
                    value={selectedDay}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      if (consumptionData?.some((day: ConsumptionByDepartmentData) => day.Date === newDate)) {
                        setSelectedDay(newDate);
                      }
                    }}
                    min={consumptionData?.[0]?.Date}
                    max={consumptionData?.[consumptionData.length - 1]?.Date}
                    className="px-3 py-1.5 text-sm border border-border rounded-md bg-input text-text focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-auto transition-colors duration-300"
                  />
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-border rounded-md bg-input text-text w-full sm:w-auto focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-300"
                  >
                    {consumptionData && Object.keys(consumptionData[0].Departments).map((dept: string) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  <select
                    value={selectedMetric}
                    onChange={(e) => setSelectedMetric(e.target.value as 'consumption' | 'P_F')}
                    className="px-3 py-1.5 text-sm border border-border rounded-md bg-input text-text w-full sm:w-auto focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-300"
                  >
                    <option value="consumption">Power Consumption</option>
                    <option value="P_F">Power Factor</option>
                  </select>
                </div>
              </div>
              <div className="h-[300px] sm:h-[400px] overflow-x-auto">
                {isConsumptionLoading ? (
                  <LoadingSpinner />
                ) : (
                  consumptionData && (
                    <Line 
                      data={prepareChartData() || { labels: [], datasets: [] }}
                      options={{
                        ...getChartOptions(),
                        maintainAspectRatio: false,
                        scales: {
                          ...getChartOptions().scales,
                          x: {
                            ...(getChartOptions().scales?.x as ScaleOptionsByType<'category'>),
                            ticks: {
                              ...(getChartOptions().scales?.x as ScaleOptionsByType<'category'>).ticks,
                              maxRotation: 45,
                              minRotation: 45,
                              font: {
                                size: 10,
                              },
                              callback: function(tickValue: string | number, index: number, ticks: Tick[]) {
                                const label = ticks[index].label as string;
                                if (label) {
                                  const parsedDate = parseISO(label);
                                  if (!isNaN(parsedDate.getTime())) {
                                    return format(parsedDate, 'dd MMM yy');
                                  }
                                }
                                return tickValue;
                              }
                            }
                          }
                        }
                      }}
                    />
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showGeneratedGraph && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-medium text-gray-900 dark:text-white">
              Generated Content
            </h2>
            <button
              onClick={() => {
                setShowGeneratedGraph(false);
                setSearchQuery('');
                setGeneratedData(null);
              }}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Back to All Graphs
            </button>
          </div>
          {isGenerating ? (
            <LoadingSpinner />
          ) : generatedData && generatedData.displayConfig ? (
            <>
              {generatedData.displayConfig.displayType === 'cards' && Array.isArray(generatedData.displayConfig.cards) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {generatedData.displayConfig.cards.map((card: Card, index: number) => (
                    <MetricCard 
                      key={index}
                      title={card.title}
                      value={card.value}
                      unit={card.unit}
                      description={card.description}
                      trend={card.trend}
                    />
                  ))}
                </div>
              ) : generatedData.displayConfig.displayType === 'chart' && generatedData.displayConfig.chartConfig ? (
                <div className="h-[500px] overflow-x-auto">
                  <Line
                    ref={chartRef}
                    data={{
                      labels: generatedData.displayConfig.chartConfig.labels || [],
                      datasets: generatedData.displayConfig.chartConfig.datasets || []
                    }}
                    options={{
                      ...baseChartOptions,
                      ...generatedData.displayConfig.chartConfig.options,
                      plugins: {
                        ...baseChartOptions.plugins,
                        title: {
                          display: true,
                          text: generatedData.displayConfig.chartConfig.title || '',
                          font: {
                            size: 16,
                            weight: 'bold'
                          }
                        }
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400">
                  Invalid display type: {generatedData.displayConfig.displayType}
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400">
              No data available. Try generating a response first.
            </div>
          )}
        </div>
      )}
    </div>
  );
}