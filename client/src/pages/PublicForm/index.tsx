import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { SOURCES } from '../../types';
import type { Company } from '../../types';

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    serviceInterest: '', city: '',
    source: 'web', notes: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    api.get(`/public/company/${slug}`)
      .then((res) => setCompany(res.data))
      .catch(() => setNotFound(true));
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/public/lead', { ...form, slug });
      setSubmitted(true);
    } catch {
      setError('Error al enviar el formulario. Intenta de nuevo.');
    }
  };

  // Marca de la empresa: sin branding (NULL) → verde, el look histórico del formulario.
  const brandStyle = { ['--brand' as string]: company?.primaryColor ?? '#16a34a' } as React.CSSProperties;

  if (notFound || (!company && slug)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔍</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Empresa no encontrada</h1>
          <p className="text-gray-500">El enlace que seguiste no es válido. Verifica la URL o contacta directamente con el negocio.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={brandStyle} className="min-h-screen bg-gradient-to-br from-brand/10 to-brand/5 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Gracias por tu interés!</h1>
          <p className="text-gray-500">
            Hemos recibido tu información{company ? ` en ${company.name}` : ''}. Un asesor te contactará en las próximas horas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={brandStyle} className="min-h-screen bg-gradient-to-br from-brand/10 to-brand/5 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-lg">
        <div className="text-center mb-6">
          {company?.logoUrl && (
            <img
              src={company.logoUrl}
              alt={company.name}
              className="mx-auto h-14 object-contain mb-3"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          {company && <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>}
          <p className="text-gray-500 mt-1">Solicitar información</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none"
                required
                placeholder="Tu nombre"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none"
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none"
                required
                placeholder="+507 6000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Servicio de interés</label>
              <select
                value={form.serviceInterest}
                onChange={(e) => setForm({ ...form, serviceInterest: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none"
              >
                <option value="">Selecciona...</option>
                <option value="paneles residenciales">Paneles Residenciales</option>
                <option value="paneles comerciales">Paneles Comerciales</option>
                <option value="baterías">Baterías de Respaldo</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad / Ubicación</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none"
                placeholder="Ciudad"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">¿Cómo nos conociste?</label>
            <select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none"
            >
              {SOURCES.filter(s => s.value !== 'whatsapp').map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comentarios</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none resize-none"
              placeholder="Cuéntanos qué necesitas..."
            />
          </div>
          <button
            type="submit"
            className="w-full bg-brand text-white py-2.5 rounded-lg font-medium hover:brightness-95 transition-colors cursor-pointer"
          >
            Solicitar información
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          Al enviar aceptas que te contactemos para brindarte información sobre nuestros servicios.
        </p>
      </div>
    </div>
  );
}
