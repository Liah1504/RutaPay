import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Card, CardContent, Typography } from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * EarningsChart
 * Props:
 *  - data: array de objetos { route_name, total } donde total puede ser string o number
 *
 * Ejemplo:
 *  <EarningsChart data={[{ route_name: 'Propatria - Chacaíto', total: 40 }, ...]} />
 */
const EarningsChart = ({ data = [] }) => {
  const labels = data.map(d => d.route_name);
  const values = data.map(d => parseFloat(d.total) || 0);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Ganancias (Bs)',
        data: values,
        backgroundColor: 'rgba(3,169,244,0.85)',
        borderRadius: 6,
        barThickness: 'flex'
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Ganancias por Ruta (día seleccionado)' },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.y?.toFixed(2) || 0} Bs`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `${value} Bs`
        }
      }
    }
  };

  return (
    <Card sx={{ height: 340 }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" gutterBottom>Gráfico de Ganancias</Typography>
        <div style={{ flex: 1 }}>
          <Bar data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  );
};

export default EarningsChart;