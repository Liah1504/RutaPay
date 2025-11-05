import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Paper, Typography, Box } from '@mui/material';

const EarningsChart = ({ data = [], title = 'Ganancias', mountDelay = 150 }) => {
  const formatted = data.map(d => ({ ...d, display: d.date || d.route_name || d.label || '', earnings: Number(d.earnings || d.total || d.value || 0) }));
  const safeData = formatted.length > 0 ? formatted : [{ display: '', earnings: 0 }];

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), mountDelay);
    return () => clearTimeout(t);
  }, [safeData.length, mountDelay]);

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>{title}</Typography>
      <Box sx={{ width: '100%', minHeight: 320, height: 320 }}>
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={safeData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1976d2" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#1976d2" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="display" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)} Bs`} />
              <Area type="monotone" dataKey="earnings" stroke="#1976d2" fillOpacity={1} fill="url(#colorEarnings)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
      </Box>
    </Paper>
  );
};

export default EarningsChart;