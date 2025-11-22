import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import Header from '../components/Header';
import DriverDailyBalances from '../components/DriverDailyBalances';

const Reports = () => {
  return (
    <div>
      <Header />
      <Container maxWidth="xl" sx={{ pt: 4, pb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          📊 Reportes
        </Typography>

        <Box sx={{ mt: 2 }}>
          {/* Reusa el componente que ya tienes para balances por conductor */}
          <DriverDailyBalances />
        </Box>
      </Container>
    </div>
  );
};

export default Reports;