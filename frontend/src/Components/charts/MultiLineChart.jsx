




import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const MultiLineChart = ({ data, title, dualAxis }) => {
  if (!data || !data.labels || !data.datasets) {
    return <div className="text-red-500">Chart data is not available</div>;
  }

  const hasDualAxis = dualAxis || data.datasets.some(ds => ds.yAxisID === 'y1');

  const scales = {
    x: {
      grid: { display: false },
      ticks: {
        color: '#111827',
        font: { size: 12, weight: 'bold' },
      },
    },
    y: {
      position: 'left',
      grid: { display: false },
      ticks: {
        color: '#111827',
        font: { size: 12, weight: 'bold' },
      },
    },
  };

  if (hasDualAxis) {
    scales.y1 = {
      position: 'right',
      grid: { drawOnChartArea: false },
      ticks: {
        color: '#F59E0B',
        font: { size: 12, weight: 'bold' },
      },
    };
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    elements: {
      line: {
        tension: 0.4,
        borderWidth: 2,
      },
      point: {
        radius: 3,
        backgroundColor: '#fff',
        borderWidth: 2,
      },
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#111827',
          font: { weight: 'bold' },
        },
      },
      title: {
        display: !!title,
        text: title || '',
        color: '#111827',
        font: { size: 16, weight: 'bold' },
      },
    },
    scales,
  };

  return <Line data={data} options={options} />;
};

export default MultiLineChart;

