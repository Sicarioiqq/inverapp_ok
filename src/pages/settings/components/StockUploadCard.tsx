// src/pages/settings/components/StockUploadCard.tsx
import React, { useState, ChangeEvent } from 'react';
import * as XLSX from 'xlsx'; // Importa la librería xlsx
import { UploadCloud, FileText, Loader2 } from 'lucide-react';

interface StockUploadCardProps {
  onDataUpload: (data: any[]) => void; // Callback para enviar los datos parseados al padre
  // Podrías añadir más props si necesitas configurar algo específico, ej: el nombre de la hoja
}

const StockUploadCard: React.FC<StockUploadCardProps> = ({ onDataUpload }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccessMessage(null);
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de archivo (opcional pero recomendado)
      if (
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // .xlsx
        file.type === 'application/vnd.ms-excel' || // .xls
        file.type === 'text/csv' // .csv (aunque preferimos Excel)
      ) {
        setSelectedFile(file);
        setFileName(file.name);
      } else {
        setError('Formato de archivo no válido. Por favor, sube un archivo .xlsx, .xls o .csv.');
        setSelectedFile(null);
        setFileName('');
        event.target.value = ''; // Resetea el input
      }
    }
  };

  const handleProcessFile = async () => {
    if (!selectedFile) {
      setError('Por favor, selecciona un archivo primero.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        if (data) {
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convertir la hoja a JSON.
          // header: 1 indica que la primera fila son los encabezados.
          // raw: false formatea las fechas y números.
          // defval: '' usa string vacío para celdas vacías.
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

          // Aquí asumimos que la primera fila (jsonData[0]) son los encabezados
          // y las siguientes son los datos. Convertimos a un array de objetos.
          if (jsonData.length < 2) {
            throw new Error("El archivo no contiene datos suficientes o está mal formateado.");
          }

          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1);

          const formattedData = rows.map((rowArray: any) => {
            const rowObject: any = {};
            headers.forEach((header, index) => {
              // Normaliza el nombre de la columna
              let key = header;
              if (key.trim().toLowerCase() === 'imagen') key = 'imagen'; // mapeo explícito y robusto
              rowObject[key] = rowArray[index];
            });
            return rowObject;
          }).filter(row => headers.some(header => row[header] !== '')); // Filtrar filas completamente vacías

          if (formattedData.length === 0) {
            throw new Error("No se encontraron datos válidos después de los encabezados.");
          }

          onDataUpload(formattedData); // Llama al callback con los datos
          setSuccessMessage(`Archivo "${fileName}" procesado. ${formattedData.length} filas de datos encontradas.`);
          // Podrías mostrar una previsualización o más detalles aquí
        }
      } catch (err) {
        console.error("Error procesando el archivo:", err);
        setError(err instanceof Error ? err.message : 'Ocurrió un error al procesar el archivo.');
      } finally {
        setIsLoading(false);
        // Resetear el input para permitir subir el mismo archivo de nuevo si es necesario
        const fileInput = document.getElementById('file-upload-stock') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
        setSelectedFile(null);
        // setFileName(''); // Opcional: podrías querer mantener el nombre del último archivo subido
      }
    };

    reader.onerror = (err) => {
      console.error("Error leyendo el archivo:", err);
      setError('Ocurrió un error al leer el archivo.');
      setIsLoading(false);
    };

    reader.readAsArrayBuffer(selectedFile); // Lee el archivo como ArrayBuffer
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-lg mx-auto">
      <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
        <UploadCloud className="h-6 w-6 mr-2 text-blue-600" />
        Carga de Stock desde Excel
      </h3>
      
      <div className="mb-4">
        <label 
          htmlFor="file-upload-stock" 
          className="w-full flex flex-col items-center px-4 py-6 bg-white text-blue-600 rounded-lg shadow border border-blue-300 cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors duration-150"
        >
          {selectedFile ? (
            <FileText className="w-10 h-10 mb-2" />
          ) : (
            <UploadCloud className="w-10 h-10 mb-2" />
          )}
          <span className="text-sm font-medium">
            {fileName ? fileName : 'Selecciona un archivo (.xlsx, .xls)'}
          </span>
          <input 
            id="file-upload-stock" 
            type="file" 
            className="hidden" 
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv" // Define los tipos de archivo aceptados
          />
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-100 p-3 rounded mb-4">{error}</p>
      )}
      {successMessage && (
        <p className="text-sm text-green-600 bg-green-100 p-3 rounded mb-4">{successMessage}</p>
      )}

      <button
        onClick={handleProcessFile}
        disabled={!selectedFile || isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md flex items-center justify-center transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin h-5 w-5 mr-2" />
            Procesando...
          </>
        ) : (
          'Cargar y Procesar Archivo'
        )}
      </button>

      {/* Opcional: Aquí podrías añadir una sección para previsualizar algunos datos del Excel */}
    </div>
  );
};

export default StockUploadCard;