// MaterialUsageLineChart.jsx
import { Line } from 'react-chartjs-2';
import { Card } from '@/components/ui/card';

export default function MaterialUsageLineChart({ data }) {
  const chartData = {
    labels: data.map(item => item.date),
    datasets: [
      {
        label: 'Material Usage (kg)',
        data: data.map(item => item.value),
        fill: false,
        borderColor: '#4B92FF',
        backgroundColor: '#4B92FF',
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#4B92FF',
      },
    ],
  };

  const options = {
    plugins: {
      legend: {
        display: true,
        labels: {
          color: '#666',
        },
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: {
          color: '#888',
        },
        grid: {
          color: 'rgba(200, 200, 200, 0.1)',
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#888',
        },
        grid: {
          color: 'rgba(200, 200, 200, 0.1)',
        },
      },
    },
  };

  return (
    <Card className="h-[300px] p-6 bg-white dark:bg-[#121e2c] border border-black dark:border-cyan-900">
      <h2 className="text-lg font-semibold mb-4 text-black dark:text-white">Material Usage Over Time</h2>
      <div className="h-[200px]">
        <Line data={chartData} options={options} />
      </div>
    </Card>
  );
}
