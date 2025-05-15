import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { ArrowLeft, Save, Loader2, Upload } from 'lucide-react';

interface RealEstateAgency {
  id: string;
  business_name: string;
}

interface Project {
  id: string;
  name: string;
  stage: string;
  commune: string;
  deadline: string;
  installments: number;
  real_estate_agency_id: string;
  logo_url: string | null;
}

interface ProjectFormProps {
  project?: Project | null;
  onClose: () => void;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ project, onClose }) => {
  const { session } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agencies, setAgencies] = useState<RealEstateAgency[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Project, 'id'>>({
    name: project?.name || '',
    stage: project?.stage || '',
    commune: project?.commune || '',
    deadline: project?.deadline ? new Date(project.deadline).toISOString().split('T')[0] : '',
    installments: project?.installments || 1,
    real_estate_agency_id: project?.real_estate_agency_id || '',
    logo_url: project?.logo_url || null,
  });

  useEffect(() => {
    fetchAgencies();
  }, []);

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('real_estate_agencies')
        .select('id, business_name')
        .order('business_name');

      if (error) throw error;
      setAgencies(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const calculateInstallments = (selectedDate: string) => {
    const today = new Date();
    const deadline = new Date(selectedDate);
    
    if (deadline < today) {
      return 1;
    }

    const monthDiff = (deadline.getFullYear() - today.getFullYear()) * 12 + 
                     (deadline.getMonth() - today.getMonth()) + 1;
    return Math.max(1, monthDiff);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = e.target.value;
    const installments = calculateInstallments(selectedDate);
    
    setFormData(prev => ({
      ...prev,
      deadline: selectedDate,
      installments,
    }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const uploadLogo = async () => {
    if (!logoFile) return formData.logo_url;

    const fileExt = logoFile.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('project-logos')
      .upload(fileName, logoFile);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('project-logos')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);

      const logo_url = await uploadLogo();

      const data = {
        ...formData,
        logo_url,
        updated_by: session?.user.id,
      };

      if (project?.id) {
        const { error } = await supabase
          .from('projects')
          .update(data)
          .eq('id', project.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('projects')
          .insert([{ ...data, created_by: session?.user.id }]);

        if (error) throw error;
      }

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onClose}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Volver
        </button>
        <h2 className="text-xl font-semibold text-gray-900">
          {project ? 'Editar Proyecto' : 'Nuevo Proyecto'}
        </h2>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logo del Proyecto
            </label>
            <div className="flex items-center space-x-4">
              {(logoPreview || formData.logo_url) && (
                <img
                  src={logoPreview || formData.logo_url || ''}
                  alt="Logo Preview"
                  className="h-16 w-16 object-contain rounded border"
                />
              )}
              <label className="cursor-pointer bg-white border border-gray-300 rounded-md px-4 py-2 hover:bg-gray-50">
                <Upload className="h-5 w-5 inline-block mr-2" />
                <span>Subir Logo</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleLogoChange}
                />
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Nombre *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="stage" className="block text-sm font-medium text-gray-700">
              Etapa *
            </label>
            <input
              type="text"
              id="stage"
              name="stage"
              required
              value={formData.stage}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="commune" className="block text-sm font-medium text-gray-700">
              Comuna *
            </label>
            <input
              type="text"
              id="commune"
              name="commune"
              required
              value={formData.commune}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="deadline" className="block text-sm font-medium text-gray-700">
              Fecha Tope *
            </label>
            <input
              type="date"
              id="deadline"
              name="deadline"
              required
              value={formData.deadline}
              onChange={handleDateChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="installments" className="block text-sm font-medium text-gray-700">
              N° Cuotas
            </label>
            <input
              type="number"
              id="installments"
              name="installments"
              required
              readOnly
              value={formData.installments}
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
            />
          </div>

          <div>
            <label htmlFor="real_estate_agency_id" className="block text-sm font-medium text-gray-700">
              Inmobiliaria *
            </label>
            <select
              id="real_estate_agency_id"
              name="real_estate_agency_id"
              required
              value={formData.real_estate_agency_id}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Seleccione una inmobiliaria</option>
              {agencies.map(agency => (
                <option key={agency.id} value={agency.id}>
                  {agency.business_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                Guardar
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectForm;