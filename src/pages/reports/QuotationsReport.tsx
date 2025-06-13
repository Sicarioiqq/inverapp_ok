import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import Layout from '../../components/Layout';
import { Download, Search, ArrowUp, ArrowDown } from 'lucide-react';

interface QuotationItem {
  id: number;
  broker_name: string;
  project_name: string;
  unidad_seleccionada: string;
  precio_lista_unidad: number;
  descuento_disponible: number;
  comision_uf: number;
  usuario_id: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
}

interface QuotationsReportProps {
  noLayout?: boolean;
  onSelectCotizacion?: (cotizacion: QuotationItem) => void;
}

const QuotationsReport: React.FC<QuotationsReportProps> = ({ noLayout, onSelectCotizacion }) => {
  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortField, setSortField] = useState<string>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchQuotations();
    fetchUserProfiles();
    // eslint-disable-next-line
  }, [sortField, sortDirection]);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('commission_calculations')
        .select('id, broker_name, project_name, unidad_seleccionada, precio_lista_unidad, descuento_disponible, comision_uf, usuario_id, created_at')
        .order(sortField, { ascending: sortDirection === 'asc' });
      if (error) throw error;
      setQuotations(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name');
      if (error) throw error;
      setUserProfiles(data || []);
    } catch (err: any) {
      // No es crítico, puede seguir mostrando el informe
    }
  };

  const getUserFullName = (userId: string) => {
    const user = userProfiles.find(u => u.id === userId);
    return user ? `${user.first_name} ${user.last_name}` : userId;
  };

  const filteredQuotations = useMemo(() =>
    quotations.filter(item =>
      (item.broker_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.unidad_seleccionada?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getUserFullName(item.usuario_id).toLowerCase().includes(searchTerm.toLowerCase())
      )
    ), [quotations, searchTerm, userProfiles]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const handleExportCSV = () => {
    if (quotations.length === 0) return;
    const headers = [
      'ID',
      'Fecha',
      'Broker',
      'Proyecto',
      'Unidad',
      'Precio Lista',
      'Descuento Disponible (%)',
      'Comisión UF',
      'Usuario'
    ];
    const csvContent = [
      headers.join(','),
      ...quotations.map(item => [
        item.id,
        formatDate(item.created_at),
        `"${item.broker_name || ''}"`,
        `"${item.project_name || ''}"`,
        `"${item.unidad_seleccionada || ''}"`,
        item.precio_lista_unidad,
        (item.descuento_disponible * 100).toFixed(2),
        item.comision_uf.toFixed(2),
        `"${getUserFullName(item.usuario_id)}"`
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `informe_cotizaciones_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4 inline-block ml-1" /> : 
      <ArrowDown className="h-4 w-4 inline-block ml-1" />;
  };

  const content = (
    <div className="max-w-7xl mx-auto">
      {!noLayout && (
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Informe de Cotizaciones</h1>
          <div className="flex space-x-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por broker, proyecto, unidad o usuario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleExportCSV}
              disabled={quotations.length === 0}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-5 w-5 mr-2" />
              Exportar CSV
            </button>
          </div>
        </div>
      )}
      {noLayout && (
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Cotizaciones</h2>
          <button
            onClick={handleExportCSV}
            disabled={quotations.length === 0}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-5 w-5 mr-2" />
            Exportar CSV
          </button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredQuotations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
          {searchTerm ? 'No hay cotizaciones que coincidan con la búsqueda' : 'No hay cotizaciones registradas'}
        </div>
      ) : (
        <div className={`bg-white shadow-md rounded-lg overflow-hidden ${noLayout ? 'text-xs' : ''}`}>
          <div className="overflow-x-auto">
            <table className={`min-w-full divide-y divide-gray-200 ${noLayout ? 'text-xs' : ''}`}>
              <thead className="bg-gray-50">
                <tr>
                  <th className={`px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider cursor-pointer ${noLayout ? 'text-xs' : 'text-xs'}`} onClick={() => handleSort('id')}>ID <SortIcon field="id" /></th>
                  <th className={`px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider cursor-pointer ${noLayout ? 'text-xs' : 'text-xs'}`} onClick={() => handleSort('created_at')}>Fecha <SortIcon field="created_at" /></th>
                  <th className={`px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider cursor-pointer ${noLayout ? 'text-xs' : 'text-xs'}`} onClick={() => handleSort('broker_name')}>Broker <SortIcon field="broker_name" /></th>
                  <th className={`px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider cursor-pointer ${noLayout ? 'text-xs' : 'text-xs'}`} onClick={() => handleSort('project_name')}>Proyecto <SortIcon field="project_name" /></th>
                  <th className={`px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider cursor-pointer ${noLayout ? 'text-xs' : 'text-xs'}`} onClick={() => handleSort('unidad_seleccionada')}>Unidad <SortIcon field="unidad_seleccionada" /></th>
                  <th className={`px-4 py-2 text-right font-medium text-gray-500 uppercase tracking-wider cursor-pointer ${noLayout ? 'text-xs' : 'text-xs'}`} onClick={() => handleSort('precio_lista_unidad')}>Precio Lista <SortIcon field="precio_lista_unidad" /></th>
                  <th className={`px-4 py-2 text-right font-medium text-gray-500 uppercase tracking-wider cursor-pointer ${noLayout ? 'text-xs' : 'text-xs'}`} onClick={() => handleSort('descuento_disponible')}>Descuento Disponible (%) <SortIcon field="descuento_disponible" /></th>
                  <th className={`px-4 py-2 text-right font-medium text-gray-500 uppercase tracking-wider cursor-pointer ${noLayout ? 'text-xs' : 'text-xs'}`} onClick={() => handleSort('comision_uf')}>Comisión UF <SortIcon field="comision_uf" /></th>
                  <th className={`px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider cursor-pointer ${noLayout ? 'text-xs' : 'text-xs'}`} onClick={() => handleSort('usuario_id')}>Usuario <SortIcon field="usuario_id" /></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredQuotations.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 ${onSelectCotizacion ? 'cursor-pointer hover:bg-blue-100' : ''}`}
                    onClick={onSelectCotizacion ? () => onSelectCotizacion(item) : undefined}
                  >
                    <td className="px-4 py-2 whitespace-nowrap text-gray-900">{item.id}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-900">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-900">{item.broker_name}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-900">{item.project_name}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-900">{item.unidad_seleccionada}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-900 text-right">{item.precio_lista_unidad}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-900 text-right">{(item.descuento_disponible * 100).toFixed(2)}%</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-900 text-right">{item.comision_uf.toFixed(2)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-900">{getUserFullName(item.usuario_id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  if (noLayout) return content;
  return <Layout>{content}</Layout>;
};

export default QuotationsReport; 