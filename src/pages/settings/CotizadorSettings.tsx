// src/pages/settings/CotizadorSettings.tsx
import React, { useState } from 'react';
import StockUploadCard from './components/StockUploadCard';
import BrokerCommissionsConfig from './components/BrokerCommissionsConfig';
import ProjectCommercialPolicyConfig from './components/ProjectCommercialPolicyConfig'; // IMPORTA EL NUEVO COMPONENTE
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Settings, SlidersHorizontal, DollarSign, Loader2 } from 'lucide-react'; // Added Loader2 import

// ... (tus funciones auxiliares toNumber, getSafeString, normalizeEstado se mantienen igual) ...
const toNumber = (value: any): number | null => {
    if (value == null) return null;
    const s = String(value).trim().replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
};
const getSafeString = (value: any): string | null => {
    if (value == null) return null;
    const s = String(value).trim();
    return (s === '' || s.toUpperCase() === 'EMPTY') ? null : s;
};
const normalizeEstado = (raw: string | null): string => {
    if (!raw) return 'Disponible';
    const val = raw.trim().toLowerCase();
    if (['sí', 'si', 'true', '1', 'bloqueado'].includes(val)) {
        return 'No Disponible';
    }
    return 'Disponible';
};

type CotizadorSettingTab = 'stock' | 'commercial_policy' | 'broker_commissions'; // Nuevos tipos de pestañas

