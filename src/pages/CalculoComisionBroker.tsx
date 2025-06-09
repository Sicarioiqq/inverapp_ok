import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { Dialog } from '@headlessui/react';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import LiquidacionComisionPDF from '../components/pdf/LiquidacionComisionPDF';

interface Unidad {
  id: string;
  proyecto_nombre: string | null;
  unidad: string | null;
  tipologia: string | null;
  tipo_bien: string | null;
  piso: string | null;
  orientacion: string | null;
  sup_util: number | null;
  sup_terraza: number | null;
  sup_total: number | null;
  valor_lista: number | null;
  estado_unidad: string | null;
  etapa: string | null;
  descuento?: number;
}

interface Broker {
  id: string;
  name: string;
}

interface BrokerProjectCommission {
  id: string;
  broker_id: string;
  project_name: string;
  commission_rate: number;
}

const CalculoComisionBroker: React.FC = () => {
  const { unidadId } = useParams<{ unidadId: string }>();
  const [unidad, setUnidad] = useState<Unidad | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [selectedBroker, setSelectedBroker] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commissions, setCommissions] = useState<BrokerProjectCommission[]>([]);
  const [incluyeSecundarios, setIncluyeSecundarios] = useState(false);
  const [modalSecundariosOpen, setModalSecundariosOpen] = useState(false);
  const [unidadesSecundariasDisponibles, setUnidadesSecundariasDisponibles] = useState<Unidad[]>([]);

  const [secundariosSeleccionados, setSecundariosSeleccionados] = useState<Unidad[]>([]);
  const [filtroTipoBien, setFiltroTipoBien] = useState('');
  const [filtroUnidad, setFiltroUnidad] = useState('');
  const [descuentoFijo, setDescuentoFijo] = useState(0);
  const [bonoPie, setBonoPie] = useState(0);
  const [observacionesPolitica, setObservacionesPolitica] = useState<string | null>(null);

  const [pdfData, setPdfData] = useState<any>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState<any>(null);

  // Handler para agregar secundaria (simulado)
  const handleAgregarSecundaria = (id: string) => {
    const unidad = unidadesSecundariasDisponibles.find(u => u.id === id);
    if (unidad && !secundariosSeleccionados.some(s => s.id === id)) {
      setSecundariosSeleccionados([...secundariosSeleccionados, unidad]);
    }
  };
  // Handler para quitar secundaria
  const handleQuitarSecundaria = (id: string) => {
    setSecundariosSeleccionados(secundariosSeleccionados.filter(s => s.id !== id));
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Traer unidad seleccionada
        const { data: unidadData, error: unidadError } = await supabase
          .from('stock_unidades')
          .select('*')
          .eq('id', unidadId)
          .maybeSingle();
        if (unidadError) throw unidadError;
        setUnidad(unidadData);
        // Traer brokers
        const { data: brokersData, error: brokersError } = await supabase
          .from('brokers')
          .select('id, name');
        if (brokersError) throw brokersError;
        setBrokers(brokersData || []);
        // Traer commissions
        const { data: commissionsData, error: commissionsError } = await supabase
          .from('broker_project_commissions')
          .select('id, broker_id, project_name, commission_rate');
        if (commissionsError) throw commissionsError;
        setCommissions(commissionsData || []);
      } catch (err: any) {
        setError('Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [unidadId]);

  useEffect(() => {
    const fetchSecundarios = async () => {
      if (!unidad) {
        setUnidadesSecundariasDisponibles([]);
        return;
      }
      const { data, error } = await supabase
        .from('stock_unidades')
        .select('*')
        .eq('proyecto_nombre', unidad.proyecto_nombre)
        .neq('tipo_bien', 'DEPARTAMENTO');
      if (error) {
        setUnidadesSecundariasDisponibles([]);
      } else {
        setUnidadesSecundariasDisponibles(data || []);
      }
    };
    fetchSecundarios();
  }, [unidad]);

  useEffect(() => {
    const fetchPolitica = async () => {
      if (!unidad) {
        setObservacionesPolitica(null);
        return;
      }
      const { data, error } = await supabase
        .from('project_commercial_policies')
        .select('observaciones')
        .eq('project_name', unidad.proyecto_nombre)
        .maybeSingle();
      if (error) {
        setObservacionesPolitica(null);
      } else {
        setObservacionesPolitica(data?.observaciones ?? null);
      }
    };
    fetchPolitica();
  }, [unidad]);

  // Obtener usuario actual correctamente
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUsuarioActual(data?.user || null);
    };
    getUser();
  }, []);

  // Cálculos
  const precioLista = unidad?.valor_lista ?? 0;
  const descuentoDisponible = unidad?.descuento ?? 0;
  const precioMinimo = precioLista * (1 - descuentoDisponible);
  const commissionObj = commissions.find(c => c.broker_id === selectedBroker && c.project_name === unidad?.proyecto_nombre);
  const comisionIVAIncluido = commissionObj?.commission_rate ?? null;
  const comisionUF = comisionIVAIncluido !== null ? (precioMinimo * comisionIVAIncluido / 100) : null;

  // Secundarios (por ahora vacío, luego se puede conectar a la selección real)
  const secundarios: Unidad[] = [];
  const totalSecundarios = secundarios.reduce((sum, s) => sum + (s.valor_lista ?? 0), 0);
  const totalPrecioLista = precioLista + totalSecundarios;
  const totalSecundariosValor = secundariosSeleccionados.reduce((sum, s) => sum + (s.valor_lista ?? 0), 0);
  const recuperacionTotalMinima = (precioLista * (1 - descuentoDisponible)) + totalSecundariosValor + (comisionUF ?? 0);
  const descuentoDisponibleConComision = totalPrecioLista - recuperacionTotalMinima;
  const baseDescuento = totalPrecioLista - totalSecundarios;
  const descuentoDisponibleConComisionPct = baseDescuento > 0 ? (descuentoDisponibleConComision / baseDescuento) * 100 : 0;

  // Cálculo Bono Descuento (ajustado a la fórmula solicitada)
  // =ROUNDDOWN(((U29*(1-D45)+V29)-D37)/((U29*(1-D45))+V29);4)
  // U29: precioListaDepto, D45: descuentoFijo/100, V29: totalSecundariosValor, D37: recuperacionTotalMinima
  const precioListaDepto = unidad?.valor_lista ?? 0;
  const baseDeptoConDescuento = precioListaDepto * (1 - descuentoFijo / 100);
  const sumaSecundarios = totalSecundariosValor;
  const numeradorBono = (baseDeptoConDescuento + sumaSecundarios) - recuperacionTotalMinima;
  const denominadorBono = baseDeptoConDescuento + sumaSecundarios;
  const bonoDescuentoPct = denominadorBono > 0 ? Math.floor(((numeradorBono / denominadorBono) * 10000)) / 100 : 0;

  // Cálculo Descuento Disponible para Bono Pie (ajustado a la fórmula solicitada)
  // =ROUNDDOWN(1-((D37/(1-D56)-V29)/U29);4)
  // D37: recuperacionTotalMinima, D56: bonoPie/100, V29: totalSecundariosValor, U29: precioListaDepto
  let descuentoDisponibleBonoPie = 0;
  if (precioListaDepto > 0 && (1 - bonoPie / 100) !== 0) {
    descuentoDisponibleBonoPie = 1 - (((recuperacionTotalMinima / (1 - bonoPie / 100)) - totalSecundariosValor) / precioListaDepto);
    descuentoDisponibleBonoPie = Math.floor(descuentoDisponibleBonoPie * 10000) / 100;
  }

  // Mostrar descuentoDisponibleBonoPie como porcentaje real (dividir por 100)
  const descuentoDisponibleBonoPieDisplay = descuentoDisponibleBonoPie;

  // Cálculo Información Útil (corregido)
  const descuentoUnidadDisponible = unidad?.descuento ?? 0;
  const ufDisponibleDcto = precioListaDepto * descuentoUnidadDisponible;
  const ufDisponibleBroker = ufDisponibleDcto - (comisionUF ?? 0);

  // Cálculo Dcto. Disponible con Comisión según fórmula proporcionada
  // =IF(D27="SI";(D23+V29)*D31;D23*D31)
  // D27: incluyeSecundarios, D23: precioMinimo, V29: totalSecundariosValor, D31: comisión (decimal)
  const comisionPct = commissionObj?.commission_rate ? commissionObj.commission_rate / 100 : 0;
  const dctoDisponibleConComisionUF = incluyeSecundarios
    ? (precioMinimo + totalSecundariosValor) * comisionPct
    : precioMinimo * comisionPct;

  const handleGuardarYGenerarPDF = async () => {
    setSaving(true);
    // Guardar en Supabase
    const insertData = {
      broker_id: selectedBroker || null,
      broker_name: brokers.find(b => b.id === selectedBroker)?.name || null,
      project_name: unidad?.proyecto_nombre || null,
      unidad_seleccionada: unidad?.unidad || null,
      precio_lista_unidad: precioListaDepto ?? 0,
      descuento_disponible: descuentoUnidadDisponible ?? 0,
      precio_minimo: precioMinimo ?? 0,
      recuperacion_total_minima: recuperacionTotalMinima ?? 0,
      comision_uf: comisionUF ?? 0,
      comision_pct: (commissionObj?.commission_rate ?? 0) / 100,
      politica_comercial: observacionesPolitica,
      usuario_id: usuarioActual?.id || null,
      usuario_email: usuarioActual?.email || null,
    };
    const { data: insertResult, error: insertError } = await supabase.from('commission_calculations').insert([insertData]).select();
    if (insertError || !insertResult || !insertResult[0]) {
      setSaving(false);
      alert('Error al guardar la liquidación');
      return;
    }
    const liquidacion = insertResult[0];
    const fechaLiquidacion = liquidacion.created_at ? new Date(liquidacion.created_at).toLocaleString('es-CL') : new Date().toLocaleString('es-CL');
    const pdfDoc = <LiquidacionComisionPDF datos={{
      idLiquidacion: liquidacion.id,
      fechaLiquidacion,
      broker: brokers.find(b => b.id === selectedBroker)?.name || '',
      project: unidad?.proyecto_nombre || '',
      unidad: unidad?.unidad || '',
      precioLista: precioListaDepto ?? 0,
      dctoDisponible: descuentoUnidadDisponible ?? 0,
      precioMinimo: precioMinimo ?? 0,
      comisionIVAIncluido: comisionUF ?? 0,
      comisionPct: (commissionObj?.commission_rate ?? 0) / 100,
      politicaComercial: observacionesPolitica,
      dctoDisponibleConComisionUF,
    }} />;
    const asPdf = pdf();
    asPdf.updateContainer(pdfDoc);
    const blob = await asPdf.toBlob();
    const url = URL.createObjectURL(blob);
    const brokerName = brokers.find(b => b.id === selectedBroker)?.name || '';
    const projectName = unidad?.proyecto_nombre || '';
    const unidadSeleccionada = unidad?.unidad || '';
    const idLiquidacion = liquidacion.id;
    const pdfFileName = `${brokerName} - ${projectName} - ${unidadSeleccionada} (${idLiquidacion}).pdf`;
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSaving(false);
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Cálculo de Comisión Broker</h1>
        {loading ? (
          <div className="text-gray-500">Cargando...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Broker</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={selectedBroker}
                onChange={e => setSelectedBroker(e.target.value)}
              >
                <option value="">Seleccione un broker</option>
                {brokers
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
              </select>
            </div>
            {unidad && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                {/* Columna izquierda: Configuración y secundarios */}
                <div className="md:col-span-1 w-full flex flex-col gap-4">
                  <div className="bg-white shadow rounded-lg p-4">
                    <h2 className="text-lg font-semibold mb-2">Configuración Cotización</h2>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-medium">Incluye Unidades Secundarias</span>
                      <button
                        type="button"
                        className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${incluyeSecundarios ? 'bg-blue-600' : 'bg-gray-300'}`}
                        onClick={() => setIncluyeSecundarios(v => !v)}
                      >
                        <span
                          className={`h-4 w-4 bg-white rounded-full shadow transform transition-transform duration-200 ${incluyeSecundarios ? 'translate-x-6' : ''}`}
                        />
                      </button>
                      <span className="ml-2 text-xs font-semibold">{incluyeSecundarios ? 'SI' : 'NO'}</span>
                    </div>
                  </div>
                  {/* Tarjeta para agregar unidades secundarias */}
                  <div className="bg-white shadow rounded-lg p-4">
                    <h2 className="text-lg font-semibold mb-2">Agregar Unidades Secundarias</h2>
                    <button
                      className="w-full bg-blue-600 text-white rounded px-3 py-2 mb-2 hover:bg-blue-700 transition"
                      onClick={() => setModalSecundariosOpen(true)}
                    >
                      Agregar Secundarios
                    </button>
                    {/* Listado de seleccionadas */}
                    <ul className="text-xs mt-2">
                      {secundariosSeleccionados.length === 0 && <li className="text-gray-400">No hay unidades secundarias agregadas.</li>}
                      {secundariosSeleccionados.map(s => (
                        <li key={s.id} className="flex justify-between items-center border-b py-1">
                          <span>{s.tipo_bien} {s.unidad} - UF {s.valor_lista}</span>
                          <button className="text-red-500 text-xs ml-2" onClick={() => handleQuitarSecundaria(s.id)}>Quitar</button>
                        </li>
                      ))}
                    </ul>
                    {/* Modal para seleccionar secundarios */}
                    <Dialog open={modalSecundariosOpen} onClose={() => setModalSecundariosOpen(false)} className="fixed z-50 inset-0 overflow-y-auto">
                      <div className="fixed inset-0 bg-black opacity-30" aria-hidden="true"></div>
                      <div className="flex items-center justify-center min-h-screen">
                        <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-auto z-10">
                          <Dialog.Title className="text-lg font-bold mb-4">Seleccionar Unidades Secundarias</Dialog.Title>
                          {/* Filtros */}
                          <div className="flex flex-col md:flex-row gap-2 mb-4 text-xs">
                            <select
                              className="border rounded px-2 py-1"
                              value={filtroTipoBien}
                              onChange={e => setFiltroTipoBien(e.target.value)}
                            >
                              <option value="">Todos los tipos</option>
                              {[...new Set(unidadesSecundariasDisponibles.map(u => u.tipo_bien).filter(Boolean))].map(tipo => (
                                <option key={tipo} value={tipo as string}>{tipo}</option>
                              ))}
                            </select>
                            <input
                              className="border rounded px-2 py-1"
                              type="text"
                              placeholder="Buscar N° Bien"
                              value={filtroUnidad}
                              onChange={e => setFiltroUnidad(e.target.value)}
                            />
                          </div>
                          <ul className="max-h-80 overflow-y-auto divide-y text-xs">
                            {unidadesSecundariasDisponibles
                              .filter(u => !secundariosSeleccionados.some(s => s.id === u.id))
                              .filter(u => !filtroTipoBien || u.tipo_bien === filtroTipoBien)
                              .filter(u => !filtroUnidad || (u.unidad && u.unidad.toLowerCase().includes(filtroUnidad.toLowerCase())))
                              .length === 0 && (
                              <li className="text-gray-400 py-4 text-center">No hay unidades secundarias disponibles para este proyecto.</li>
                            )}
                            {unidadesSecundariasDisponibles
                              .filter(u => !secundariosSeleccionados.some(s => s.id === u.id))
                              .filter(u => !filtroTipoBien || u.tipo_bien === filtroTipoBien)
                              .filter(u => !filtroUnidad || (u.unidad && u.unidad.toLowerCase().includes(filtroUnidad.toLowerCase())))
                              .map(u => (
                                <li key={u.id} className="py-2 flex justify-between items-center hover:bg-blue-50 cursor-pointer px-2"
                                    onClick={() => { handleAgregarSecundaria(u.id); setModalSecundariosOpen(false); }}>
                                  <span>{u.proyecto_nombre} - {u.unidad} - {u.tipo_bien} - UF {u.valor_lista}</span>
                                  <button className="text-blue-600 text-xs ml-2">Agregar</button>
                                </li>
                              ))}
                          </ul>
                          <button className="mt-4 w-full bg-gray-200 rounded px-3 py-2" onClick={() => setModalSecundariosOpen(false)}>Cerrar</button>
                        </div>
                      </div>
                    </Dialog>
                  </div>
                  {/* Tarjeta Descuento Fijo debajo de secundarios */}
                  <div className="bg-white shadow rounded-lg p-4">
                    <h2 className="text-lg font-semibold mb-2">Descuento Fijo</h2>
                    <div className="flex flex-col gap-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <label className="font-medium mb-0">Seleccione Descuento (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={descuentoFijo}
                          onChange={e => setDescuentoFijo(Number(e.target.value))}
                          className="border rounded px-2 py-1 w-24 text-right"
                        />
                      </div>
                      <div className="mt-2 flex justify-between items-center">
                        <span className="font-medium">Bono Disponible:</span>
                        <span className="text-blue-700 font-bold text-base">{bonoDescuentoPct.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                  {/* Tarjeta Bono Pie debajo de Descuento Fijo */}
                  <div className="bg-white shadow rounded-lg p-4">
                    <h2 className="text-lg font-semibold mb-2">Bono Pie</h2>
                    <div className="flex flex-col gap-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <label className="font-medium mb-0">Seleccione Bono (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={bonoPie}
                          onChange={e => setBonoPie(Number(e.target.value))}
                          className="border rounded px-2 py-1 w-24 text-right"
                        />
                      </div>
                      <div className="mt-2 flex justify-between items-center">
                        <span className="font-medium">Descuento Disponible:</span>
                        <span className="text-blue-700 font-bold text-base">{descuentoDisponibleBonoPieDisplay.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                  {/* Tarjeta Información Útil debajo de Bono Pie */}
                  <div className="bg-white shadow rounded-lg p-4">
                    <h2 className="text-lg font-semibold mb-2">Información Útil</h2>
                    <div className="flex flex-col gap-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">UF Disponible Dcto:</span>
                        <span className="text-blue-700 font-bold text-base">{ufDisponibleDcto.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">UF Disponible Broker:</span>
                        <span className="text-blue-700 font-bold text-base">{ufDisponibleBroker.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Tarjetas de resultados a la derecha */}
                <div className="md:col-span-2 flex flex-col gap-4 w-full">
                  <div className="bg-white shadow rounded-lg p-4 mb-4">
                    <h2 className="text-lg font-semibold mb-2">Unidad Seleccionada</h2>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                      <div><span className="font-medium">Proyecto:</span> {unidad.proyecto_nombre}</div>
                      <div><span className="font-medium">N° Bien:</span> {unidad.unidad}</div>
                      <div><span className="font-medium">Tipología:</span> {unidad.tipologia}</div>
                      <div><span className="font-medium">Piso:</span> {unidad.piso}</div>
                      <div><span className="font-medium">Sup. Útil:</span> {unidad.sup_util}</div>
                      <div><span className="font-medium">Sup. Total:</span> {unidad.sup_total}</div>
                      <div><span className="font-medium">Precio UF:</span> {unidad.valor_lista}</div>
                      <div><span className="font-medium">Estado:</span> {unidad.estado_unidad}</div>
                    </div>
                  </div>
                  <div className="bg-white shadow rounded-lg p-4 mb-4 flex flex-col gap-2 text-base">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Descuento disponible:</span>
                      <span className="font-bold text-red-600">{(descuentoUnidadDisponible * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Comisión (UF)</span>
                      <span className="font-bold text-blue-700">{comisionUF !== null ? comisionUF.toFixed(2) : 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Dcto. Disponible con Comisión:</span>
                      <span className="font-bold text-green-600">{dctoDisponibleConComisionUF.toFixed(2)} UF</span>
                    </div>
                  </div>
                  <div className="bg-white shadow rounded-lg p-4 mb-4">
                    <h2 className="text-lg font-semibold mb-2">Totales y Recuperación</h2>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="font-medium">Total Precio Lista:</span> {totalPrecioLista.toFixed(2)}</div>
                      <div><span className="font-medium">Recuperación Total Mínima:</span> {recuperacionTotalMinima.toFixed(2)}</div>
                    </div>
                  </div>
                  {/* Tarjeta Política Comercial debajo de Totales y Recuperación */}
                  <div className="bg-white shadow rounded-lg p-4 mb-4">
                    <h2 className="text-lg font-semibold mb-2">Política Comercial</h2>
                    <div className="text-xs text-gray-700 whitespace-pre-line">
                      {observacionesPolitica ? observacionesPolitica : 'No hay observaciones para este proyecto.'}
                    </div>
                  </div>
                  {/* Tarjeta Edición Comisión */}
                  <div className="bg-white shadow rounded-lg p-4 mb-4">
                    <h2 className="text-lg font-semibold mb-2">Edición Comisión</h2>
                    <div className="flex flex-col gap-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <label className="font-medium mb-0">Precio Lista (Unidad Principal)</label>
                        <input
                          type="number"
                          min="0"
                          value={precioListaDepto}
                          onChange={e => {
                            const nuevo = Number(e.target.value);
                            setUnidad(u => u ? { ...u, valor_lista: nuevo } : u);
                          }}
                          className="border rounded px-2 py-1 w-24 text-right bg-blue-100 focus:bg-blue-200"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <label className="font-medium mb-0">Descuento Disponible (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={unidad?.descuento !== undefined ? (unidad.descuento * 100).toFixed(2) : '0.00'}
                          onChange={e => {
                            const nuevo = Number(e.target.value) / 100;
                            setUnidad(u => u ? { ...u, descuento: nuevo } : u);
                          }}
                          className="border rounded px-2 py-1 w-24 text-right bg-blue-100 focus:bg-blue-200"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <label className="font-medium mb-0">Comisión (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={commissionObj?.commission_rate !== undefined ? commissionObj.commission_rate.toFixed(2) : '0.00'}
                          onChange={e => {
                            const nuevo = Number(e.target.value);
                            setCommissions(cs => cs.map(c =>
                              c.broker_id === selectedBroker && c.project_name === unidad?.proyecto_nombre
                                ? { ...c, commission_rate: nuevo }
                                : c
                            ));
                          }}
                          className="border rounded px-2 py-1 w-24 text-right bg-blue-100 focus:bg-blue-200"
                        />
                      </div>
                      {secundariosSeleccionados.map((s, idx) => (
                        <div key={s.id} className="flex items-center justify-between gap-2">
                          <label className="font-medium mb-0">Precio Dcto Lista (Secundaria {s.unidad})</label>
                          <input
                            type="number"
                            min="0"
                            value={s.valor_lista ?? 0}
                            onChange={e => {
                              const nuevo = Number(e.target.value);
                              setSecundariosSeleccionados(arr => arr.map((sec, i) => i === idx ? { ...sec, valor_lista: nuevo } : sec));
                            }}
                            className="border rounded px-2 py-1 w-24 text-right bg-blue-100 focus:bg-blue-200"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Botón para guardar y generar PDF */}
                  <button
                    className="bg-blue-600 text-white px-4 py-2 rounded font-bold mt-4"
                    onClick={handleGuardarYGenerarPDF}
                    disabled={saving}
                  >
                    {saving ? 'Guardando...' : 'Guardar y Generar PDF'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default CalculoComisionBroker; 