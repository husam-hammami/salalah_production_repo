













import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';

ChartJS.register(ArcElement, Tooltip);

const GaugeChart = ({ value, label, color = 'green' }) => {
  const percentage = Math.min(Math.max(value, 0), 100);

  const getGradient = (ctx, color) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 140);
    if (color === 'red') {
      // Teal for L1
      gradient.addColorStop(0, '#6DDDD6');
      gradient.addColorStop(0.5, '#4DD0C9');
      gradient.addColorStop(1, '#3DB8B0');
    } else if (color === 'blue') {
      // Coral/Salmon Pink for L2
      gradient.addColorStop(0, '#F5A0A0');
      gradient.addColorStop(0.5, '#F08080');
      gradient.addColorStop(1, '#E06060');
    } else {
      // Orange/Amber for L3
      gradient.addColorStop(0, '#FFB833');
      gradient.addColorStop(0.5, '#FFA500');
      gradient.addColorStop(1, '#E69400');
    }
    return gradient;
  };

  const data = {
    labels: [label, 'Remaining'],
    datasets: [
      {
        data: [percentage, 100 - percentage],
        backgroundColor: (context) => {
          const { ctx } = context.chart;
          return [getGradient(ctx, color), '#f1f5f9'];
        },
        borderWidth: 0,
        cutout: '65%',
        circumference: 180,
        needleValue: percentage,
      },
    ],
  };

  const options = {
    rotation: -90,
    circumference: 180,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: { enabled: false },
      legend: { display: false },
    },
  };

  const needlePlugin = {
    id: 'needle',
    afterDatasetDraw(chart) {
      const { ctx, data } = chart;
      const needleValue = data.datasets[0].needleValue;
      const angle = Math.PI + (needleValue / 100) * Math.PI;
      const cx = chart.getDatasetMeta(0).data[0].x;
      const cy = chart.getDatasetMeta(0).data[0].y;
      const r = chart.getDatasetMeta(0).data[0].outerRadius;

      // Draw needle with glow and depth
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(r - 10, 0);
      ctx.lineTo(0, 3);
      ctx.closePath();
      ctx.fillStyle = '#1e293b';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();

      // Center knob - muted industrial style
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 6);
      grad.addColorStop(0, '#64748b');
      grad.addColorStop(1, '#334155');
      ctx.fillStyle = grad;
      ctx.fill();
    },
  };

  return (
    // <div className="w-[160px] h-[170px] bg-white shadow-lg rounded-lg p-2 flex flex-col items-center justify-between">
    // <div className="w-[140px] h-[160px] bg-white shadow rounded p-2 flex flex-col items-center justify-between">
    // <div className="w-[120px] h-[140px] bg-white shadow rounded p-2 flex flex-col items-center justify-between">
    // <div className="w-[120px] h-[140px] bg-white shadow rounded p-2 flex flex-col items-center justify-between overflow-hidden">



    //   <span className="text-sm font-semibold text-gray-700">{label}</span>
    //   <div className="w-full h-[100px]">
    //     <Doughnut data={data} options={options} plugins={[needlePlugin]} />
    //   </div>
    //   <p className="text-md font-bold text-gray-900">{Math.round(percentage)}%</p>
    // </div>
  //     <div className="w-[110px] h-[130px] bg-[#f5f5f5] shadow rounded p-2 flex flex-col items-center justify-between overflow-hidden">
  //   <span className="text-xs font-semibold text-gray-700 text-center">{label}</span>
  //   <div className="w-full h-[80px]">
  //     <Doughnut data={data} options={options} plugins={[needlePlugin]} />
  //   </div>
  //   <p className="text-xs font-bold text-gray-800">{Math.round(percentage)}%</p>
  // </div>
  <div className="w-[110px] h-[130px] bg-white dark:bg-[#1a2332] shadow-sm border border-gray-300 dark:border-gray-600 rounded-lg p-1 m-0 flex flex-col items-center justify-between overflow-hidden transition-all duration-300 ease-in-out hover:shadow-md">
    <span className="text-xs font-semibold text-gray-700 text-center">{label}</span>
    <div className="w-full h-[80px]">
      <Doughnut data={data} options={options} plugins={[needlePlugin]} />
    </div>
    <p className="text-xs font-bold text-gray-800">{Math.round(percentage)}%</p>
  </div>
  );
};

export default GaugeChart;
