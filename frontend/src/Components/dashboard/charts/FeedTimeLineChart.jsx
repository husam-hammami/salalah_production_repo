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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const FeedTimeLineChart = () => {
  const data = {
    labels: ['Batch 1', 'Batch 2', 'Batch 3', 'Batch 4', 'Batch 5'],
    datasets: [
      {
        label: 'Actual Feed Time (min)',
        data: [18, 22, 21, 20, 19],
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Target Feed Time (min)',
        data: [20, 20, 20, 20, 20],
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        borderDash: [5, 5],
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Minutes',
        },
      },
    },
  };

  return <Line data={data} options={options} />;
};

export default FeedTimeLineChart;
