import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import PropTypes from 'prop-types';

Chart.register(...registerables);

export function SetpointChart({ data }) {
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
        labels: data.map(d => d.parameter),
        datasets: [
          {
            label: 'Setpoint',
            data: data.map(d => d.setpoint),
            backgroundColor: ['#60A5FA'],
            borderRadius: 4,
            barThickness: 20,
          },
          {
            label: 'Actual',
            data: data.map(d => d.actual),
            backgroundColor: ['#BFDBFE'],
            borderRadius: 4,
            barThickness: 20,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              padding: 20,
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              boxHeight: 8,
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 90,
            ticks: {
              stepSize: 10,
              padding: 10,
            },
            grid: {
              color: '#f3f4f6',
              drawBorder: false,
            }
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              padding: 10,
            }
          }
        },
        layout: {
          padding: {
            top: 20,
            bottom: 10
          }
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data]);

  return (
    <div className="h-[250px]">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}

SetpointChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      parameter: PropTypes.string.isRequired,
      setpoint: PropTypes.number.isRequired,
      actual: PropTypes.number.isRequired,
    })
  ).isRequired,
};
