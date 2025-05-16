import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, formatDateChile, formatDateTimeChile, formatCurrency } from '../../lib/supabase';
import { usePopup } from '../../contexts/PopupContext';
import Layout from '../../components/Layout';
import { PDFDownloadLink } from '@react-pdf/renderer';
import LiquidacionPagoBrokerPDF from '../../components/pdf/LiquidacionPagoBrokerPDF';
import {
  ArrowLeft, Clock, CheckCircle2, AlertCircle, UserCircle, UserPlus,
  MessageSquare, Play, Loader2, Calendar, AlertTriangle, Timer, Edit,
  ChevronDown, ChevronRight, Edit2, Users, ListChecks, FileText,
  ClipboardList, DollarSign, Plus, Info, TrendingUp, Wallet, TrendingDown, Minus, Gift, Ban
} from 'lucide-react';
import { differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import CommissionTaskCommentPopup from '../../components/CommissionTaskCommentPopup';
import CommissionTaskCommentList from '../../components/CommissionTaskCommentList';

const PaymentFlowPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Rest of your component code remains unchanged...

  useEffect(() => {
    if (id) {
      setLoading(true);
      setError(null); 
      Promise.all([
        fetchFlow(),
        fetchUsers(),
        checkAdminStatus()
      ]).catch((err) => {
        console.error("Error en la carga inicial:", err);
        setError(err.message || "Error al cargar datos del flujo.");
      }).finally(() => {
        setLoading(false);
      });
    } else {
      navigate('/pagos');
    }
  }, [id, commentRefreshTrigger]);

  // Rest of your component code remains unchanged...

  return (
    <Layout>
      <div className="max-w-5xl mx-auto pb-12">
        {/* Rest of your JSX remains unchanged... */}
      </div>
    </Layout>
  );
};

export default PaymentFlowPage;