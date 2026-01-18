import React, { useMemo, useState, useRef } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, MapPin, Save, Camera, Loader2 } from 'lucide-react';
import {
  formatPostalCode,
  getPhoneInvalidMessage,
  getPostalInputMode,
  getPostalInvalidMessage,
  listCountryOptions,
  normalizePhone,
  resolveCountryMeta,
  validatePhone,
  validatePostalCode,
  withCountryPrefix,
} from '../../lib/country-utils';

type Props = {
  visible: boolean;
  userId: string;
  initialData?: Record<string, any>;
  onClose?: () => void;
  onSaved?: () => void;
};

const countryOptions = listCountryOptions();

export default function MemberProfileModal({
  visible,
  userId,
  initialData = {},
  onClose,
  onSaved,
}: Props) {
  // Form State
  const [nome, setNome] = useState(initialData.nome || '');
  const [email, setEmail] = useState(initialData.email || '');
  const [telefone, setTelefone] = useState(initialData.telefone || '');
  const [address, setAddress] = useState(initialData.address || initialData.morada || '');
  const [postalCode, setPostalCode] = useState(initialData.postal_code || initialData.postalCode || '');

  const initialCountryRaw = initialData.country || initialData.pais || 'PT';
  const initialCountryMeta = resolveCountryMeta(initialCountryRaw);
  const [country, setCountry] = useState(initialCountryMeta?.code || initialCountryMeta?.name || initialCountryRaw);

  const [nif, setNif] = useState(initialData.nif || initialData.nif_number || '');

  // Avatar State
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatar_url || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Normalize country naming to codes if possible, or keep as is
  const countryMeta = useMemo(() => resolveCountryMeta(country), [country]);

  const validate = () => {
    if (!nome || nome.trim().length < 3) return 'Indica o nome completo.';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Email inválido.';

    // Address and Postal Code are now optional for flexibility
    // if (!address || address.trim().length < 3) return 'Indica a morada.';
    // if (!country) return 'Seleciona o país.';
    // if (!postalCode || postalCode.trim().length < 3) return 'Indica o código postal.';

    if (postalCode && country && !validatePostalCode(country, postalCode)) {
      return getPostalInvalidMessage(country);
    }
    if (telefone && country && !validatePhone(telefone, country)) {
      return getPhoneInvalidMessage(country);
    }
    return null;
  };

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5MB.");
      return;
    }

    if (!supabaseBrowser) {
      setError("Erro de configuração do Supabase.");
      return;
    }

    setAvatarFile(file);
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setError(null);
    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabaseBrowser.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data } = supabaseBrowser.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      // 3. Update Database Immediately (Partial Patch)
      const { error: dbError } = await supabaseBrowser
        .from('membros')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (dbError) throw dbError;

      setAvatarUrl(publicUrl);
      // Refresh page to sync changes across UI
      onSaved?.();
      // Since onSaved usually closes the modal, we might want to keep it open or close it?
      // User asked for "just update the photo", implies done.

    } catch (err: any) {
      console.error(err);
      setError("Erro ao carregar a imagem. Tenta novamente.");
      setUploadingAvatar(false);
    }
    // We don't setUploadingAvatar(false) if success because onSaved likely reloads/closes
  };

  const handleSave = async () => {
    setError(null);
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    if (!supabaseBrowser) {
      setError('Supabase não configurado.');
      return;
    }
    if (!userId) {
      setError('Sessão inválida. Faz login novamente.');
      return;
    }

    setSaving(true);

    try {
      let finalAvatarUrl = avatarUrl;

      // Avatar is now handled separately via instant upload
      // if (avatarFile) { ... } logic removed

      const payload = {
        id: userId,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        telefone: normalizePhone(withCountryPrefix(telefone, country)),
        address: address.trim() || null,
        postal_code: postalCode.trim() || null,
        country: country.trim() || null,
        nif: nif.trim() || null,
        avatar_url: finalAvatarUrl,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabaseBrowser
        .from('membros')
        .upsert(payload, { onConflict: 'id' });

      if (upsertError) {
        setError(upsertError.message || 'Não foi possível gravar.');
        return;
      }

      onSaved?.();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Erro ao gravar dados.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-xl border-gray-200 bg-gray-50/50 py-3 px-4 text-gray-900 focus:bg-white focus:border-garabandal-gold focus:ring-garabandal-gold/20 transition-all outline-none md:text-sm";
  const labelClass = "block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1";

  // Display Image Source
  const displayImage = previewUrl || avatarUrl;

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-garabandal-mist/90 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header / Avatar Section */}
            <div className="p-6 sm:p-8 border-b border-gray-100 flex flex-col items-center justify-center bg-gray-50/30 relative z-10">
              <button onClick={onClose} className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>

              {/* Avatar Uploader */}
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-28 h-28 rounded-full bg-white border-4 border-white shadow-lg overflow-hidden flex items-center justify-center relative">
                  {displayImage ? (
                    <img src={displayImage} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">
                      <User className="w-12 h-12" />
                    </div>
                  )}

                  {/* Overlay on Hover */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-8 h-8 text-white drop-shadow-md" />
                  </div>

                  {/* Loading State */}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                </div>

                {/* Badge */}
                <div className="absolute bottom-1 right-1 bg-garabandal-gold text-garabandal-dark p-2 rounded-full shadow-md border-2 border-white transform translate-x-1 translate-y-1">
                  <Camera className="w-4 h-4" />
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                />
              </div>

              <h2 className="font-serif text-2xl font-bold text-garabandal-dark mt-4">{nome || 'Novo Membro'}</h2>
              <p className="text-gray-500 text-sm">Atualiza a tua foto e dados pessoais.</p>
            </div>

            {/* Form Fields */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-red-50 text-red-600 text-sm font-bold border border-red-100 flex items-center gap-2">
                  <span>⚠️</span> {error}
                </motion.div>
              )}

              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-garabandal-gold" />
                  <h3 className="font-serif text-lg font-bold text-gray-900">Identificação</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Nome Completo *</label>
                    <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} placeholder="Nome completo" />
                  </div>
                  <div>
                    <label className={labelClass}>Email *</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} type="email" placeholder="email@exemplo.com" />
                  </div>
                  <div>
                    <label className={labelClass}>Telefone *</label>
                    <input value={telefone} onChange={(e) => setTelefone(withCountryPrefix(e.target.value, country))} onBlur={() => setTelefone(normalizePhone(withCountryPrefix(telefone, country)))} className={inputClass} placeholder={countryMeta?.phoneExample} />
                  </div>
                  <div>
                    <label className={labelClass}>NIF (opcional)</label>
                    <input value={nif} onChange={(e) => setNif(e.target.value)} className={inputClass} placeholder="Número de contribuinte" />
                  </div>
                </div>
              </div>

              <div className="h-px bg-gray-100 w-full" />

              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-garabandal-gold" />
                  <h3 className="font-serif text-lg font-bold text-gray-900">Morada</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelClass}>País *</label>
                    <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass}>
                      <option value="">Seleciona o país</option>
                      {countryOptions.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Morada (opcional)</label>
                    <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} placeholder="Rua, número, andar" />
                  </div>
                  <div>
                    <label className={labelClass}>Código Postal (opcional)</label>
                    <input
                      value={postalCode}
                      onChange={(e) => setPostalCode(formatPostalCode(e.target.value, country))}
                      inputMode={getPostalInputMode(country)}
                      className={inputClass}
                      placeholder={countryMeta?.postalPlaceholder}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 sm:p-8 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 z-10">
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-2.5 bg-garabandal-gold text-garabandal-dark rounded-xl font-bold hover:bg-yellow-400 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100 flex items-center gap-2 min-w-[160px] justify-center"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    A guardar...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
