import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useUFStore } from '../../stores/ufStore';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF';
import { Loader2, Calculator, Download, Check, Plus, Minus, Home } from 'lucide-react';

interface StockUnit {
  id: string;
  proyecto_nombre: string;
  unidad: string;
  tipologia: string;
  piso: string;
  orientacion: string;
  sup_util: number;
  sup_terraza: number;
  sup_total: number;
  valor_lista: number;
  tipo_bien: string;
}

interface Broker {
  id: string;
  name: string;
  business_name: string;
  slug: string;
  public_access_token: string;
}

interface ProjectPolicy {
  project_name: string;
  monto_reserva_pesos: number;
  bono_pie_max_pct: number;
  fecha_tope: string | null;
}

const BrokerQuotePage: React.FC = () => {
  const { brokerSlug, accessToken } = useParams<{ brokerSlug: string; accessToken: string }>();
  const { ufValue, fetchUFValue } = useUFStore();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [broker, setBroker] = useState<Broker | null>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [units, setUnits] = useState<StockUnit[]>([]);
  const [filteredUnits, setFilteredUnits] = useState<StockUnit[]>([]);
  const [selectedUnidad, setSelectedUnidad] = useState<StockUnit | null>(null);
  const [addedSecondaryUnits, setAddedSecondaryUnits] = useState<StockUnit[]>([]);
  const [projectPolicy, setProjectPolicy] = useState<ProjectPolicy | null>(null);
  
  // Form state
  const [cliente, setCliente] = useState('');
  const [rut, setRut] = useState('');
  const [quotationType, setQuotationType] = useState<'descuento' | 'bono' | 'mix'>('descuento');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [bonoAmount, setBonoAmount] = useState(0);
  const [pagoReserva, setPagoReserva] = useState(0);
  const [pagoPromesa, setPagoPromesa] = useState(0);
  const [pagoPromesaPct, setPagoPromesaPct] = useState(0);
  const [pagoPie, setPagoPie] = useState(0);
  const [pagoPiePct, setPagoPiePct] = useState(0);
  const [pagoBonoPieCotizacion, setPagoBonoPieCotizacion] = useState(0);
  
  // Calculated values
  const [precioBaseDepartamento, setPrecioBaseDepartamento] = useState(0);
  const [precioDescuentoDepartamento, setPrecioDescuentoDepartamento] = useState(0);
  const [precioDepartamentoConDescuento, setPrecioDepartamentoConDescuento] = useState(0);
  const [precioTotalSecundarios, setPrecioTotalSecundarios] = useState(0);
  const [totalEscritura, setTotalEscritura] = useState(0);
  const [pagoCreditoHipotecarioCalculado, setPagoCreditoHipotecarioCalculado] = useState(0);
  const [totalFormaDePago, setTotalFormaDePago] = useState(0);
  
  // PDF generation state
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [quotationData, setQuotationData] = useState<any | null>(null);
  
  // Validation state
  const [isValid, setIsValid] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  
  // Tipologías disponibles para el proyecto seleccionado
  const [tipologias, setTipologias] = useState<string[]>([]);
  const [selectedTipologia, setSelectedTipologia] = useState<string>('');

  useEffect(() => {
    if (!ufValue) {
      fetchUFValue();
    }
    
    if (brokerSlug && accessToken) {
      validateBrokerAccess();
    }
  }, [brokerSlug, accessToken]);

  useEffect(() => {
    if (broker) {
      fetchProjects();
    }
  }, [broker]);

  useEffect(() => {
    if (selectedProject) {
      fetchUnits();
      fetchProjectPolicy();
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject && units.length > 0) {
      // Extract unique tipologias for the selected project
      const uniqueTipologias = Array.from(
        new Set(
          units
            .filter(unit => unit.proyecto_nombre === selectedProject && unit.tipo_bien === 'DEPARTAMENTO')
            .map(unit => unit.tipologia)
        )
      );
      setTipologias(uniqueTipologias);
      
      // Filter units based on selected project and tipologia
      filterUnits();
    }
  }, [selectedProject, selectedTipologia, units]);

  useEffect(() => {
    calculatePrices();
  }, [
    selectedUnidad, 
    addedSecondaryUnits, 
    quotationType, 
    discountAmount, 
    bonoAmount,
    pagoReserva,
    pagoPromesaPct,
    pagoPiePct,
    pagoBonoPieCotizacion
  ]);

  useEffect(() => {
    validateForm();
  }, [
    cliente, 
    rut, 
    selectedUnidad, 
    pagoReserva, 
    pagoPromesa, 
    pagoPie, 
    pagoCreditoHipotecarioCalculado,
    totalFormaDePago,
    totalEscritura
  ]);

  const validateBrokerAccess = async () => {
    try {
      setLoading(true);
      
      // Fetch broker by slug and access token
      const { data, error } = await supabase
        .from('brokers')
        .select('id, name, business_name, slug, public_access_token')
        .eq('slug', brokerSlug)
        .eq('public_access_token', accessToken)
        .single();
      
      if (error) {
        throw new Error('Acceso denegado: token inválido');
      }
      
      setBroker(data);
    } catch (err: any) {
      console.error('Error validating broker access:', err);
      setError(err.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      
      // Get unique project names from stock_unidades
      const { data, error } = await supabase
        .from('stock_unidades')
        .select('proyecto_nombre')
        .eq('estado_unidad', 'Disponible')
        .order('proyecto_nombre');
      
      if (error) throw error;
      
      // Extract unique project names
      const uniqueProjects = Array.from(
        new Set(data.map(item => item.proyecto_nombre))
      );
      
      setProjects(uniqueProjects);
      
      // Set first project as selected by default
      if (uniqueProjects.length > 0) {
        setSelectedProject(uniqueProjects[0]);
      }
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnits = async () => {
    try {
      setLoading(true);
      
      // Fetch all units for the selected project
      const { data, error } = await supabase
        .from('stock_unidades')
        .select('*')
        .eq('proyecto_nombre', selectedProject)
        .eq('estado_unidad', 'Disponible')
        .order('unidad');
      
      if (error) throw error;
      
      setUnits(data);
    } catch (err: any) {
      console.error('Error fetching units:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectPolicy = async () => {
    try {
      // Fetch commercial policy for the selected project
      const { data, error } = await supabase
        .from('project_commercial_policies')
        .select('*')
        .eq('project_name', selectedProject)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        // Convert bono_pie_max_pct from decimal to percentage (e.g., 0.15 to 15)
        const policy = {
          ...data,
          bono_pie_max_pct: data.bono_pie_max_pct * 100
        };
        setProjectPolicy(policy);
        
        // Set default values based on policy
        if (policy.monto_reserva_pesos && ufValue) {
          const reservaUF = policy.monto_reserva_pesos / ufValue;
          setPagoReserva(parseFloat(reservaUF.toFixed(2)));
        }
      } else {
        setProjectPolicy(null);
      }
    } catch (err: any) {
      console.error('Error fetching project policy:', err);
      // Don't set error state here to avoid blocking the UI
    }
  };

  const filterUnits = () => {
    if (!selectedProject) {
      setFilteredUnits([]);
      return;
    }
    
    let filtered = units.filter(unit => 
      unit.proyecto_nombre === selectedProject && 
      unit.tipo_bien === 'DEPARTAMENTO'
    );
    
    if (selectedTipologia) {
      filtered = filtered.filter(unit => unit.tipologia === selectedTipologia);
    }
    
    setFilteredUnits(filtered);
  };

  const handleSelectUnit = (unit: StockUnit) => {
    setSelectedUnidad(unit);
    
    // Reset secondary units when main unit changes
    setAddedSecondaryUnits([]);
    
    // Reset form values
    setDiscountAmount(0);
    setBonoAmount(0);
    setPagoPromesaPct(10);
    setPagoPiePct(10);
    setPagoBonoPieCotizacion(0);
    
    // Set default values based on project policy
    if (projectPolicy && ufValue) {
      const reservaUF = projectPolicy.monto_reserva_pesos / ufValue;
      setPagoReserva(parseFloat(reservaUF.toFixed(2)));
    }
  };

  const handleAddSecondaryUnit = (unit: StockUnit) => {
    if (!addedSecondaryUnits.some(u => u.id === unit.id)) {
      setAddedSecondaryUnits([...addedSecondaryUnits, unit]);
    }
  };

  const handleRemoveSecondaryUnit = (unitId: string) => {
    setAddedSecondaryUnits(addedSecondaryUnits.filter(unit => unit.id !== unitId));
  };

  const calculatePrices = () => {
    if (!selectedUnidad) {
      resetCalculatedValues();
      return;
    }
    
    // Base price of the department
    const baseDeptPrice = selectedUnidad.valor_lista || 0;
    setPrecioBaseDepartamento(baseDeptPrice);
    
    // Calculate discount based on quotation type
    let discountUF = 0;
    if (quotationType === 'descuento' || quotationType === 'mix') {
      discountUF = (baseDeptPrice * discountAmount) / 100;
    }
    setPrecioDescuentoDepartamento(discountUF);
    
    // Calculate department price after discount
    const deptPriceAfterDiscount = baseDeptPrice - discountUF;
    setPrecioDepartamentoConDescuento(deptPriceAfterDiscount);
    
    // Calculate total price of secondary units
    const secondaryUnitsTotal = addedSecondaryUnits.reduce(
      (sum, unit) => sum + (unit.valor_lista || 0), 
      0
    );
    setPrecioTotalSecundarios(secondaryUnitsTotal);
    
    // Calculate total deed price
    const totalDeedPrice = deptPriceAfterDiscount + secondaryUnitsTotal;
    setTotalEscritura(totalDeedPrice);
    
    // Calculate payments based on percentages
    const promesaAmount = (totalDeedPrice * pagoPromesaPct) / 100;
    setPagoPromesa(parseFloat(promesaAmount.toFixed(2)));
    
    const pieAmount = (totalDeedPrice * pagoPiePct) / 100;
    setPagoPie(parseFloat(pieAmount.toFixed(2)));
    
    // Calculate mortgage credit
    const creditoHipotecario = totalDeedPrice - pagoReserva - promesaAmount - pieAmount - pagoBonoPieCotizacion;
    setPagoCreditoHipotecarioCalculado(parseFloat(creditoHipotecario.toFixed(2)));
    
    // Calculate total payment form
    const totalPaymentForm = pagoReserva + promesaAmount + pieAmount + creditoHipotecario + pagoBonoPieCotizacion;
    setTotalFormaDePago(parseFloat(totalPaymentForm.toFixed(2)));
  };

  const resetCalculatedValues = () => {
    setPrecioBaseDepartamento(0);
    setPrecioDescuentoDepartamento(0);
    setPrecioDepartamentoConDescuento(0);
    setPrecioTotalSecundarios(0);
    setTotalEscritura(0);
    setPagoCreditoHipotecarioCalculado(0);
    setTotalFormaDePago(0);
  };

  const validateForm = () => {
    if (!cliente || !rut || !selectedUnidad) {
      setIsValid(false);
      setValidationMessage('Por favor complete los campos obligatorios');
      return;
    }
    
    if (Math.abs(totalFormaDePago - totalEscritura) > 0.1) {
      setIsValid(false);
      setValidationMessage('La forma de pago no coincide con el total de escrituración');
      return;
    }
    
    if (pagoCreditoHipotecarioCalculado < 0) {
      setIsValid(false);
      setValidationMessage('El crédito hipotecario no puede ser negativo');
      return;
    }
    
    setIsValid(true);
    setValidationMessage('');
  };

  const handleGeneratePDF = () => {
    setIsGeneratingPDF(true);
    
    // Prepare data for PDF
    const data = {
      cliente,
      rut,
      ufValue,
      selectedUnidad,
      addedSecondaryUnits,
      quotationType,
      discountAmount,
      bonoAmount,
      pagoReserva,
      pagoPromesa,
      pagoPromesaPct,
      pagoPie,
      pagoPiePct,
      pagoBonoPieCotizacion,
      precioBaseDepartamento,
      precioDescuentoDepartamento,
      precioDepartamentoConDescuento,
      precioTotalSecundarios,
      totalEscritura,
      pagoCreditoHipotecarioCalculado,
      totalFormaDePago
    };
    
    setQuotationData(data);
    
    // Save quotation to database
    saveQuotation(data);
  };

  const saveQuotation = async (data: any) => {
    try {
      // Create quotation record
      const { error } = await supabase
        .from('quotations')
        .insert([
          {
            broker_id: broker?.id,
            client_name: data.cliente,
            client_rut: data.rut,
            uf_value: data.ufValue,
            selected_unit: data.selectedUnidad,
            added_secondary_units: data.addedSecondaryUnits,
            quotation_type: data.quotationType,
            discount_amount: data.discountAmount,
            bono_amount: data.bonoAmount,
            payment_reserve: data.pagoReserva,
            payment_promise: data.pagoPromesa,
            payment_promise_pct: data.pagoPromesaPct,
            payment_downpayment: data.pagoPie,
            payment_downpayment_pct: data.pagoPiePct,
            payment_bono_downpayment: data.pagoBonoPieCotizacion,
            base_department_price: data.precioBaseDepartamento,
            discount_department_price: data.precioDescuentoDepartamento,
            net_department_price: data.precioDepartamentoConDescuento,
            total_secondary_units_price: data.precioTotalSecundarios,
            total_deed_price: data.totalEscritura,
            calculated_mortgage_credit: data.pagoCreditoHipotecarioCalculado,
            total_payment_form: data.totalFormaDePago
          }
        ]);
      
      if (error) {
        console.error('Error saving quotation:', error);
      }
    } catch (err) {
      console.error('Error in saveQuotation:', err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatCLP = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full flex flex-col items-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
          <h1 className="text-xl font-semibold text-gray-800">Cargando...</h1>
          <p className="text-gray-500 mt-2">Estamos preparando el cotizador</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-800">Error</h1>
            <p className="text-gray-500 mt-2">Error de validación:</p>
            <p className="text-red-600 font-medium mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!broker) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-800">Acceso Denegado</h1>
            <p className="text-gray-500 mt-2">No se pudo verificar el acceso al cotizador.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/logoinversiones.png" alt="Logo" className="h-12" />
            <div className="ml-4">
              <h1 className="text-xl font-semibold text-gray-900">Cotizador {broker.name}</h1>
              <p className="text-sm text-gray-500">{broker.business_name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Valor UF:</p>
            <p className="text-lg font-semibold text-gray-900">
              {ufValue ? formatCLP(ufValue) : 'Cargando...'}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Client Info & Unit Selection */}
          <div className="lg:col-span-1 space-y-6">
            {/* Client Information */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Información del Cliente</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="cliente" className="block text-sm font-medium text-gray-700">Nombre Completo *</label>
                  <input
                    type="text"
                    id="cliente"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="rut" className="block text-sm font-medium text-gray-700">RUT *</label>
                  <input
                    type="text"
                    id="rut"
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Project & Unit Selection */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Selección de Unidad</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="project" className="block text-sm font-medium text-gray-700">Proyecto *</label>
                  <select
                    id="project"
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seleccione un proyecto</option>
                    {projects.map(project => (
                      <option key={project} value={project}>{project}</option>
                    ))}
                  </select>
                </div>

                {selectedProject && (
                  <div>
                    <label htmlFor="tipologia" className="block text-sm font-medium text-gray-700">Tipología</label>
                    <select
                      id="tipologia"
                      value={selectedTipologia}
                      onChange={(e) => setSelectedTipologia(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Todas las tipologías</option>
                      {tipologias.map(tipologia => (
                        <option key={tipologia} value={tipologia}>{tipologia}</option>
                      ))}
                    </select>
                  </div>
                )}

                {filteredUnits.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Departamentos Disponibles *</label>
                    <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipología</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio UF</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredUnits.map(unit => (
                            <tr 
                              key={unit.id} 
                              className={`hover:bg-gray-50 ${selectedUnidad?.id === unit.id ? 'bg-blue-50' : ''}`}
                            >
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{unit.unidad}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{unit.tipologia}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(unit.valor_lista)}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                                <button
                                  onClick={() => handleSelectUnit(unit)}
                                  className={`inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded ${
                                    selectedUnidad?.id === unit.id
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  }`}
                                >
                                  Seleccionar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedUnidad && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-md">
                    <h3 className="text-sm font-medium text-blue-800 mb-2">Unidad Seleccionada</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Unidad:</span>
                        <span className="ml-1 font-medium">{selectedUnidad.unidad}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Tipología:</span>
                        <span className="ml-1 font-medium">{selectedUnidad.tipologia}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Piso:</span>
                        <span className="ml-1 font-medium">{selectedUnidad.piso}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Orientación:</span>
                        <span className="ml-1 font-medium">{selectedUnidad.orientacion || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Sup. Útil:</span>
                        <span className="ml-1 font-medium">{formatCurrency(selectedUnidad.sup_util)} m²</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Sup. Total:</span>
                        <span className="ml-1 font-medium">{formatCurrency(selectedUnidad.sup_total)} m²</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Precio:</span>
                        <span className="ml-1 font-medium">{formatCurrency(selectedUnidad.valor_lista)} UF</span>
                        {ufValue && (
                          <span className="ml-1 text-gray-500">
                            ({formatCLP(selectedUnidad.valor_lista * ufValue)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Secondary Units */}
            {selectedUnidad && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Unidades Secundarias</h2>
                
                {/* Available secondary units */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Disponibles</h3>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio UF</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {units
                          .filter(unit => 
                            unit.proyecto_nombre === selectedProject && 
                            unit.tipo_bien !== 'DEPARTAMENTO' &&
                            !addedSecondaryUnits.some(added => added.id === unit.id)
                          )
                          .map(unit => (
                            <tr key={unit.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{unit.tipo_bien}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{unit.unidad}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(unit.valor_lista)}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                                <button
                                  onClick={() => handleAddSecondaryUnit(unit)}
                                  className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded bg-green-100 text-green-700 hover:bg-green-200"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Agregar
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Added secondary units */}
                {addedSecondaryUnits.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Agregadas</h3>
                    <div className="border border-gray-300 rounded-md">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio UF</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {addedSecondaryUnits.map(unit => (
                            <tr key={unit.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{unit.tipo_bien}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{unit.unidad}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(unit.valor_lista)}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                                <button
                                  onClick={() => handleRemoveSecondaryUnit(unit.id)}
                                  className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200"
                                >
                                  <Minus className="h-3 w-3 mr-1" />
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Pricing & Payment */}
          <div className="lg:col-span-2 space-y-6">
            {selectedUnidad ? (
              <>
                {/* Pricing Options */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Opciones de Precio</h2>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Cotización</label>
                    <div className="flex space-x-4">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="descuento"
                          checked={quotationType === 'descuento'}
                          onChange={() => setQuotationType('descuento')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">Descuento</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="bono"
                          checked={quotationType === 'bono'}
                          onChange={() => setQuotationType('bono')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">Bono</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="mix"
                          checked={quotationType === 'mix'}
                          onChange={() => setQuotationType('mix')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">Mixto</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(quotationType === 'descuento' || quotationType === 'mix') && (
                      <div>
                        <label htmlFor="discountAmount" className="block text-sm font-medium text-gray-700">Descuento (%)</label>
                        <input
                          type="number"
                          id="discountAmount"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                          min="0"
                          max="100"
                          step="0.01"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    )}
                    
                    {(quotationType === 'bono' || quotationType === 'mix') && (
                      <div>
                        <label htmlFor="bonoAmount" className="block text-sm font-medium text-gray-700">Bono Pie (UF)</label>
                        <input
                          type="number"
                          id="bonoAmount"
                          value={bonoAmount}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setBonoAmount(value);
                            setPagoBonoPieCotizacion(value);
                          }}
                          min="0"
                          step="0.01"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Price Summary */}
                  <div className="mt-6 border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Resumen de Precios</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Precio Base Departamento:</span>
                        <span className="text-sm font-medium">{formatCurrency(precioBaseDepartamento)} UF</span>
                      </div>
                      
                      {(quotationType === 'descuento' || quotationType === 'mix') && precioDescuentoDepartamento > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Descuento ({discountAmount}%):</span>
                          <span className="text-sm font-medium text-red-600">-{formatCurrency(precioDescuentoDepartamento)} UF</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Precio Departamento con Descuento:</span>
                        <span className="text-sm font-medium">{formatCurrency(precioDepartamentoConDescuento)} UF</span>
                      </div>
                      
                      {addedSecondaryUnits.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Precio Unidades Secundarias:</span>
                          <span className="text-sm font-medium">{formatCurrency(precioTotalSecundarios)} UF</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="text-sm font-medium text-gray-700">Precio Total Escrituración:</span>
                        <span className="text-sm font-semibold">{formatCurrency(totalEscritura)} UF</span>
                      </div>
                      
                      {ufValue && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Equivalente en pesos:</span>
                          <span className="text-sm text-gray-500">{formatCLP(totalEscritura * ufValue)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment Form */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Forma de Pago</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="pagoReserva" className="block text-sm font-medium text-gray-700">Reserva (UF)</label>
                      <input
                        type="number"
                        id="pagoReserva"
                        value={pagoReserva}
                        onChange={(e) => setPagoReserva(parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      {ufValue && (
                        <p className="mt-1 text-xs text-gray-500">
                          Equivalente: {formatCLP(pagoReserva * ufValue)}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <label htmlFor="pagoPromesaPct" className="block text-sm font-medium text-gray-700">Promesa (%)</label>
                      <input
                        type="number"
                        id="pagoPromesaPct"
                        value={pagoPromesaPct}
                        onChange={(e) => setPagoPromesaPct(parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        step="0.01"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {formatCurrency(pagoPromesa)} UF
                        {ufValue && ` (${formatCLP(pagoPromesa * ufValue)})`}
                      </p>
                    </div>
                    
                    <div>
                      <label htmlFor="pagoPiePct" className="block text-sm font-medium text-gray-700">Pie (%)</label>
                      <input
                        type="number"
                        id="pagoPiePct"
                        value={pagoPiePct}
                        onChange={(e) => setPagoPiePct(parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        step="0.01"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {formatCurrency(pagoPie)} UF
                        {ufValue && ` (${formatCLP(pagoPie * ufValue)})`}
                      </p>
                    </div>
                    
                    {(quotationType === 'bono' || quotationType === 'mix') && (
                      <div>
                        <label htmlFor="pagoBonoPieCotizacion" className="block text-sm font-medium text-gray-700">Bono Pie (UF)</label>
                        <input
                          type="number"
                          id="pagoBonoPieCotizacion"
                          value={pagoBonoPieCotizacion}
                          onChange={(e) => setPagoBonoPieCotizacion(parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                        {ufValue && (
                          <p className="mt-1 text-xs text-gray-500">
                            Equivalente: {formatCLP(pagoBonoPieCotizacion * ufValue)}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="md:col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="block text-sm font-medium text-gray-700">Crédito Hipotecario (UF)</label>
                        <span className="text-xs text-gray-500">Calculado automáticamente</span>
                      </div>
                      <div className="mt-1 p-2 bg-gray-50 rounded-md border border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{formatCurrency(pagoCreditoHipotecarioCalculado)} UF</span>
                          {ufValue && (
                            <span className="text-xs text-gray-500">
                              {formatCLP(pagoCreditoHipotecarioCalculado * ufValue)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Payment Summary */}
                  <div className="mt-6 border-t border-gray-200 pt-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium text-gray-700">Total Forma de Pago:</h3>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-gray-900">{formatCurrency(totalFormaDePago)} UF</p>
                        {ufValue && (
                          <p className="text-xs text-gray-500">{formatCLP(totalFormaDePago * ufValue)}</p>
                        )}
                      </div>
                    </div>
                    
                    {Math.abs(totalFormaDePago - totalEscritura) > 0.1 && (
                      <div className="mt-2 p-2 bg-red-50 rounded-md border border-red-200 text-sm text-red-600">
                        La forma de pago no coincide con el total de escrituración.
                        Diferencia: {formatCurrency(Math.abs(totalFormaDePago - totalEscritura))} UF
                      </div>
                    )}
                  </div>
                </div>

                {/* Generate PDF Button */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex flex-col items-center justify-center">
                    {!isValid && validationMessage && (
                      <div className="mb-4 p-3 bg-yellow-50 rounded-md border border-yellow-200 text-sm text-yellow-700 w-full">
                        {validationMessage}
                      </div>
                    )}
                    
                    {quotationData ? (
                      <div className="w-full">
                        <div className="flex items-center justify-center mb-4 p-3 bg-green-50 rounded-md border border-green-200">
                          <Check className="h-5 w-5 text-green-600 mr-2" />
                          <span className="text-sm text-green-700">Cotización generada correctamente</span>
                        </div>
                        
                        <PDFDownloadLink
                          document={<BrokerQuotePDF {...quotationData} />}
                          fileName={`Cotizacion_${selectedUnidad.proyecto_nombre}_${selectedUnidad.unidad}.pdf`}
                          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          {({ blob, url, loading, error }) => (
                            loading ? 
                              <span className="flex items-center">
                                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                                Generando PDF...
                              </span> : 
                              <span className="flex items-center">
                                <Download className="h-5 w-5 mr-2" />
                                Descargar PDF
                              </span>
                          )}
                        </PDFDownloadLink>
                      </div>
                    ) : (
                      <button
                        onClick={handleGeneratePDF}
                        disabled={!isValid || isGeneratingPDF}
                        className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGeneratingPDF ? (
                          <>
                            <Loader2 className="animate-spin h-5 w-5 mr-2" />
                            Generando...
                          </>
                        ) : (
                          <>
                            <Calculator className="h-5 w-5 mr-2" />
                            Generar Cotización
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <Home className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-medium text-gray-900 mb-2">Seleccione una Unidad</h2>
                  <p className="text-gray-500 max-w-md">
                    Para comenzar, seleccione un proyecto y una unidad disponible en el panel izquierdo.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-gray-50 border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Cotizador {broker.name}. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default BrokerQuotePage;