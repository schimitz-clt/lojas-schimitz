'use client';

import Link from 'next/link';
import type { DeliveryBarCopy } from '@/lib/home-ux';
import { deliveryAddressHref } from '@/lib/home-ux';

function PinIcon() {
  return (
    <svg className="delivery-bar-pin" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
      />
    </svg>
  );
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
    <div className="delivery-bar" aria-label="Entrega">
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
