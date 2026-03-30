import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Chart, registerables } from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../../Components/ui/card';

Chart.register(...registerables);

export function FCLMetricsChart({ data }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const chartData = [
      { label: 'Flow Rate', value: data.flow_rate, target: 23.5 },
      { label: 'Moisture SP', value: data.moisture_setpoint, target: 15.5 },
      { label: 'Moisture Offset', value: Math.abs(data.moisture_offset), target: 5 }
    ];

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartData.map(d => d.label),
        datasets: [
          {
            label: 'Actual',
            data: chartData.map(d => d.value),
            backgroundColor: '#60A5FA',
            borderRadius: 4,
            barThickness: 25,
          },
          {
            label: 'Target',
            data: chartData.map(d => d.target),
            backgroundColor: '#BFDBFE',
            borderRadius: 4,
            barThickness: 25,
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
              padding: 15,
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              boxHeight: 8,
              font: {
                size: 12
              }
            }
          }
        },
        scales: {
          y: { 
            beginAtZero: true,
            max: 25,
            grid: { 
              color: '#f3f4f6',
              drawBorder: false,
            },
            ticks: {
              padding: 10,
              font: {
                size: 12
              }
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              padding: 10,
              font: {
                size: 12
              }
            }
          }
        },
        layout: {
          padding: {
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
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
    <Card>
      <CardHeader>
        <CardTitle>FCL Performance Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <canvas ref={canvasRef}></canvas>
        </div>
      </CardContent>
    </Card>
  );
}

FCLMetricsChart.propTypes = {
  data: PropTypes.shape({
    flow_rate: PropTypes.number.isRequired,
    moisture_setpoint: PropTypes.number.isRequired,
    moisture_offset: PropTypes.number.isRequired,
  }).isRequired,
}; 