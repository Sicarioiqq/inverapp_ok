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

// Interfaces (igual que en tu versión original)
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

  // --- Estados originales ---
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

  // --- Corrección: define totalEscritura antes de usarlo en efectos o JSX ---
  const totalEscritura = useMemo(() => {
    if (!selectedUnidad) return 0;

    // Precio del departamento con descuento
    const valorLista = selectedUnidad.valor_lista ?? 0;
    const descuentoFinal = discountAmount / 100;
    const precioDeptoConDto = valorLista * (1 - descuentoFinal);

    // Suma de unidades secundarias
    const precioSecundarios = addedSecondaryUnits
      .reduce((suma, u) => suma + (u.valor_lista ?? 0), 0);

    return precioDeptoConDto + precioSecundarios;
  }, [selectedUnidad, discountAmount, addedSecondaryUnits]);

  // Efecto para recálculos o fetches que dependen de totalEscritura
  useEffect(() => {
    // Aquí va tu lógica original que usa totalEscritura
    // p.ej. actualizar total disponible de bono, llamadas a supabase, etc.

  }, [ufValue, selectedUnidad, quotationType, totalEscritura, initialTotalAvailableBono, projectCommercialPolicy]);

  // ... Resto de funciones (fetchData, handlers de pestañas, agregar unidades secundarias, etc.)

  return (
    <LayoutDashboard>
      {/* Navegación y header */}
      <div className="px-6 py-4">
        <h1 className="text-2xl font-semibold">Cotización para Broker</h1>
        {/* <!-- Controles de pestañas y selección de unidad --> */}
      </div>

      {/* Ejemplo de dónde mostrar totalEscritura */}
      <div className="px-6 py-4">
        <span className="font-medium">Total Escritura:</span>{' '}
        <span className="text-lg">{totalEscritura.toLocaleString()}</span>
      </div>

      {/* Botón de descarga de PDF */}
      <div className="px-6 py-4">
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
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded"
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
      </div>

      {/* ... resto del JSX original: listas, tablas, formularios, etc. */}
    </LayoutDashboard>
  );
};

export default BrokerQuotePage;
