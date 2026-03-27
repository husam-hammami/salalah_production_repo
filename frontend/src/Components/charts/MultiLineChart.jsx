




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

const MultiLineChart = ({ data }) => {
  if (!data || !data.labels || !data.datasets) {
    return <div className="text-red-500">Chart data is not available</div>;
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
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
        display: true,
        text: 'Line Current and Voltage Trends',
        color: '#111827',
        font: { size: 18, weight: 'bold' },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#111827',
          font: { size: 12, weight: 'bold' },
        },
      },
      y: {
        grid: { display: false },
        ticks: {
          color: '#111827',
          font: { size: 12, weight: 'bold' },
        },
      },
    },
  };

  return <Line data={data} options={options} />;
};

export default MultiLineChart;

