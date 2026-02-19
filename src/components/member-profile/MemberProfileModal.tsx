import React, { useMemo, useState, useRef, useEffect } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, MapPin, Save, Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
  currentEmail?: string | null;
  onClose?: () => void;
  onSaved?: () => void;
  onAvatarUpdated?: () => void;
};

const countryOptions = listCountryOptions();

export default function MemberProfileModal({
  visible,
  userId,
  initialData = {},
  currentEmail,
  onClose,
  onSaved,
  onAvatarUpdated,
}: Props) {
  const hydrateFromInitialData = (data: Record<string, any>) => {
    setNome(data.nome || '');
    setTelefone(data.telefone || '');
    setAddress(data.address || data.morada || '');
    setPostalCode(data.postal_code || data.postalCode || '');

    const countryRaw = data.country || data.pais || 'PT';
    const countryInfo = resolveCountryMeta(countryRaw);
    setCountry(countryInfo?.code || countryInfo?.name || countryRaw);

    setNif(data.nif || data.nif_number || '');
    setAvatarUrl(data.avatar_url || '');
  };

  // Form State
  const [nome, setNome] = useState(initialData.nome || '');
  const [telefone, setTelefone] = useState(initialData.telefone || '');
  const [address, setAddress] = useState(initialData.address || initialData.morada || '');
  const [postalCode, setPostalCode] = useState(initialData.postal_code || initialData.postalCode || '');

  const initialCountryRaw = initialData.country || initialData.pais || 'PT';
  const initialCountryMeta = resolveCountryMeta(initialCountryRaw);
  const [country, setCountry] = useState(initialCountryMeta?.code || initialCountryMeta?.name || initialCountryRaw);

  const [nif, setNif] = useState(initialData.nif || initialData.nif_number || '');

  // Avatar State
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatar_url || '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Sync incoming data while form is pristine. Prevents "typing gets erased".
  useEffect(() => {
    if (!visible) return;
    if (!dirty && initialData) {
      hydrateFromInitialData(initialData);
    }
  }, [visible, initialData, dirty]);

  useEffect(() => {
    if (!visible) {
      setDirty(false);
      setError(null);
      setPreviewUrl(null);
    }
  }, [visible]);

  // Normalize country naming to codes if possible, or keep as is
  const countryMeta = useMemo(() => resolveCountryMeta(country), [country]);

  const validate = () => {
    if (!nome || nome.trim().length < 3) return 'Indica o nome completo.';

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

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setError(null);
    setUploadingAvatar(true);

    try {
      if (!userId) {
        throw new Error('Sessão inválida. Faz login novamente e volta a tentar.');
      }
      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `${userId}/avatar.${fileExt}`;

      // 2. Upload to Storage (Upsert handles the replacement)
      const { error: uploadError } = await supabaseBrowser.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, contentType: file.type || 'image/jpeg' });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data } = supabaseBrowser.storage
        .from('avatars')
        .getPublicUrl(filePath);
      const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

      // 3. Update Database Immediately (Upsert to be safe)
      // We use upsert to create the row if it doesn't exist, or update if it does.
      // We only touch the avatar_url and id to avoid validation errors on other fields if they are empty
      // relying on the DB to handle defaults or the fact that it's an update.
      // However, if it's a NEW row, we might need required fields? 
      // Usually trigger handles creation, so update should be sufficient. 
      // But let's stick to update first, and correct if needed.
      // Actually, user requested "auto-save".

      const { error: dbError } = await supabaseBrowser
        .from('membros')
        .upsert({
          id: userId,
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        .select();

      if (dbError) throw dbError;

      // 4. Success State
      // Cleanup: Delete old avatar if exists (Prevent Storage Bloat)
      if (avatarUrl && avatarUrl !== publicUrl && avatarUrl.includes('avatars')) {
        try {
          const oldPath = avatarUrl
            .split('/avatars/')[1]
            ?.split('?')[0];
          if (oldPath) {
            await supabaseBrowser.storage.from('avatars').remove([oldPath]);
          }
        } catch (cleanupErr) {
          console.error("Avatar cleanup failed:", cleanupErr);
        }
      }

      setAvatarUrl(publicUrl);
      setPreviewUrl(null); // Clear preview, show real URL
      toast.success('Foto atualizada com sucesso!');

      // Notify parent to refresh data (e.g. header avatar) WITHOUT closing modal
      await onAvatarUpdated?.();

      // Close modal? User said "Should not need to click save". 
      // Usually profile modals stay open. We just show success.
      // But onSaved might close it. Let's check parent behavior.
      // Parent onSaved: await refreshMemberData(); setShowProfile(false);
      // Wait, if parent closes the modal, users might be annoyed if they wanted to edit name too.
      // But the user said "Not need to fill the form".
      // Let's NOT call onSaved() if it closes the modal.
      // We should effectively separate "Photo Save" from "Profile Save".
      // So we need a way to refresh data WITHOUT closing.
      // The prop `onSaved` in `AccountProfilePage` closes the modal.
      // I should probably NOT call onSaved, but I need to refresh the parent context data.
      // Since I can't easily reach the parent context refresh without triggering the close...
      // I will just show toast success and perhaps RELY on the fact that when they eventually close/save, it syncs?
      // OR, the image component in parent will update if it uses the same source? 
      // Parent uses `memberData` from context. Context needs refresh.

      // Hack: We can't refresh parent without onSaved. 
      // But the user complained "It doesn't update". 
      // Ideally I should ask for a new prop `onAvatarUpdated`?
      // Or just assume `onSaved` SHOULD NOT close if it's just an avatar update?
      // I can't change the parent props easily without checking usage everywhere.
      // Let's look at AccountProfilePage usage:
      // onSaved={async () => { await refreshMemberData(); setShowProfile(false); }}

      // Okay, I will NOT call onSaved here. I will just rely on the local state `avatarUrl` updating the modal UI.
      // The parent background might not update immediately, but the modal WILL.
      // That satisfies "upload gave well". 
      // Wait, "não altera a foto de perfil nem nada" -> Might mean the header/background.
      // If I don't refresh context, header won't change.
      // But if I call onSaved, modal closes.

      // I'll stick to: Update DB + Update Local State + Toast.
      // When they eventually close or save form, it syncs.
      // If they refresh page, it's there.

      // Wait, I can try to force a router refresh? No.
      // I'll add a toast "Foto guardada!"

    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Erro ao carregar a imagem. Tenta novamente.");
      // Revert preview if failed
      setPreviewUrl(null);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
                    <input value={nome} onChange={(e) => { setDirty(true); setNome(e.target.value); }} className={inputClass} placeholder="Nome completo" />
                  </div>
                  <div>
                    <label className={labelClass}>Email da Conta</label>
                    <input
                      value={currentEmail || initialData.email || ''}
                      className={`${inputClass} bg-gray-100`}
                      type="email"
                      readOnly
                    />
                    <p className="mt-1 ml-1 text-[11px] text-gray-500">Para alterar o email, usa a secção Segurança.</p>
                  </div>
                  <div>
                    <label className={labelClass}>Telefone *</label>
                    <input value={telefone} onChange={(e) => { setDirty(true); setTelefone(withCountryPrefix(e.target.value, country)); }} onBlur={() => setTelefone(normalizePhone(withCountryPrefix(telefone, country)))} className={inputClass} placeholder={countryMeta?.phoneExample} />
                  </div>
                  <div>
                    <label className={labelClass}>NIF / CPF (opcional)</label>
                    <input value={nif} onChange={(e) => { setDirty(true); setNif(e.target.value); }} className={inputClass} placeholder="Número de contribuinte (NIF/CPF)" />
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
                    <select value={country} onChange={(e) => { setDirty(true); setCountry(e.target.value); }} className={inputClass}>
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
                    <input value={address} onChange={(e) => { setDirty(true); setAddress(e.target.value); }} className={inputClass} placeholder="Rua, número, andar" />
                  </div>
                  <div>
                    <label className={labelClass}>Código Postal / CEP (opcional)</label>
                    <input
                      value={postalCode}
                      onChange={(e) => { setDirty(true); setPostalCode(formatPostalCode(e.target.value, country)); }}
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
