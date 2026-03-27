import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const FlowrateBarChart = () => {
  const data = {
    labels: ['Line 1', 'Line 2', 'Line 3', 'Line 4'],
    datasets: [
      {
        label: 'Flowrate (kg/h)',
        data: [22000, 24000, 21000, 23000],
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: {
        display: false,
        text: 'Flowrate per Line',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 5000,
        },
      },
    },
  };

  return (
    <div className="w-full">
      <Bar data={data} options={options} />
    </div>
  );
};

export default FlowrateBarChart;
