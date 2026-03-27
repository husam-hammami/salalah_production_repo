import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import axios from '../../../API/axios';
import io from 'socket.io-client';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Legend,
  Tooltip,
} from 'chart.js';

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Legend,
  Tooltip
);

const productKeys = [
  'MILA_B1 (%)',
  'MILA_BranCoarse (%)',
  'MILA_BranFine (%)',
  'MILA_Flour1 (%)',
  'MILA_Semolina (%)',
];
const productLabels = [
  'MILA_B1',
  'MILA_BranCoarse',
  'MILA_BranFine',
  'MILA_Flour1',
  'MILA_Semolina',
];
const colorMap = [
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#84cc16', // lime
  '#8b5cf6', // violet
  '#f43f5e', // rose
];

const MillAYieldChart = () => {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:5000/orders/mila/archive/latest-10').then(res => {
      if (res.data && res.data.status === 'success' && Array.isArray(res.data.data)) {
        // Get last 10 records
        const records = res.data.data.slice(-10);
        // Prepare x-axis (date/time)
        const timeLabels = records.map(r => {
          const d = new Date(r.created_at);
          return d.toLocaleString();
        });
        // Prepare datasets: one for each product
        const datasets = productKeys.map((key, idx) => ({
          label: productLabels[idx],
          data: records.map(r => (r.yield_log && r.yield_log[key] != null ? r.yield_log[key] : null)),
          fill: false,
          borderColor: colorMap[idx],
          backgroundColor: colorMap[idx],
          tension: 0.1,
          pointBackgroundColor: colorMap[idx],
          pointBorderColor: colorMap[idx],
          borderWidth: 2,
        }));
        setChartData({
          labels: timeLabels,
          datasets,
        });
      }
    });
  }, []);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      y: {
        min: 0,
        max: 110,
        title: {
          display: true,
          text: 'Yield (%)',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Date/Time',
        },
      },
    },
  };

  return (
    <div className="w-full h-[300px]">
      <h2 className="text-center font-semibold mb-2 text-black dark:text-white">Mill A Yield Chart</h2>
      {chartData ? <Line data={chartData} options={options} /> : <div>Loading...</div>}
    </div>
  );
};

export default MillAYieldChart;
