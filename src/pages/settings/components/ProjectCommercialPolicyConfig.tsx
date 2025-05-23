// src/pages/settings/components/ProjectCommercialPolicyConfig.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { PlusCircle, Save, XCircle, Loader2 } from 'lucide-react';
import { differenceInCalendarMonths, parseISO, addMonths, isPast, format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale'; // Para formatear fechas en español

interface ProjectCommercialPolicy {
    id: string;
    project_name: string;
    monto_reserva_pesos: number;
    bono_pie_max_pct: number; // Almacenado como decimal (ej: 0.15 para 15%)
    fecha_tope: string | null; // Usamos string para el input type="date"
    observaciones: string | null;
    comuna: string | null;
    created_at: string;
    updated_at: string;
}

interface Unidad {
    proyecto_nombre: string;
}

const ProjectCommercialPolicyConfig: React.FC = () => {
    const [projectNames, setProjectNames] = useState<string[]>([]);
    const [policies, setPolicies] = useState<ProjectCommercialPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch unique project names and existing policies
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch unique project names from stock_unidades
                const { data: stockData, error: stockError } = await supabase
                    .from('stock_unidades')
                    .select('proyecto_nombre')
                    .neq('proyecto_nombre', '') // Evitar proyectos vacíos
                    .order('proyecto_nombre', { ascending: true });

                if (stockError) throw stockError;

                const uniqueProjectNames = Array.from(new Set(stockData.map(u => u.proyecto_nombre)))
                                                .filter((name): name is string => name !== null); // Filter out nulls and ensure string type

                setProjectNames(uniqueProjectNames);

                // Fetch existing commercial policies
                const { data: policiesData, error: policiesError } = await supabase
                    .from('project_commercial_policies')
                    .select('*');

                if (policiesError) throw policiesError;

                setPolicies(policiesData.map(policy => ({
                    ...policy,
                    // Asegúrate de que el bono_pie_max_pct se maneje como número
                    // y lo convertimos a porcentaje para la UI (ej. 0.15 a 15)
                    bono_pie_max_pct: parseFloat(((policy.bono_pie_max_pct || 0) * 100).toFixed(2)),
                })) || []);

            } catch (err: any) {
                console.error('Error fetching data:', err);
                setError(`Error al cargar datos: ${err.message || 'Desconocido'}`);
                toast.error(`Error al cargar datos: ${err.message || 'Desconocido'}`);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Function to calculate months remaining
    const calculateMonthsRemaining = (fechaTope: string | null): number => {
        if (!fechaTope) return 0;
        try {
            const today = new Date();
            const targetDate = parseISO(fechaTope); // Convert string to Date object
            
            // Check if targetDate is in the past, or if it's today but effectively past (e.g., less than 1 full month remaining)
            // Use end of day for comparison to be more forgiving for "today"
            const endOfDayTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

            if (isPast(endOfDayTarget) && !isSameDay(targetDate, today)) {
                return 1; // If date is past, indicate 1 month remaining
            }
            
            // Calculate months from the start of the current month to the start of the target month
            const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const startOfTargetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
            
            const monthsDiff = differenceInCalendarMonths(startOfTargetMonth, startOfCurrentMonth);

            return Math.max(1, monthsDiff + 1); // Ensure at least 1 month, and count the current month
        } catch (e) {
            console.error("Error calculating months remaining for date:", fechaTope, e);
            return 1; // Fallback to 1 in case of invalid date
        }
    };


    const handlePolicyChange = (
        projectName: string,
        field: keyof ProjectCommercialPolicy,
        value: any
    ) => {
        setPolicies(prevPolicies => {
            const existingPolicyIndex = prevPolicies.findIndex(p => p.project_name === projectName);

            // Sanitize number inputs: ensure they are numbers and handle empty string
            let processedValue = value;
            if (field === 'monto_reserva_pesos' || field === 'bono_pie_max_pct') {
                if (value === '') {
                    processedValue = 0; // Treat empty string as 0 for number fields
                } else {
                    processedValue = parseFloat(value);
                    if (isNaN(processedValue)) {
                        processedValue = 0; // Fallback for invalid number input
                    }
                }
            }


            if (existingPolicyIndex > -1) {
                // Update existing policy
                const updatedPolicies = [...prevPolicies];
                updatedPolicies[existingPolicyIndex] = {
                    ...updatedPolicies[existingPolicyIndex],
                    [field]: processedValue // Use processedValue
                };
                return updatedPolicies;
            } else {
                // Add new policy for a project not yet configured
                const newPolicy: ProjectCommercialPolicy = {
                    id: '', // Will be generated by Supabase on insert
                    project_name: projectName,
                    monto_reserva_pesos: 0,
                    bono_pie_max_pct: 0,
                    fecha_tope: null,
                    observaciones: null,
                    comuna: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    // Initialize other fields with defaults or null
                    ...{ [field]: processedValue } // Apply the specific change with processedValue
                };
                return [...prevPolicies, newPolicy];
            }
        });
    };

    const handleSavePolicy = async (policy: ProjectCommercialPolicy) => {
        setSaving(true);
        setError(null);
        try {
            // Convert bono_pie_max_pct back to a storable format (ej. 15 to 0.15)
            const policyToSave = {
                ...policy,
                bono_pie_max_pct: policy.bono_pie_max_pct / 100, // Convert percentage to decimal for storage
            };

            if (policy.id) {
                // Update existing policy
                const { error: updateError } = await supabase
                    .from('project_commercial_policies')
                    .update(policyToSave)
                    .eq('id', policy.id);

                if (updateError) throw updateError;
                toast.success(`Política para ${policy.project_name} actualizada.`);
            } else {
                // Insert new policy
                const { data, error: insertError } = await supabase
                    .from('project_commercial_policies')
                    .insert(policyToSave)
                    .select(); // Select the inserted data to get the new ID

                if (insertError) throw insertError;
                if (data && data.length > 0) {
                    setPolicies(prevPolicies =>
                        prevPolicies.map(p =>
                            p.project_name === policy.project_name ? { ...p, id: data[0].id } : p
                        )
                    );
                    toast.success(`Política para ${policy.project_name} guardada.`);
                }
            }
        } catch (err: any) {
            console.error('Error saving policy:', err);
            setError(`Error al guardar política para ${policy.project_name}: ${err.message || 'Desconocido'}`);
            toast.error(`Error al guardar política para ${policy.project_name}: ${err.message || 'Desconocido'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePolicy = async (policyId: string, projectName: string) => {
        if (!window.confirm(`¿Estás seguro de que quieres eliminar la política para ${projectName}?`)) {
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const { error: deleteError } = await supabase
                .from('project_commercial_policies')
                .delete()
                .eq('id', policyId);

            if (deleteError) throw deleteError;

            setPolicies(prevPolicies => prevPolicies.filter(p => p.id !== policyId));
            toast.success(`Política para ${projectName} eliminada.`);
        } catch (err: any) {
            console.error('Error deleting policy:', err);
            setError(`Error al eliminar política para ${projectName}: ${err.message || 'Desconocido'}`);
            toast.error(`Error al eliminar política para ${projectName}: ${err.message || 'Desconocido'}`);
        } finally {
            setSaving(false);
        }
    };

    const getPolicyForProject = (projectName: string): ProjectCommercialPolicy | undefined => {
        return policies.find(p => p.project_name === projectName);
    };

    return (
        <div className="bg-white shadow rounded p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">
                Política Comercial por Proyecto
            </h2>
            <p className="text-gray-600 mb-6">
                Configure los parámetros comerciales específicos para cada proyecto.
            </p>

            {loading ? (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="animate-spin mr-2" /> Cargando políticas...
                </div>
            ) : error ? (
                <div className="p-4 bg-red-100 text-red-700 rounded-md">
                    {error}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Proyecto
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Monto Reserva (CLP)
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Bono Pie Máximo (%)
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Fecha Tope
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Cuotas
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Comuna
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Observaciones
                                </th>
                                <th scope="col" className="relative px-6 py-3">
                                    <span className="sr-only">Acciones</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {projectNames.map(projectName => {
                                const policy = getPolicyForProject(projectName);
                                const isNew = !policy?.id;

                                // If policy exists, use its values, otherwise use defaults
                                // Ensure numerical fields are treated as numbers, not null/undefined
                                const currentMontoReserva = policy?.monto_reserva_pesos ?? 0;
                                const currentBonoMaxPct = policy?.bono_pie_max_pct ?? 0; // Already converted to % for UI on fetch
                                const currentFechaTope = policy?.fecha_tope || '';
                                const currentObservaciones = policy?.observaciones || '';
                                const currentComuna = policy?.comuna || '';

                                return (
                                    <tr key={projectName}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {projectName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <input
                                                type="number"
                                                value={currentMontoReserva}
                                                onChange={(e) => handlePolicyChange(projectName, 'monto_reserva_pesos', e.target.value)}
                                                className="border rounded-md p-1 w-28 text-right"
                                                min="0"
                                                step="1" // Permite incrementos de 1 en 1
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <input
                                                type="number"
                                                value={currentBonoMaxPct} // No .toFixed(2) here to allow direct input of decimals
                                                onChange={(e) => handlePolicyChange(projectName, 'bono_pie_max_pct', e.target.value)}
                                                className="border rounded-md p-1 w-24 text-right"
                                                step="0.01" // Permite decimales de 0.01
                                                min="0"
                                                max="100"
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <input
                                                type="date"
                                                value={currentFechaTope}
                                                onChange={(e) => handlePolicyChange(projectName, 'fecha_tope', e.target.value || null)}
                                                className="border rounded-md p-1 w-36"
                                                // No se necesita 'step' para 'type="date"', el control ya es granular por día
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <span className="font-semibold">
                                                {calculateMonthsRemaining(currentFechaTope)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <input
                                                type="text"
                                                value={currentComuna}
                                                onChange={(e) => handlePolicyChange(projectName, 'comuna', e.target.value)}
                                                className="border rounded-md p-1 w-32"
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <textarea
                                                value={currentObservaciones}
                                                onChange={(e) => handlePolicyChange(projectName, 'observaciones', e.target.value)}
                                                className="border rounded-md p-1 w-48 h-16 resize-y"
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleSavePolicy(policy || {
                                                    id: '',
                                                    project_name: projectName,
                                                    monto_reserva_pesos: currentMontoReserva,
                                                    bono_pie_max_pct: currentBonoMaxPct, // No se divide por 100 aquí, se hace en handleSavePolicy
                                                    fecha_tope: currentFechaTope,
                                                    observaciones: currentObservaciones,
                                                    comuna: currentComuna,
                                                    created_at: new Date().toISOString(),
                                                    updated_at: new Date().toISOString(),
                                                })}
                                                className={`text-indigo-600 hover:text-indigo-900 ml-2 p-2 rounded-full ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                disabled={saving}
                                                title={isNew ? 'Guardar política' : 'Actualizar política'}
                                            >
                                                <Save className="h-5 w-5" />
                                            </button>
                                            {policy?.id && (
                                                <button
                                                    onClick={() => handleDeletePolicy(policy.id, projectName)}
                                                    className={`text-red-600 hover:text-red-900 ml-2 p-2 rounded-full ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    disabled={saving}
                                                    title="Eliminar política"
                                                >
                                                    <XCircle className="h-5 w-5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ProjectCommercialPolicyConfig;