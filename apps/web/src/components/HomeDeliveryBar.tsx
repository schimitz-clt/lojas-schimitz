'use client';

import Link from 'next/link';
import type { DeliveryBarCopy } from '@/lib/home-ux';
import { deliveryAddressHref } from '@/lib/home-ux';
import { IconPin } from '@/components/icons/StorefrontIcons';

function PinIcon() {
  return <IconPin className="delivery-bar-pin" size={18} />;
}

export function HomeDeliveryBar({
  view,
  loggedIn,
  editing,
  draft,
  onDraft,
  onSubmit,
  onCancel,
  onEdit,
}: {
  view: DeliveryBarCopy;
  loggedIn: boolean;
  editing: boolean;
  draft: string;
  onDraft: (value: string) => void;
  onSubmit: (e: { preventDefault(): void }) => void;
  onCancel: () => void;
  onEdit: () => void;
}) {
  const addressHref = deliveryAddressHref(loggedIn);

  return (
    <div className={`delivery-bar delivery-bar-${view.mode}`} aria-label="Entrega">
      {editing ? (
        <form className="delivery-bar-form" onSubmit={onSubmit}>
          <PinIcon />
          <input
            data-cep-input
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            aria-label="Informe seu CEP"
          />
          <button type="submit">OK</button>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        </form>
      ) : view.accountHref ? (
        <Link href={view.accountHref} className="delivery-bar-main">
          <PinIcon />
          <span className="delivery-bar-copy">
            <strong>{view.title}</strong>
            {view.detail ? <span>{view.detail}</span> : null}
          </span>
          <span className="delivery-bar-chevron" aria-hidden>
            ›
          </span>
        </Link>
      ) : (
        <>
          <button
            type="button"
            className="delivery-bar-main"
            onClick={onEdit}
            aria-label={view.mode === 'prompt' ? 'Informar CEP' : 'Alterar CEP'}
          >
            <PinIcon />
            <span className="delivery-bar-copy">
              <strong>{view.title}</strong>
              {view.detail ? <span>{view.detail}</span> : null}
            </span>
          </button>
          <Link href={addressHref} className="delivery-bar-side">
            Endereço
          </Link>
        </>
      )}
    </div>
  );
}
