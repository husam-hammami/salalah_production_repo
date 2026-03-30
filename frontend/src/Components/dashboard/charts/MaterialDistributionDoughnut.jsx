// MaterialDistributionDoughnut.jsx
import { Doughnut } from 'react-chartjs-2';
import { Card } from '../../../Components/ui/card';

export default function MaterialDistributionDoughnut({ data }) {
  const chartData = {
    labels: data.map(item => item.label),
    datasets: [
      {
        label: 'Material Distribution',
        data: data.map(item => item.value),
        backgroundColor: ['#4B92FF', '#3576D8', '#0B1F3A'],
        borderColor: ['#ffffff'],
        borderWidth: 2,
        cutout: '60%',
      },
    ],
  };

  const options = {
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#999',
        },
      },
    },
    responsive: true,
    maintainAspectRatio: false,
  };

  return (
    <Card className="h-[300px] p-6 bg-white dark:bg-[#121e2c] border border-black dark:border-cyan-900">
      <h2 className="text-lg font-semibold mb-4 text-black dark:text-white">Material Distribution</h2>
      <div className="h-[200px]">
        <Doughnut data={chartData} options={options} />
      </div>
    </Card>
  );
}
