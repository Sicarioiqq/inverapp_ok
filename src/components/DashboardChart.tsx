import React from 'react';

interface DashboardChartProps {
  title: string;
  subtitle?: string;
}

const DashboardChart: React.FC<DashboardChartProps> = ({ title, subtitle }) => {
  // Datos de ejemplo para el gráfico de barras
  const bars = [
    { height: '60%', label: 'Ene' },
    { height: '45%', label: 'Feb' },
    { height: '80%', label: 'Mar' },
    { height: '65%', label: 'Abr' },
    { height: '75%', label: 'May' },
    { height: '85%', label: 'Jun' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex items-end justify-between h-48 mt-4">
        {bars.map((bar, index) => (
          <div key={index} className="flex flex-col items-center w-full">
            <div
              className="w-8 bg-blue-500 rounded-t-md transition-all duration-300 hover:bg-blue-600"
              style={{ height: bar.height }}
            ></div>
            <span className="mt-2 text-sm text-gray-500">{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardChart;