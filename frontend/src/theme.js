import { createTheme } from '@mui/material/styles';

// Define nuestra paleta de colores inspirada en tu nuevo logo
const theme = createTheme({
  palette: {
    primary: {
      main: '#005691', // Azul oscuro principal del logo
      light: '#007bb2', // Azul más claro del autobús
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#f9a825', // Un naranja/amarillo para botones de acción (complementa el azul)
      contrastText: '#000000',
    },
    background: {
      default: '#f4f7f6', // Este color ahora lo usa el "velo" en index.css
      paper: '#ffffff',  // El fondo de las tarjetas y paneles
    },
    text: {
      primary: '#212121',
      secondary: '#5f6368',
    }
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 600,
      color: '#005691', // Títulos en el color primario
    },
    h6: {
      fontWeight: 600,
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: 'none',
          padding: '10px 20px',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }
        },
      },
    },
    
    // --- ¡AQUÍ ESTÁ LA MAGIA (PASO 2)! ---
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          // Hacemos el fondo de las tarjetas un poco transparente
          // para que absorban el color del fondo de la página
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(10px)', // Efecto de desenfoque "vidrio esmerilado"
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          // Hacemos la barra de navegación también semitransparente
          backgroundColor: 'rgba(255, 255, 255, 0.7)', 
          backdropFilter: 'blur(10px)',
          color: '#212121',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: 'none',
          border: '1px solid #e0e0e0',
          // Las tarjetas *dentro* de un Paper sí las dejamos sólidas
          backgroundColor: '#ffffff' 
        }
      }
    }
    // --- FIN DE LA MAGIA ---
  },
});

export default theme;