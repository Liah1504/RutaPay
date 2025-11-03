import React, { useEffect, useRef } from 'react';
import { Paper, Typography, Box, Grid } from '@mui/material';

const MapComponent = ({ 
  startPoint = "Propatria", 
  endPoint = "Chacaíto", 
  height = 400,
  showRoute = true 
}) => {
  const mapRef = useRef(null);

  useEffect(() => {
    console.log('Mapa inicializado para ruta:', startPoint, '→', endPoint);
    return () => {
      console.log('Limpiando mapa');
    };
  }, [startPoint, endPoint, showRoute]);

  // Coordenadas aproximadas de la ruta Propatria-Chacaíto
  const routeCoordinates = [
    { lat: 10.5000, lng: -66.9167, name: "Propatria" },
    { lat: 10.5050, lng: -66.9100, name: "Agua Salud" },
    { lat: 10.5058, lng: -66.9014, name: "Capitolio" },
    { lat: 10.5061, lng: -66.8939, name: "El Silencio" },
    { lat: 10.5019, lng: -66.8886, name: "La Hoyada" },
    { lat: 10.5008, lng: -66.8808, name: "Parque Carabobo" },
    { lat: 10.4986, lng: -66.8736, name: "Bellas Artes" },
    { lat: 10.4964, lng: -66.8639, name: "Colegio de Ingenieros" },
    { lat: 10.4950, lng: -66.8533, name: "Chacaíto" }
  ];

  return (
    <Paper elevation={3} sx={{ p: 2, height: 'auto', minHeight: height }}>
      <Typography variant="h6" gutterBottom sx={{ fontSize: '1.1rem', mb: 2 }}>
        🗺️ Mapa de Ruta: {startPoint} → {endPoint}
      </Typography>

      {/* CONTENEDOR PRINCIPAL: LEYENDA Y MAPA LADO A LADO */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* LEYENDA - CONTENEDOR SEPARADO */}
        <Grid item xs={11} md={3}>
          <Paper sx={{ 
            p: 1.5, 
            bgcolor: '#f8f9fa', 
            borderRadius: 1, 
            border: '1px solid #e0e0e0',
            height: '55%'
          }}>
            <Typography variant="subtitle2" sx={{ 
              fontWeight: 'bold', 
              mb: 1.5, 
              fontSize: '0.85rem',
              color: '#1976d2'
            }}>
              📋 Leyenda
            </Typography>
            
            {/* Elementos de la leyenda */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
              <Box sx={{ 
                width: 14, 
                height: 14, 
                bgcolor: '#4caf50', 
                borderRadius: '50%', 
                mr: 1.5,
                border: '2px solid white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }} />
              <Box>
                <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                  Inicio
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                  {startPoint}
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
              <Box sx={{ 
                width: 14, 
                height: 14, 
                bgcolor: '#ff9800', 
                borderRadius: '50%', 
                mr: 1.5,
                border: '2px solid white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }} />
              <Box>
                <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                  Intermedios
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                  Estaciones
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Box sx={{ 
                width: 14, 
                height: 14, 
                bgcolor: '#f44336', 
                borderRadius: '50%', 
                mr: 1.5,
                border: '2px solid white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }} />
              <Box>
                <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                  Final
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                  {endPoint}
                </Typography>
              </Box>
            </Box>

            {/* Información adicional en leyenda */}
            <Box sx={{ 
              bgcolor: '#e3f2fd', 
              p: 1, 
              borderRadius: 1,
              border: '1px solid #bbdefb'
            }}>
              <Typography variant="caption" sx={{ 
                fontWeight: 'bold', 
                display: 'block',
                fontSize: '0.7rem',
                mb: 0.5
              }}>
                📊 Estadísticas
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.65rem', display: 'block' }}>
                <strong>Distancia:</strong> 12.5 km
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
                <strong>Tiempo:</strong> 45 min
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* MAPA - CONTENEDOR SEPARADO */}
        <Grid item xs={12} md={9}>
          <Box
            ref={mapRef}
            sx={{
              height: height - 120,
              background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
              borderRadius: 1,
              position: 'relative',
              border: '2px solid #1976d2',
              overflow: 'hidden'
            }}
          >
            {/* Línea de ruta simulada - PRIMERO para que quede detrás de los puntos */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '5%',
                width: '90%',
                height: '4px',
                backgroundColor: '#1976d2',
                transform: 'translateY(-50%)',
                zIndex: 1
              }}
            />

            {/* Puntos de la ruta simulados */}
            {routeCoordinates.map((point, index) => (
              <Box
                key={index}
                sx={{
                  position: 'absolute',
                  left: `${5 + (index * 11)}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: index === 0 ? '#4caf50' : 
                                 index === routeCoordinates.length - 1 ? '#f44336' : 
                                 '#ff9800',
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: 'white',
                  fontWeight: 'bold',
                  zIndex: 2
                }}
                title={point.name}
              >
                {index === 0 ? 'I' : index === routeCoordinates.length - 1 ? 'F' : index}
              </Box>
            ))}
          </Box>
        </Grid>
      </Grid>

      {/* Información de la ruta - MANTENIENDO TU ESTRUCTURA */}
      <Box sx={{ 
        p: 2, 
        bgcolor: '#f8f9fa', 
        borderRadius: 1, 
        border: '1px solid #e0e0e0' 
      }}>
        <Typography variant="subtitle1" sx={{ 
          fontWeight: 'bold', 
          mb: 1, 
          fontSize: '0.9rem',
          color: '#1976d2'
        }}>
          📍 Información de la Ruta:
        </Typography>
        
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="body2" sx={{ 
            fontWeight: 'bold', 
            fontSize: '0.8rem',
            color: '#333'
          }}>
            Ruta:
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
            {startPoint} → {endPoint}
          </Typography>
        </Box>
        
        <Box>
          <Typography variant="body2" sx={{ 
            fontWeight: 'bold', 
            fontSize: '0.8rem',
            color: '#333',
            mb: 0.5
          }}>
            Puntos:
          </Typography>
          <Typography variant="body2" sx={{ 
            fontSize: '0.8rem', 
            lineHeight: 1.4 
          }}>
            {routeCoordinates.map((point, index) => (
              <span key={index}>
                {point.name}
                {index < routeCoordinates.length - 1 ? ' → ' : ''}
              </span>
            ))}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default MapComponent;