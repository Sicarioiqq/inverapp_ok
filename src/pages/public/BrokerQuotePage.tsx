import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, formatDateChile, formatDateTimeChile, formatCurrency } from '../../lib/supabase';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF';
import {
  LayoutDashboard,
  Home,
  SlidersHorizontal,
  Loader2,
  ShieldX,
  ArrowUp,
  ArrowDown,
  PlusCircle,
  Trash2,
  DollarSign,
  Wallet,
  Download,
  Calendar,
  Tag
} from 'lucide-react';

// Interfaces para tipos de datos
interface BrokerInfo {
  id: string;
  name: string | null;
}

interface Unidad {
  id: string;
  proyecto_nombre: string;
  unidad: string;
  tipologia: string;
  piso: string | null;
  sup_util: number | null;
  sup_terraza?: number | null;
  sup_total?: number | null;
  valor_lista: number | null;
  descuento: number | null;
  estado_unidad: string | null;
  tipo_bien: string;
}

type Tab = 'principales' | 'secundarios' | 'configuracion';

const BrokerQuotePage: React.FC = () => {
  const { brokerSlug, accessToken } = useParams<{ brokerSlug: string; accessToken: string }>();
  const navigate = useNavigate();

  // Estados principales
  const [brokerInfo, setBrokerInfo] = useState<BrokerInfo | null>(null);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [selectedTab, setSelectedTab] = useState<Tab>('principales');
  const [selectedUnidad, setSelectedUnidad] = useState<Unidad | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [addedSecondaryUnits, setAddedSecondaryUnits] = useState<Unidad[]>([]);
  const [ufValue, setUfValue] = useState<number>(0);
  const [quotationType, setQuotationType] = useState<'valorLista' | 'valorUf'>('valorLista');
  const [initialTotalAvailableBono, setInitialTotalAvailableBono] = useState<number>(0);
  const [projectCommercialPolicy, setProjectCommercialPolicy] = useState<any>(null);

  // --- Calcular totalEscritura antes de cualquier uso ---
  const totalEscritura = useMemo(() => {
    if (!selectedUnidad) return 0;
    const valorLista = selectedUnidad.valor_lista ?? 0;
    const descuentoFinal = discountAmount / 100;
    const precioDeptoConDto = valorLista * (1 - descuentoFinal);
    const precioSecundarios = addedSecondaryUnits.reduce(
      (suma, u) => suma + (u.valor_lista ?? 0),
      0
    );
    return precioDeptoConDto + precioSecundarios;
  }, [selectedUnidad, discountAmount, addedSecondaryUnits]);

  // useEffect para lógica dependiente de totalEscritura, ufValue, etc.
  useEffect(() => {
    // Aquí va tu lógica original que utiliza totalEscritura y demás estados
  }, [ufValue, selectedUnidad, quotationType, totalEscritura, initialTotalAvailableBono, projectCommercialPolicy]);

  // Resto de funciones: fetchData, handlers para pestañas, agregar/quitar unidades secundarias, etc.

  return (
    <LayoutDashboard>
      {/* Cabecera e inputs de selección */}
      <div className="px-6 py-4">
        <h1 className="text-2xl font-semibold">Cotización para Broker</h1>
      </div>

      {/* Ejemplo de visualización de totalEscritura */}
      <div className="px-6 py-4">
        <span className="font-medium">Total Escritura:</span>{' '}
        <span className="text-lg">{totalEscritura.toLocaleString()}</span>
      </div>

      {/* Descargar PDF: solo si tenemos brokerInfo y una unidad seleccionada */}
      <div className="px-6 py-4">
        {brokerInfo && selectedUnidad ? (
          <PDFDownloadLink
            document={
              <BrokerQuotePDF
                brokerInfo={brokerInfo}
                unidad={selectedUnidad}
                secondaryUnits={addedSecondaryUnits}
                discountPct={discountAmount}
                totalEscritura={totalEscritura}
                ufValue={ufValue}
                quotationType={quotationType}
              />
            }
            fileName={`cotizacion_broker_${brokerSlug}.pdf`}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
          >
            {({ loading }) =>
              loading ? (
                <Loader2 className="animate-spin mr-2" />
              ) : (
                <Download className="mr-2" />
              )
            }
            Descargar PDF
          </PDFDownloadLink>
        ) : (
          <div className="text-gray-500">
            Selecciona un broker y una unidad para habilitar la descarga de PDF.
          </div>
        )}
      </div>

      {/* Resto del JSX: tablas, formularios, listados, etc. */}
    </LayoutDashboard>
  );
};

export default BrokerQuotePage;
