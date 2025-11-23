import { createTheme } from '@mui/material/styles';

// Paleta elegante: navy oscuro principal y teal secundario (sin verde chillón)
const theme = createTheme({
  palette: {
    primary: {
      main: '#073049', // navy oscuro para encabezados y acciones principales
      contrastText: '#ffffff'
    },
    secondary: {
      main: '#1f8a9a', // teal suave para tarjetas de ingresos y chips
      contrastText: '#ffffff'
    },
    info: {
      main: '#1976d2'
    },
    background: {
      default: '#f4f7f6', // ligero gris suave
      paper: '#ffffff'
    },
    text: {
      primary: '#0b2b3a',
      secondary: '#546e7a'
    },
    success: {
      main: '#2a9d8f',
      contrastText: '#ffffff'
    },
    error: {
      main: '#d32f2f'
    }
  },
  typography: {
    fontFamily: ['Inter', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 }
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 6px 18px rgba(11,35,50,0.06)'
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 12 }
      }
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          backgroundColor: '#0b63a7',
          color: '#fff',
          boxShadow: 'none',
          '&:hover': { backgroundColor: '#085589' }
        },
        outlined: { borderRadius: 10 }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          fontWeight: 700,
          padding: '6px 12px'
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid rgba(11,35,50,0.06)' }
      }
    }
  }
});

export default theme;