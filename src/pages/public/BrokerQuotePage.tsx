// src/pages/public/BrokerQuotePage.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
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

// Interfaces
interface BrokerInfo {
    id: string;
    name: string;
    slug: string;
    // ... otras propiedades del broker
}

interface Unidad {
    id: string;
    unidad: string;
    proyecto_nombre: string;
    tipologia: string;
    valor_lista: number | null;
    descuento: number | null;
    // ... otras propiedades de la unidad
}

interface BrokerProjectCommission {
    id: string;
    broker_id: string;
    project_name: string;
    commission_rate: number | null;
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
    // ... (previous state declarations remain unchanged)

    // Efecto para la carga inicial de datos (validación de broker, UF, stock, comisiones)
    useEffect(() => {
        const initializePage = async () => {
            setIsValidating(true);
            setError(null);

            try {
                // 1. Validar Broker y Cargar Información del Broker
                const { data: brokerData, error: brokerError } = await supabase
                    .from('brokers')
                    .select('*')
                    .eq('slug', brokerSlug)
                    .single();

                if (brokerError || !brokerData) {
                    throw new Error('Broker no encontrado o token inválido.');
                }
                setBrokerInfo(brokerData as BrokerInfo);

                // 2. Cargar Valor de la UF
                const { data: ufData, error: ufError } = await supabase
                    .from('valores_financieros')
                    .select('valor')
                    .eq('nombre', 'UF')
                    .order('fecha', { ascending: false })
                    .limit(1)
                    .single();

                if (ufError) throw ufError;
                if (ufData) setUfValue(ufData.valor);
                else setError('Valor de UF no disponible.');

                // 3. Cargar Stock de Unidades - FIXED: Changed table name from 'unidades' to 'stock_unidades'
                setLoadingStock(true);
                const { data: stockData, error: stockError } = await supabase
                    .from('stock_unidades')
                    .select('*')
                    .eq('estado_unidad', 'Disponible');

                if (stockError) throw stockError;
                if (stockData) setStock(stockData as Unidad[]);
                setStockLoadDate(new Date().toISOString());

                // 4. Cargar Comisiones del Broker
                setLoadingCommissions(true);
                const { data: commissionsData, error: commissionsError } = await supabase
                    .from('broker_project_commissions')
                    .select('*')
                    .eq('broker_id', brokerData.id);

                if (commissionsError) throw commissionsError;
                if (commissionsData) setBrokerCommissions(commissionsData as BrokerProjectCommission[]);

            } catch (e: any) {
                console.error('Error de inicialización:', e);
                setError(e.message || 'Error al cargar datos iniciales.');
            } finally {
                setIsValidating(false);
                setLoadingUf(false);
                setLoadingStock(false);
                setLoadingCommissions(false);
            }
        };

        if (brokerSlug && accessToken) {
            initializePage();
        } else {
            setError('Faltan parámetros de acceso (slug o token).');
            setIsValidating(false);
            setLoadingUf(false);
            setLoadingStock(false);
            setLoadingCommissions(false);
        }
    }, [brokerSlug, accessToken, navigate]);

    // ... (rest of the component code remains unchanged)
};

export default BrokerQuotePage;