const CotizadorSettings: React.FC = () => {
    const [isUploading, setIsUploading] = useState(false);
    const [supabaseError, setSupabaseError] = useState<string | null>(null);
    const [supabaseSuccess, setSupabaseSuccess] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<CotizadorSettingTab>('stock'); // Nuevo estado para la pestaña activa

    const handleStockDataUploaded = async (dataFromExcel: any[]) => {
        setSupabaseError(null);
        setSupabaseSuccess(null);

        if (!dataFromExcel?.length) {
            toast.error('No hay datos para cargar desde el archivo Excel.');
            return;
        }
        setIsUploading(true);

        const mapped = dataFromExcel
            .map(row => {
                const proyecto_nombre = getSafeString(row['Nombre del Proyecto']);
                const unidad          = getSafeString(row['N° Bien']);
                const tipologia       = getSafeString(row['Tipo']);
                const tipo_bien       = getSafeString(row['Tipo Bien']);
                const etapa           = getSafeString(row['Etapa']);
                const piso            = getSafeString(row['Piso']);
                const orientacion     = getSafeString(row['Orientación']);
                const valor_lista     = toNumber(row['Valor lista']);
                const descuento       = toNumber(row['Descuento autorizado']);
                const sup_interior    = toNumber(row['Sup. Interior']);
                const sup_util        = toNumber(row['Sup. Útil']);
                const sup_terraza     = toNumber(row['Sup. terraza']);
                const sup_ponderada   = toNumber(row['Sup. ponderada']);
                const sup_terreno     = toNumber(row['Sup. terreno']);
                const sup_jardin      = toNumber(row['Sup. jardín']);
                const sup_total       = toNumber(row['Sup. total']);
                const sup_logia       = toNumber(row['Sup. logia']);
                const rawBloq         = getSafeString(row['Bloqueado']);
                const estado_unidad   = normalizeEstado(rawBloq);
                const imagen          = getSafeString(row['imagen']);

                if (!proyecto_nombre || !unidad || !tipo_bien) {
                    console.warn('Fila incompleta (Proyecto, Unidad o Tipo Bien faltante):', row);
                    return null;
                }
                return {
                    proyecto_nombre, unidad, tipo_bien, tipologia, etapa, piso, orientacion,
                    valor_lista, descuento, sup_interior, sup_util, sup_terraza, sup_ponderada,
                    sup_terreno, sup_jardin, sup_total, sup_logia, estado_unidad,
                    imagen,
                };
            })
            .filter((x): x is NonNullable<typeof x> =>
                !!x && !!x.proyecto_nombre && !!x.unidad && !!x.tipo_bien
            );

        if (!mapped.length) {
            const errorMsg = 'No se encontraron filas válidas con Proyecto, N° Bien y Tipo Bien.';
            setSupabaseError(errorMsg);
            toast.error(errorMsg);
            setIsUploading(false);
            return;
        }

        const seen = new Set<string>();
        const dupes = mapped.filter(item => {
            const key = `${item.proyecto_nombre}:${item.unidad}:${item.tipo_bien}`;
            if (seen.has(key)) return true;
            seen.add(key);
            return false;
        });

        if (dupes.length) {
            const errorMsg = `Hay ${dupes.length} registros duplicados en el Excel (misma combinación de Proyecto, N° Bien y Tipo Bien). Corrige y reintenta.`;
            setSupabaseError(errorMsg);
            toast.error(errorMsg);
            console.warn('Duplicados encontrados en el archivo:', dupes);
            setIsUploading(false);
            return;
        }

        try {
            console.log('Borrando stock existente...');
            const { error: deleteError } = await supabase
                .from('stock_unidades')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            if (deleteError) {
                console.error('Error al borrar stock:', deleteError);
                throw deleteError;
            }
            console.log('Stock anterior eliminado.');

            console.log(`Insertando ${mapped.length} nuevas unidades...`);
            const { data, error: insertError } = await supabase
                .from('stock_unidades')
                .insert(mapped);
            if (insertError) {
                console.error('Error al insertar nuevo stock:', insertError);
                throw insertError;
            }

            const successMsg = `¡Stock reemplazado! ${mapped.length} unidades cargadas.`;
            setSupabaseSuccess(successMsg);
            toast.success(successMsg);
            console.log('Resultado de la inserción:', data);

        } catch (err: any) {
            console.error('Error en el proceso de carga de stock:', err);
            const errorMsg = `Error en el proceso de carga de stock: ${err.message || 'Error desconocido.'}`;
            setSupabaseError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="p-6 space-y-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Configuración del Cotizador</h1>

            {/* Navigation Tabs */}
            <nav className="flex space-x-4 border-b pb-2 mb-6">
                <button
                    onClick={() => setActiveTab('stock')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-md ${activeTab === 'stock' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
                >
                    <Settings className="inline-block w-4 h-4 mr-1" /> Carga de Stock
                </button>
                <button
                    onClick={() => setActiveTab('commercial_policy')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-md ${activeTab === 'commercial_policy' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
                >
                    <DollarSign className="inline-block w-4 h-4 mr-1" /> Política Comercial
                </button>
                <button
                    onClick={() => setActiveTab('broker_commissions')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-md ${activeTab === 'broker_commissions' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
                >
                    <SlidersHorizontal className="inline-block w-4 h-4 mr-1" /> Comisiones Broker
                </button>
            </nav>

            {/* Tab Content */}
            {activeTab === 'stock' && (
                <div>
                    <div className="mb-6">
                        <p className="text-gray-600">
                            Carga inicial de stock de unidades (reemplaza todo el stock existente).
                        </p>
                    </div>
                    <StockUploadCard onDataUpload={handleStockDataUploaded} />
                    {isUploading && (
                        <div className="mt-4 p-3 bg-blue-100 text-blue-700 rounded-md flex items-center animate-pulse">
                            <Loader2 className="animate-spin h-5 w-5 mr-3" />
                            Cargando datos de stock...
                        </div>
                    )}
                    {supabaseError && (
                        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
                            <strong>Error en carga de stock:</strong> {supabaseError}
                        </div>
                    )}
                    {supabaseSuccess && (
                        <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-md">
                            {supabaseSuccess}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'commercial_policy' && (
                <ProjectCommercialPolicyConfig />
            )}

            {activeTab === 'broker_commissions' && (
                <BrokerCommissionsConfig />
            )}
        </div>
    );
};

export default CotizadorSettings;