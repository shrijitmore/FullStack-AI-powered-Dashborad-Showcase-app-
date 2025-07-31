import { useEffect, useRef } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line, Bar, Pie, Scatter } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

interface ChartConfig {
    chartType: 'line' | 'bar' | 'pie' | 'scatter';
    title: string;
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor?: string | string[];
        borderColor?: string;
        borderWidth?: number;
        fill?: boolean;
    }[];
    options?: any;
}

interface DynamicChartProps {
    config: ChartConfig;
    className?: string;
}

export function DynamicChart({ config, className = '' }: DynamicChartProps) {
    const chartRef = useRef<ChartJS>(null);

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
        };
    }, []);

    // Default options for all chart types
    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: config.title,
                font: {
                    size: 16,
                    weight: 'bold'
                }
            },
        },
    };

    // Merge default options with provided options
    const chartOptions = {
        ...defaultOptions,
        ...config.options
    };

    // Prepare the chart data
    const chartData = {
        labels: config.labels,
        datasets: config.datasets.map(dataset => ({
            ...dataset,
            borderWidth: dataset.borderWidth || 2,
            tension: 0.4
        }))
    };

    // Render the appropriate chart type
    const renderChart = () => {
        switch (config.chartType) {
            case 'line':
                return <Line ref={chartRef} data={chartData} options={chartOptions} />;
            case 'bar':
                return <Bar ref={chartRef} data={chartData} options={chartOptions} />;
            case 'pie':
                return <Pie ref={chartRef} data={chartData} options={chartOptions} />;
            case 'scatter':
                return <Scatter ref={chartRef} data={chartData} options={chartOptions} />;
            default:
                return <div>Unsupported chart type</div>;
        }
    };

    return (
        <div className={`w-full h-[400px] bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 ${className}`}>
            {renderChart()}
        </div>
    );
}
