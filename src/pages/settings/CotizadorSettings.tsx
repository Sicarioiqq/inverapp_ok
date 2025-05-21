// src/pages/settings/CotizadorSettings.tsx
import React from 'react';
import StockUploadCard from './components/StockUploadCard'; // <-- 1. Importa el nuevo componente

const CotizadorSettings: React.FC = () => {
  // 2. Define la función que manejará los datos del Excel
  const handleStockDataUploaded = (data: any[]) => {
    console.log('Datos del Excel recibidos en CotizadorSettings:', data);
    // AQUÍ ES DONDE PROCESARÁS LOS DATOS:
    // 1. Validar los datos (asegurarte de que las columnas esperadas existen, etc.)
    // 2. Transformar los datos si es necesario (ej. convertir tipos, calcular valores)
    // 3. Enviar los datos a tu backend/Supabase para guardarlos en la base de datos.
    //    - Podrías tener una tabla para 'proyectos_stock', 'unidades_stock', etc.
    //    - Deberás decidir si reemplazas todo el stock existente o haces un 'upsert'.
    //
    // Ejemplo de lo que podrías hacer:
    // if (data.length > 0) {
    //   // Suponiendo que tienes una función para enviar a Supabase
    //   // await saveStockToSupabase(data); 
    //   alert(`Se procesaron ${data.length} unidades. Revisa la consola para ver los datos.`);
    // }
  };

  return (
    <div className="p-6 space-y-8"> {/* Añadido space-y-8 para separar tarjetas si añades más */}
      <div>
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Configuración del Cotizador</h2>
        <p className="text-gray-600">
          Aquí podrás configurar los parámetros del cotizador, incluyendo la carga inicial de stock de unidades.
        </p>
      </div>

      {/* 3. Añade el componente StockUploadCard */}
      <StockUploadCard onDataUpload={handleStockDataUploaded} />

      {/* Puedes añadir más tarjetas de configuración aquí si es necesario */}
      {/*
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Otros Parámetros</h3>
        <p className="text-gray-600">Más configuraciones...</p>
      </div>
      */}
    </div>
  );
};

export default CotizadorSettings;