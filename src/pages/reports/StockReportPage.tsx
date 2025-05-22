// src/pages/reports/StockReportPage.tsx

import React, { useState, useEffect, useMemo } from 'react';

import { supabase } from '../../lib/supabase';

import Layout from '../../components/Layout';

import { PackageSearch, AlertCircle, Loader2 } from 'lucide-react';



interface StockUnidad {

  id: string;

  created_at: string;

  proyecto_nombre: string | null;

  unidad: string | null;

  tipo_bien: string | null;

  tipologia: string | null;

  piso: string | null;

  orientacion: string | null;

  sup_util: number | null;

  sup_terraza: number | null;

  sup_total: number | null;

  valor_lista: number | null;

  estado_unidad: string | null;

  etapa: string | null;

}



const PAGE_SIZE = 1000; // Supabase max per request



const StockReportPage: React.FC = () => {

  const [stockData, setStockData]                 = useState<StockUnidad[]>([]);

  const [loading, setLoading]                     = useState<boolean>(true);

  const [error, setError]                         = useState<string | null>(null);

  const [activeTab, setActiveTab]                 = useState<'todos' | 'principales' | 'secundarios'>('todos');

  const [selectedProject, setSelectedProject]     = useState<string>('');

  const [selectedTipologia, setSelectedTipologia] = useState<string>('');



  useEffect(() => {

    const fetchAll = async () => {

      setLoading(true);

      setError(null);

      try {

        const columns = [

          'id', 'created_at', 'proyecto_nombre', 'unidad',

          'tipo_bien', 'tipologia', 'piso', 'orientacion',

          'sup_util', 'sup_terraza', 'sup_total', 'valor_lista',

          'estado_unidad', 'etapa'

        ].join(',');



        let from = 0;

        const all: StockUnidad[] = [];



        while (true) {

          const to = from + PAGE_SIZE - 1;

          const { data, error: fetchError } = await supabase

            .from<StockUnidad>('stock_unidades')

            .select(columns)

            .order('proyecto_nombre', { ascending: true })

            .order('unidad',         { ascending: true })

            .range(from, to);



          if (fetchError) throw fetchError;

          if (!data || data.length === 0) break;



          all.push(...data);

          if (data.length < PAGE_SIZE) break;



          from += PAGE_SIZE;

        }



        setStockData(all);

      } catch (err: any) {

        setError(`Error al cargar el stock: ${err.message}`);

        setStockData([]);

      } finally {

        setLoading(false);

      }

    };



    fetchAll();

  }, []);



  const proyectos = useMemo(() =>

    Array.from(new Set(stockData.map(u => u.proyecto_nombre).filter(Boolean))) as string[]

  , [stockData]);



  const tipologias = useMemo(() => {

    if (!selectedProject) return [];

    return Array.from(new Set(

      stockData

        .filter(u => u.proyecto_nombre === selectedProject && u.tipo_bien === 'DEPARTAMENTO' && u.tipologia)

        .map(u => u.tipologia as string)

    ));

  }, [stockData, selectedProject]);



  const filtered = useMemo(() =>

    stockData.filter(u =>

      (!selectedProject || u.proyecto_nombre === selectedProject) &&

      (!selectedTipologia || u.tipologia === selectedTipologia)

    )

  , [stockData, selectedProject, selectedTipologia]);



  const principales = filtered.filter(u => u.tipo_bien === 'DEPARTAMENTO');

  const secundarios = filtered.filter(u => u.tipo_bien !== 'DEPARTAMENTO');



  const renderTable = (rows: StockUnidad[]) => (

    <div className="overflow-x-auto bg-white shadow-md rounded-lg">

      <table className="min-w-full divide-y divide-gray-200">

        <thead className="bg-gray-100">

          <tr>

            {[

              'Proyecto','N° Bien','Tipo Bien','Tipología',

              'Piso','Sup. Útil','Precio UF','Estado','Etapa'

            ].map(h => (

              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">

                {h}

              </th>

            ))}

          </tr>

        </thead>

        <tbody className="bg-white divide-y divide-gray-200">

          {rows.map(item => (

            <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-150">

              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.proyecto_nombre}</td>

              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.unidad}</td>

              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.tipo_bien}</td>

              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.tipologia}</td>

              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.piso}</td>

              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{item.sup_util?.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>

              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{item.valor_lista?.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}</td>

              <td className="px-4 py-3 whitespace-nowrap text-sm">

                <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${

                  item.estado_unidad==='Disponible'?'bg-green-100 text-green-800':

                  item.estado_unidad==='Reservado'  ?'bg-yellow-100 text-yellow-800':

                  item.estado_unidad==='Vendido'    ?'bg-red-100 text-red-800':'bg-gray-100 text-gray-800'

                }`}>{item.estado_unidad}</span>

              </td>

              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.etapa}</td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );



  return (

    <Layout>

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">

        <div className="flex items-center gap-3">

          <PackageSearch className="h-8 w-8 text-blue-600" />

          <h1 className="text-3xl font-bold text-gray-800">Informe de Stock</h1>

        </div>



        <div className="bg-white shadow rounded-lg p-4 flex flex-col md:flex-row gap-4">

          <div className="flex-1">

            <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>

            <select

              value={selectedProject}

              onChange={e=>{setSelectedProject(e.target.value);setSelectedTipologia('');setActiveTab('todos');}}

              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"

            >

              <option value="">Todos</option>

              {proyectos.map(p=><option key={p} value={p}>{p}</option>)}

            </select>

          </div>

          <div className="flex-1">

            <label className="block text-sm font-medium text-gray-700 mb-1">Tipología (solo Deptos)</label>

            <select

              value={selectedTipologia}

              onChange={e=>{setSelectedTipologia(e.target.value);setActiveTab('principales');}}

              disabled={!selectedProject}

              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"

            >

              <option value="">Todos</option>

              {tipologias.map(t=><option key={t} value={t}>{t}</option>)}

            </select>

          </div>

        </div>



        <div className="border-b border-gray-200 mb-4">



        {/* Resumen de unidades actuales */}

        <div className="bg-white shadow rounded-lg p-4 mb-6 flex space-x-4">

          <div>

            <p className="text-sm text-gray-500">Total unidades mostradas</p>

            <p className="text-2xl font-semibold text-gray-800">{filtered.length}</p>

          </div>

          {activeTab!=='todos' && (

            <div>

              <p className="text-sm text-gray-500">Unidades {activeTab==='principales'? 'Deptos' : 'Otros'}</p>

              <p className="text-2xl font-semibold text-gray-800">{activeTab==='principales' ? principales.length : secundarios.length}</p>

            </div>

          )}

        </div>

          <nav className="-mb-px flex space-x-8">

            {['todos','principales','secundarios'].map(tab=>(

              <button

                key={tab}

                onClick={()=>setActiveTab(tab as any)}

                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${

                  activeTab===tab?'border-blue-500 text-blue-600':'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'

                }`}

              >

                {tab==='todos'?'Todos':tab==='principales'?'Principales':'Secundarios'}

              </button>

            ))}

          </nav>

        </div>



        {loading ? (

          <div className="p-6 flex justify-center items-center h-64">

            <Loader2 className="animate-spin h-8 w-8 text-blue-600" />

            <span className="ml-3 text-lg text-gray-700">Cargando stock...</span>

          </div>

        ) : error ? (

          <div className="p-6">

            <div className="flex items-center text-red-600 mb-4">

              <AlertCircle className="h-8 w-8 mr-3" />

              <h1 className="text-2xl font-semibold">Error al Cargar Stock</h1>

            </div>

            <p className="text-red-700 bg-red-100 p-4 rounded-md">{error}</p>

          </div>

        ) : activeTab==='todos' ? (

          renderTable(filtered)

        ) : activeTab==='principales' ? (

          renderTable(principales)

        ) : (

          renderTable(secundarios)

        )}

      </div>

    </Layout>

  );

};



export default StockReportPage;