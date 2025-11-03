import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ThemeProvider, CssBaseline } from '@mui/material'
import theme from './theme' // Importamos nuestro nuevo tema
import './index.css' // Importamos los estilos globales

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Envolvemos toda la aplicación con el proveedor de tema */}
    <ThemeProvider theme={theme}>
      {/* CssBaseline normaliza los estilos y aplica el color de fondo */}
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)