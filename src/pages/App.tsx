import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TareasAsignadas from './TareasAsignadas';
import Dashboard from './Dashboard';
import CalendarPage from './Calendar';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tareas-asignadas" element={<TareasAsignadas />} />
        <Route path="/calendario" element={<CalendarPage />} />
        {/* Agrega aquí el resto de tus rutas */}
      </Routes>
    </BrowserRouter>
  );
}

export default App; 