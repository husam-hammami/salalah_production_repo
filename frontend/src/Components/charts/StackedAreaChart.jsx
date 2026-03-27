;








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

const StackedAreaChart = ({ data }) => {
  if (!data || !data.labels || !data.datasets) {
    return <div className="text-red-500 text-sm">No data available for StackedAreaChart</div>;
  }

  const options = {
    responsive: true,
    elements: {
      line: {
        tension: 0.4,
        borderWidth: 2,
      },
      point: { radius: 0 },
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
        text: 'Stacked Area of Current/Voltage',
        color: '#111827',
        font: { size: 18, weight: 'bold' },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          color: '#111827',
          font: { size: 12, weight: 'bold' },
        },
      },
      y: {
        stacked: true,
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

export default StackedAreaChart;
