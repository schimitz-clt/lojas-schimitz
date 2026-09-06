'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export type CheckoutAddress = {
  id: string;
  label: string;
  street: string;
  number: string;
  district?: string;
  city: string;
  uf: string;
  cep: string;
  isDefault?: boolean;
};

type AddressFormState = {
  label: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  uf: string;
};

const emptyForm = (): AddressFormState => ({
  label: 'Casa',
  cep: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  uf: 'RS',
});

function formatCep(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

type Props = {
  addresses: CheckoutAddress[];
  addressId: string;
  onAddressesChange: (list: CheckoutAddress[], selectedId: string) => void;
  onAddressIdChange: (id: string) => void;
};

export function CheckoutAddressSection({
  addresses,
  addressId,
  onAddressesChange,
  onAddressIdChange,
}: Props) {
  const hasAddresses = addresses.length > 0;
  const [showForm, setShowForm] = useState(!hasAddresses);
  const [form, setForm] = useState<AddressFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [formOk, setFormOk] = useState('');
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (!hasAddresses) setShowForm(true);
  }, [hasAddresses]);

  async function lookupCep(cepValue: string) {
    const digits = cepValue.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await res.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data?.erro) return;
      setForm((prev) => ({
        ...prev,
        street: data.logradouro?.trim() || prev.street,
        district: data.bairro?.trim() || prev.district,
        city: data.localidade?.trim() || prev.city,
        uf: data.uf?.trim() || prev.uf,
      }));
    } catch {
      /* ViaCEP opcional — usuário preenche manualmente */
    } finally {
      setCepLoading(false);
    }
  }

  async function saveAddress(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormErr('');
    setFormOk('');
    try {
      const payload = {
        label: form.label.trim() || 'Casa',
        cep: form.cep.replace(/\D/g, ''),
        street: form.street.trim(),
        number: form.number.trim(),
        complement: form.complement.trim() || undefined,
        district: form.district.trim(),
        city: form.city.trim(),
        uf: form.uf.trim().toUpperCase(),
        isDefault: !hasAddresses,
      };
      if (payload.cep.length !== 8) {
        throw new Error('Informe um CEP válido com 8 dígitos.');
      }
      if (payload.uf.length !== 2) {
        throw new Error('Informe a UF com 2 letras (ex.: RS).');
      }
      const created = await api<CheckoutAddress>('/me/addresses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const list = await api<CheckoutAddress[]>('/me/addresses');
      onAddressesChange(list, created.id);
      onAddressIdChange(created.id);
      setForm(emptyForm());
      setShowForm(false);
      setFormOk('Endereço salvo. Frete será atualizado em seguida.');
    } catch (err: unknown) {
      setFormErr(err instanceof Error ? err.message : 'Não foi possível salvar o endereço.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="checkout-address card" style={{ marginTop: 12, marginBottom: 8 }}>
      <div className="body">
        <div className="row" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Endereço de entrega</h2>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
              {hasAddresses
                ? 'Escolha onde receber ou cadastre um novo endereço aqui mesmo.'
                : 'Você ainda não tem endereço. Cadastre abaixo para calcular o frete e finalizar.'}
            </p>
          </div>
          {hasAddresses ? (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setShowForm((v) => !v);
                setFormErr('');
                setFormOk('');
              }}
            >
              {showForm ? 'Fechar formulário' : 'Novo endereço'}
            </button>
          ) : null}
        </div>

        {hasAddresses ? (
          <div style={{ marginTop: 14 }}>
            <label htmlFor="checkout-address-select">Endereço</label>
            <select
              id="checkout-address-select"
              value={addressId}
              onChange={(e) => onAddressIdChange(e.target.value)}
              style={{ width: '100%', maxWidth: '100%' }}
            >
              {!addressId ? <option value="">Selecione um endereço</option> : null}
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} — {a.street}, {a.number}
                  {a.district ? ` · ${a.district}` : ''} — {a.city}/{a.uf} · CEP {formatCep(a.cep)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {showForm ? (
          <form className="form checkout-address-form" onSubmit={saveAddress} style={{ marginTop: 14, maxWidth: '100%' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
              {hasAddresses ? 'Cadastrar novo endereço' : 'Cadastre seu endereço'}
            </p>
            <input
              placeholder="Apelido (Casa, Trabalho…)"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              aria-label="Apelido do endereço"
            />
            <div className="checkout-address-grid">
              <input
                placeholder="CEP"
                inputMode="numeric"
                autoComplete="postal-code"
                value={form.cep}
                onChange={(e) => {
                  const cep = formatCep(e.target.value);
                  setForm({ ...form, cep });
                  if (cep.replace(/\D/g, '').length === 8) void lookupCep(cep);
                }}
                required
                aria-label="CEP"
              />
              <input
                placeholder="UF"
                maxLength={2}
                autoComplete="address-level1"
                value={form.uf}
                onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
                required
                aria-label="UF"
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            {cepLoading ? <p className="muted" style={{ margin: 0, fontSize: 13 }}>Buscando CEP…</p> : null}
            <input
              placeholder="Rua / logradouro"
              autoComplete="street-address"
              value={form.street}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
              required
              aria-label="Rua"
            />
            <div className="checkout-address-grid">
              <input
                placeholder="Número"
                autoComplete="address-line2"
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                required
                aria-label="Número"
              />
              <input
                placeholder="Complemento (opcional)"
                value={form.complement}
                onChange={(e) => setForm({ ...form, complement: e.target.value })}
                aria-label="Complemento"
              />
            </div>
            <input
              placeholder="Bairro"
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
              required
              aria-label="Bairro"
            />
            <input
              placeholder="Cidade"
              autoComplete="address-level2"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
              aria-label="Cidade"
            />
            <button className="btn" type="submit" disabled={saving} style={{ width: '100%' }}>
              {saving ? 'Salvando endereço…' : 'Salvar endereço'}
            </button>
          </form>
        ) : null}

        {formErr ? <div className="alert" style={{ marginTop: 12 }}>{formErr}</div> : null}
        {formOk ? <div className="ok" style={{ marginTop: 12 }}>{formOk}</div> : null}

        <p className="muted" style={{ marginBottom: 0, marginTop: 12, fontSize: 13 }}>
          Prefere gerenciar depois?{' '}
          <Link href="/conta">Abrir Minha conta</Link>
        </p>
      </div>
    </section>
  );
}
