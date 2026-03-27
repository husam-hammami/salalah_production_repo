





import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const GroupedBarChart = ({ data }) => {
  if (!data || !data.labels || !data.datasets) {
    return <div className="text-red-500 text-sm">No data available for GroupedBarChart</div>;
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
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
        text: 'Current and Voltage Comparison',
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

  return <Bar data={data} options={options} />;
};

export default GroupedBarChart;
