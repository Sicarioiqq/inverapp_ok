import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF';
import { fetchLatestUFValue } from '../../lib/ufUtils';

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

interface BrokerInfo {
  id: string;
  name: string;
  business_name: string;
  public_access_token: string;
}

interface Unidad {
  id: string;
  proyecto_nombre: string;
  unidad: string;
  tipo_bien: string;
  tipologia: string;
  piso: string;
  orientacion: string;
  sup_util: number;
  sup_terraza: number;
  sup_total: number;
  valor_lista: number;
  descuento: number;
  estado_unidad: string;
  etapa: string;
}

interface BrokerProjectCommission {
  id: string;
  broker_id: string;
  project_name: string;
  commission_rate: number;
}

interface ProjectCommercialPolicy {
    id: string;
    project_name: string;
    monto_reserva_pesos: number | null;
    bono_pie_max_pct: number | null;
    fecha_tope: string | null;
    observaciones: string | null;
    comuna: string | null;
}

type Tab = 'principales' | 'secundarios' | 'configuracion';
type QuotationType = 'descuento' | 'bono' | 'mix';

const BrokerQuotePage: React.FC = () => {
    const { brokerSlug, accessToken } = useParams<{ brokerSlug: string; accessToken: string }>();
    const navigate = useNavigate();

    const [brokerInfo, setBrokerInfo] = useState<BrokerInfo | null>(null);
    const [isValidating, setIsValidating] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('principales');

    const [stock, setStock] = useState<Unidad[]>([]);
    const [loadingStock, setLoadingStock] = useState(false);
    const [stockLoadDate, setStockLoadDate] = useState<string | null>(null);

    const [brokerCommissions, setBrokerCommissions] = useState<BrokerProjectCommission[]>([]);
    const [loadingCommissions, setLoadingCommissions] = useState(false);

    const [projectCommercialPolicy, setProjectCommercialPolicy] = useState<ProjectCommercialPolicy | null>(null);
    const [loadingCommercialPolicy, setLoadingCommercialPolicy] = useState(false);

    const [ufValue, setUfValue] = useState<number | null>(null);
    const [loadingUf, setLoadingUf] = useState(true);

    const [sortField, setSortField] = useState<keyof Unidad>('unidad');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(true);
    const [filterProyecto, setFilterProyecto] = useState<string>('Todos');
    const [filterTipologia, setFilterTipologia] = useState<string>('Todos');

    const [selectedUnidad, setSelectedUnidad] = useState<Unidad | null>(null);
    const [cliente, setCliente] = useState('');
    const [rut, setRut] = useState('');

    const [quotationType, setQuotationType] = useState<QuotationType>('descuento');
    const [discountAmount, setDiscountAmount] = useState<number>(0);
    const [bonoAmount, setBonoAmount] = useState<number>(0);
    const [bonoAmountPct, setBonoAmountPct] = useState<number>(0);
    const [tempBonoAmountPctInput, setTempBonoAmountPctInput] = useState<string>('');

    const [initialTotalAvailableBono, setInitialTotalAvailableBono] = useState<number>(0);

    const [projectSecondaryUnits, setProjectSecondaryUnits] = useState<Unidad[]>([]);
    const [selectedSecondaryUnitToAdd, setSelectedSecondaryUnitToAdd] = useState<string>('');
    const [addedSecondaryUnits, setAddedSecondaryUnits] = useState<Unidad[]>([]);

    const [pagoReserva, setPagoReserva] = useState<number>(0);
    const [pagoPromesa, setPagoPromesa] = useState<number>(0);
    const [pagoPromesaPct, setPagoPromesaPct] = useState<number>(0);
    const [pagoPie, setPagoPie] = useState<number>(0);
    const [pagoPiePct, setPagoPiePct] = useState<number>(0);
    const [pagoBonoPieCotizacion, setPagoBonoPieCotizacion] = useState<number>(0);

    const precioBaseDepartamento = selectedUnidad?.valor_lista || 0;
    const precioDescuentoDepartamento = precioBaseDepartamento * (discountAmount / 100);
    const precioDepartamentoConDescuento = precioBaseDepartamento - precioDescuentoDepartamento;
    const precioTotalSecundarios = addedSecondaryUnits.reduce((sum, unit) => sum + (unit.valor_lista || 0), 0);
    const totalEscritura = precioDepartamentoConDescuento + precioTotalSecundarios;
    const pagoCreditoHipotecarioCalculado = totalEscritura - pagoReserva - pagoPromesa - pagoPie - pagoBonoPieCotizacion;
    const totalFormaDePago = pagoReserva + pagoPromesa + pagoPie + pagoCreditoHipotecarioCalculado + pagoBonoPieCotizacion;

    // [Previous implementation continues unchanged...]

    return (
        // [Previous JSX implementation remains unchanged...]
    );
};

export default BrokerQuotePage;