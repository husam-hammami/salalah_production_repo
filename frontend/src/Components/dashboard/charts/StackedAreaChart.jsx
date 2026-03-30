import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Card } from '@/Components/ui/card';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

export default function StackedAreaChart({ data }) {
  const chartData = {
    labels: data.map(d => d.date),
    datasets: [
      {
        label: 'Material A',
        data: data.map(d => d.a),
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.4)',
        borderColor: '#3b82f6',
        tension: 0.4,
      },
      {
        label: 'Material B',
        data: data.map(d => d.b),
        fill: true,
        backgroundColor: 'rgba(16, 185, 129, 0.4)',
        borderColor: '#10b981',
        tension: 0.4,
      },
      {
        label: 'Material C',
        data: data.map(d => d.c),
        fill: true,
        backgroundColor: 'rgba(251, 191, 36, 0.4)',
        borderColor: '#fbbf24',
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#999',
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#666',
        },
        grid: {
          color: '#f3f4f6',
        },
      },
      y: {
        stacked: true,
        ticks: {
          color: '#666',
        },
        grid: {
          color: '#f3f4f6',
        },
      },
    },
  };

  return (
    <Card className="h-[300px] p-6 bg-white dark:bg-[#121e2c] border border-black dark:border-cyan-900">
      <h2 className="text-lg font-semibold mb-4 text-black dark:text-white">Material Usage Stacked Area</h2>
      <div className="h-[200px]">
        <Line data={chartData} options={options} />
      </div>
    </Card>
  );
}
