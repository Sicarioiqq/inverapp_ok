import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { PlusCircle, Save, XCircle, Loader2 } from 'lucide-react';
import { differenceInCalendarMonths, parseISO, addMonths, isPast, format } from 'date-fns';
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
                    bono_pie_max_pct: parseFloat((policy.bono_pie_max_pct || 0).toFixed(4)),
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
            // Set both dates to the first day of their respective months to count full months
            const startOfMonthToday = new Date(today.getFullYear(), today.getMonth(), 1);
            const startOfMonthTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);

            if (isPast(targetDate) && !isSameDay(targetDate, today)) { // Check if targetDate is in the past, excluding today itself
                return 1; // If date is past, indicate 1 month remaining (or could be 0 depending on exact policy)
            }
            const months = differenceInCalendarMonths(startOfMonthTarget, startOfMonthToday);
            return Math.max(1, months + 1); // Ensure at least 1 month if not past, and count current month
        } catch (e) {
            console.error("Error calculating months remaining for date:", fechaTope, e);
            return 1; // Fallback to 1 in case of invalid date
        }
    };

    // Helper to check if two dates are the same day (ignoring time)
    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    };

    const handlePolicyChange = (
        projectName: string,
        field: keyof ProjectCommercialPolicy,
        value: any
    ) => {
        setPolicies(prevPolicies => {
            const existingPolicyIndex = prevPolicies.findIndex(p => p.project_name === projectName);

            if (existingPolicyIndex > -1) {
                // Update existing policy
                const updatedPolicies = [...prevPolicies];
                updatedPolicies[existingPolicyIndex] = {
                    ...updatedPolicies[existingPolicyIndex],
                    [field]: value
                };
                return updatedPolicies;
            } else {
                // Add new policy for a project not yet configured
                const newPolicy: ProjectCommercialPolicy = {
                    id: '', // Will be generated by Supabase on insert
                    project_name: projectName,
                    monto_reserva_pesos: 0,
                    bono_pie_max_pct: 0.0000,
                    fecha_tope: null,
                    observaciones: null,
                    comuna: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    [field]: value
                };
                return [...prevPolicies, newPolicy];
            }
        });
    };

    const handleSavePolicy = async (policy: ProjectCommercialPolicy) => {
        setSaving(true);
        setError(null);
        try {
            // Convert bono_pie_max_pct to decimal for storage
            const policyToSave = {
                project_name: policy.project_name,
                monto_reserva_pesos: policy.monto_reserva_pesos,
                bono_pie_max_pct: policy.bono_pie_max_pct / 100,
                fecha_tope: policy.fecha_tope,
                observaciones: policy.observaciones,
                comuna: policy.comuna
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
                    .select();

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
                                const currentMontoReserva = policy?.monto_reserva_pesos || 0;
                                const currentBonoMaxPct = policy?.bono_pie_max_pct !== undefined ? (policy.bono_pie_max_pct * 100) : 0; // Convert to % for display
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
                                                onChange={(e) => handlePolicyChange(projectName, 'monto_reserva_pesos', parseInt(e.target.value) || 0)}
                                                className="border rounded-md p-1 w-28 text-right"
                                                min="0"
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <input
                                                type="number"
                                                value={currentBonoMaxPct.toFixed(2)} // Display with 2 decimals
                                                onChange={(e) => handlePolicyChange(projectName, 'bono_pie_max_pct', parseFloat(e.target.value) || 0)}
                                                className="border rounded-md p-1 w-24 text-right"
                                                step="0.01"
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
                                                onClick={() => handleSavePolicy({
                                                    id: policy?.id || '',
                                                    project_name: projectName,
                                                    monto_reserva_pesos: currentMontoReserva,
                                                    bono_pie_max_pct: currentBonoMaxPct,
                                                    fecha_tope: currentFechaTope,
                                                    observaciones: currentObservaciones,
                                                    comuna: currentComuna,
                                                    created_at: policy?.created_at || new Date().toISOString(),
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