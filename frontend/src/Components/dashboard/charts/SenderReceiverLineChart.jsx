import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import axios from '../../../API/axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const SenderReceiverLineChart = () => {
  const [senderWeights, setSenderWeights] = useState([]);
  const [receiverWeights, setReceiverWeights] = useState([]);
  const [labels, setLabels] = useState([]);

  useEffect(() => {
    axios.get('orders/archive/fcl/full').then(res => {
      if (res.data && res.data.status === 'success' && res.data.data && Array.isArray(res.data.data)) {
        // Use the last 5 batches
        const batches = res.data.data.slice(-5);
        setLabels(batches.map((_, i) => `Batch ${i + 1}`));
        setSenderWeights(batches.map(batch =>
          Array.isArray(batch.per_bin_weights)
            ? batch.per_bin_weights.reduce((sum, b) => sum + (parseFloat(b.total_weight) || 0), 0)
            : 0
        ));
        setReceiverWeights(batches.map(batch => Number(batch.receiver) || 0));
      }
    });
  }, []);

  const data = {
    labels: labels,
    datasets: [
      {
        label: 'Sender Weight (kg)',
        data: senderWeights,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Receiver Weight (kg)',
        data: receiverWeights,
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: 'Weight (kg)',
        },
      },
    },
  };

  return <Line data={data} options={options} />;
};

export default SenderReceiverLineChart;
