// components/dashboard/charts/BatchComparisonBarChart.jsx
import { Bar } from 'react-chartjs-2';
import { Card } from '@/Components/ui/card';

export default function BatchComparisonBarChart({ data }) {
  const chartData = {
    labels: ['Flowrate', 'Moisture Setpoint', 'Moisture Offset', 'Produced', 'Consumed'],
    datasets: [
      {
        label: 'FCL',
        data: data.FCL,
        backgroundColor: '#4B92FF',
      },
      {
        label: 'SDLA',
        data: data.SDLA,
        backgroundColor: '#00BFA6',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#999',
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#666',
        },
        grid: {
          color: '#eee',
        },
      },
      x: {
        ticks: {
          color: '#666',
        },
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <Card className="h-[300px] p-6 bg-white dark:bg-[#121e2c] border border-black dark:border-cyan-900">
      <h2 className="text-lg font-semibold mb-4 text-black dark:text-white">FCL vs SDLA Metrics</h2>
      <div className="h-[200px]">
        <Bar data={chartData} options={options} />
      </div>
    </Card>
  );
}
