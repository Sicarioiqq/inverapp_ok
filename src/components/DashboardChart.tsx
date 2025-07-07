import React from 'react';

interface BarData {
  value: number;
  label: string;
}

interface DashboardChartProps {
  title: string;
  subtitle?: string;
  barsData?: BarData[];
  height?: string; // e.g. '100%', '300px', '20rem'
  mode: 'unidades' | 'uf';
  onModeChange: (mode: 'unidades' | 'uf') => void;
}

const DashboardChart: React.FC<DashboardChartProps> = ({ title, subtitle, barsData, height = '100%', mode, onModeChange }) => {
  // Si no se pasan datos, usar datos de ejemplo
  const bars = barsData && barsData.length > 0
    ? barsData
    : [
        { value: 60, label: 'Ene' },
        { value: 45, label: 'Feb' },
        { value: 80, label: 'Mar' },
        { value: 65, label: 'Abr' },
        { value: 75, label: 'May' },
        { value: 85, label: 'Jun' },
      ];

  // Calcular el valor máximo para escalar las barras (mínimo 5 para unidades, mínimo 100 para UF)
  const maxValue = Math.max(...bars.map(b => b.value), mode === 'uf' ? 100 : 5);

  // Formatear valor UF
  const formatUF = (val: number) => {
    return val.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' UF';
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-3 h-full w-full flex flex-col" style={{ height }}>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        {/* Selector de modo */}
        <div className="flex items-center space-x-1">
          <button
            className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${mode === 'unidades' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-blue-50'}`}
            onClick={() => onModeChange('unidades')}
          >
            Unidades
          </button>
          <button
            className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${mode === 'uf' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-blue-50'}`}
            onClick={() => onModeChange('uf')}
          >
            UF
          </button>
        </div>
      </div>
      <div className="flex-1 w-full h-full flex items-end justify-between mt-2" style={{ minHeight: '7rem' }}>
        {bars.map((bar, index) => (
          <div key={index} className="flex flex-col items-center flex-1 h-full">
            {/* Número justo encima de la barra */}
            <div className="flex flex-col items-center justify-end h-full w-full">
              <span className="mb-1 text-sm font-semibold text-blue-700 select-none">
                {mode === 'uf' ? formatUF(bar.value) : bar.value}
              </span>
              <div
                className="w-10 bg-blue-500 rounded-t-md transition-all duration-300 hover:bg-blue-600"
                style={{ height: `${(bar.value / maxValue) * 100}%`, minHeight: '4px' }}
              ></div>
            </div>
            <span className="mt-1 text-xs text-gray-500">{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardChart;