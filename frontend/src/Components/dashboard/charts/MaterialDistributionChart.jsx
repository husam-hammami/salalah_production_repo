import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import PropTypes from 'prop-types';
import { Card } from '../../../components/ui/card';

Chart.register(...registerables);

export function MaterialDistributionChart({ inCount, outCount }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['IN', 'OUT'],
        datasets: [
          {
            data: [inCount, outCount],
            backgroundColor: ['#60A5FA', '#BFDBFE'],
            borderRadius: 6,
            barThickness: 80,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 3.0,
            ticks: {
              stepSize: 0.5,
              padding: 10,
              font: { size: 12 },
            },
            grid: {
              color: '#f3f4f6',
              drawBorder: false,
            },
          },
          x: {
            grid: { display: false },
            ticks: {
              padding: 10,
              font: { size: 12 },
            },
          },
        },
        layout: {
          padding: { top: 10, bottom: 10, left: 10, right: 10 },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [inCount, outCount]);

  return (
    <Card className="h-[300px] p-6 bg-white dark:bg-[#121e2c] border border-white/10 dark:border-cyan-900">
      <h2 className="text-lg font-semibold mb-4 text-black dark:text-white">
        Material Distribution
      </h2>
      <div className="h-[200px]">
        <canvas ref={canvasRef}></canvas>
      </div>
    </Card>
  );
}

MaterialDistributionChart.propTypes = {
  inCount: PropTypes.number.isRequired,
  outCount: PropTypes.number.isRequired,
};
