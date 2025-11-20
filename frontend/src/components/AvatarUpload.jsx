import React, { useState } from 'react';
import { Button } from '@mui/material';
import axios from '../services/api'; // tu instancia axios (asegúrate baseURL está configurado)

export default function AvatarUpload({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFile = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return alert('Selecciona una imagen');
    const fd = new FormData();
    fd.append('avatar', file); // el nombre 'avatar' debe coincidir con upload.single('avatar')

    try {
      setLoading(true);
      const res = await axios.put('/users/avatar', fd); // axios ya debe incluir Authorization header global
      // res.data.user.avatar contendrá la URL absoluta si el backend la retorna
      if (onUploaded) onUploaded(res.data.user);
      alert('Imagen subida correctamente');
    } catch (err) {
      console.error('Upload error', err.response?.data || err.message);
      alert('Error subiendo imagen: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input accept="image/*" type="file" onChange={handleFile} />
      <Button variant="contained" onClick={handleUpload} disabled={!file || loading}>
        {loading ? 'Subiendo...' : 'Subir imagen'}
      </Button>
    </div>
  );
}