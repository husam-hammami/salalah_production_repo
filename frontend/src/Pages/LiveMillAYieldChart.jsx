import React, { useEffect, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

export default function LiveMillAYieldChart({ liveData }) {
  const cacheRef = useRef([]);
  const chartContainerRef = useRef(null);
  const intervalRef = useRef(null);

  const [chartBuffer, setChartBuffer] = useState([]);

  const MAX_RECORDS = 500;
  const TRIM_SIZE = 100;

  const productKeys = [
    { key: 'R1_MILA_YIELD', label: 'R1 Yield', color: '#8884d8' },
    { key: 'R2_MILA_YIELD', label: 'R2 Yield', color: '#82ca9d' },
    { key: 'R3_MILA_YIELD', label: 'R3 Yield', color: '#ffc658' },
    { key: 'R4_MILA_YIELD', label: 'R4 Yield', color: '#ff7300' },
    { key: 'R5_MILA_YIELD', label: 'R5 Yield', color: '#0088FE' }
  ];

  useEffect(() => {
    if (!liveData || !liveData.DB2099) return;

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const now = new Date();
      cacheRef.current.push({
        dateTime: now,
        data: { ...liveData.DB2099 }
      });

      if (cacheRef.current.length > MAX_RECORDS) {
        cacheRef.current.splice(0, TRIM_SIZE);
      }

      setChartBuffer([...cacheRef.current]);
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [liveData]);

  const labels = chartBuffer.map(entry =>
    entry.dateTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  );

  const datasets = productKeys.map((p) => ({
    label: p.label,
    data: chartBuffer.map((entry) => entry.data[p.key] ?? null),
    fill: false,
    borderColor: p.color,
    tension: 0.2,
    borderWidth: 2,
    pointRadius: 0,
  }));

  const options = {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true }
    },
    scales: {
      x: {
        ticks: {
          autoSkip: false,
          maxRotation: 0,
          minRotation: 0
        }
      },
      y: {
        beginAtZero: true
      }
    }
  };

  return (
    <div
      style={{
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        paddingBottom: '8px',
        borderBottom: '1px solid #eee'
      }}
      ref={chartContainerRef}
    >
      <div
        style={{
          width: `${Math.max(chartBuffer.length * 60, 1000)}px`,
          minWidth: '1000px'
        }}
      >
        <Line data={{ labels, datasets }} options={options} />
      </div>
    </div>
  );
}
