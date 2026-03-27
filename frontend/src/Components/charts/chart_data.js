const chartData = {
  multiLine: {
    labels: ['T1', 'T2', 'T3', 'T4', 'T5'],
    datasets: [
      { label: 'L1 Current', data: [10, 12, 11, 12, 13], borderColor: 'rgba(255, 99, 132, 1)', backgroundColor: 'rgba(255, 99, 132, 0.2)' },
      { label: 'L1 Voltage', data: [229, 230, 231, 228, 230], borderColor: 'rgba(54, 162, 235, 1)', backgroundColor: 'rgba(54, 162, 235, 0.2)' },
      { label: 'L2 Current', data: [13, 15, 14, 14, 15], borderColor: 'rgba(75, 192, 192, 1)', backgroundColor: 'rgba(75, 192, 192, 0.2)' },
      { label: 'L2 Voltage', data: [227, 228, 229, 226, 228], borderColor: 'rgba(153, 102, 255, 1)', backgroundColor: 'rgba(153, 102, 255, 0.2)' },
      { label: 'L3 Current', data: [10, 11, 11, 12, 11], borderColor: 'rgba(255, 206, 86, 1)', backgroundColor: 'rgba(255, 206, 86, 0.2)' },
      { label: 'L3 Voltage', data: [231, 232, 233, 230, 232], borderColor: 'rgba(255, 159, 64, 1)', backgroundColor: 'rgba(255, 159, 64, 0.2)' },
    ],
  },
  groupedBar: {
    labels: ['L1', 'L2', 'L3'],
    datasets: [
      { label: 'Current (A)', data: [12, 15, 11], backgroundColor: 'rgba(255, 99, 132, 0.5)' },
      { label: 'Voltage (V)', data: [230, 228, 232], backgroundColor: 'rgba(54, 162, 235, 0.5)' },
    ],
  },
  radar: {
    labels: ['L1 Current', 'L2 Current', 'L3 Current', 'L1 Voltage', 'L2 Voltage', 'L3 Voltage'],
    datasets: [
      {
        label: 'Phase Metrics',
        data: [12, 15, 11, 230, 228, 232],
        backgroundColor: 'rgba(255, 206, 86, 0.2)',
        borderColor: 'rgba(255, 206, 86, 1)',
      },
    ],
  },
  gauge: {
    L1: 60, // 12/20 A threshold
    L2: 75,
    L3: 55,
  },
  stackedArea: {
    labels: ['T1', 'T2', 'T3', 'T4', 'T5'],
    datasets: [
      { label: 'L1', data: [10, 12, 11, 12, 13], backgroundColor: 'rgba(255, 99, 132, 0.5)', fill: true },
      { label: 'L2', data: [13, 15, 14, 14, 15], backgroundColor: 'rgba(54, 162, 235, 0.5)', fill: true },
      { label: 'L3', data: [10, 11, 11, 12, 11], backgroundColor: 'rgba(255, 206, 86, 0.5)', fill: true },
    ],
  },
};

export default chartData;
