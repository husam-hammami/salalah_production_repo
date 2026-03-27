








// File: ../components/dashboard/charts/FclSdlaCharts.jsx
import React from 'react';
import { Line } from 'react-chartjs-2';
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

const generateTimeLabels = () => {
  const labels = [];
  for (let h = 11; h <= 15; h++) {
    labels.push(`${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`);
  }
  return labels;
};

const timeLabels = generateTimeLabels();

const commonDataset = (label, data, color) => ({
  label,
  data,
  fill: false,
  borderColor: color,
  tension: 0.1,
});

const fclData = {
  labels: timeLabels,
  datasets: [
    commonDataset('Line 1 (Black)', Array(5).fill(97), 'black'),
    commonDataset('Line 2 (Blue)', Array(5).fill(75), 'blue'),
    commonDataset('Line 3 (Orange)', Array(5).fill(6), 'orange'),
    commonDataset('Line 4 (Green)', Array(5).fill(4), 'green'),
    commonDataset('Line 5 (Magenta)', Array(5).fill(1), 'magenta'),
  ],
};

const sdlaData = {
  labels: timeLabels,
  datasets: [
    commonDataset('Line 1 (Black)', Array(5).fill(40), 'black'),
    commonDataset('Line 2 (Blue)', Array(5).fill(80), 'blue'),
    commonDataset('Line 3 (Orange)', Array(5).fill(67), 'orange'),
    commonDataset('Line 4 (Green)', Array(5).fill(48), 'green'),
    commonDataset('Line 5 (Magenta)', Array(5).fill(39), 'magenta'),
  ],
};

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' },
    tooltip: { mode: 'index', intersect: false },
  },
  scales: {
    y: { min: 0, max: 110, title: { display: true, text: 'Yield (%)' } },
    x: { title: { display: true, text: 'Time' } },
  },
};

const FclSdlaCharts = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="w-[500px] h-[250px]">
      <h2 className="text-center font-semibold mb-1 text-black dark:text-white">FCL Chart</h2>
      <div className="w-full h-full">
        <Line data={fclData} options={options} />
      </div>
    </div>
    <div className="w-[500px] h-[250px]">
      <h2 className="text-center font-semibold mb-1 text-black dark:text-white">SDLA Chart</h2>
      <div className="w-full h-full">
        <Line data={sdlaData} options={options} />
      </div>
    </div>
  </div>
);

export default FclSdlaCharts;
