'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  SIGNUP_STORE_NAME,
  buildRegisterBody,
  continueFromEmail,
  signupDetailsIssue,
  type RegisterBody,
  type SignupField,
  type SignupIssue,
} from '@/lib/signup-flow';

type Props = {
  busy: boolean;
  error: string;
  onRegister: (body: RegisterBody) => Promise<void> | void;
  onEdit?: () => void;
  /** Switch the Entrar/Criar conta sheet back to login without leaving the page. */
  onHaveAccount?: () => void;
  /** Standalone /cadastro keeps a real link to login. */
  haveAccountHref?: string;
};

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

function HaveAccount({
  href,
  onClick,
  className,
}: {
  href?: string;
  onClick?: () => void;
  className: string;
}) {
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        Já tenho conta
      </button>
    );
  }
  if (href) {
    return (
      <Link href={href} className={className}>
        Já tenho conta
      </Link>
    );
  }
  return null;
}

function PasswordLine({
  id,
  label,
  value,
  onChange,
  autoComplete,
  invalid,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  invalid: boolean;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={invalid ? 'acct-field is-invalid' : 'acct-field'}>
      <label className="acct-label" htmlFor={id}>
        {label}
      </label>
      <div className="acct-pass">
        <input
          id={id}
          name={id === 'signup-confirm' ? 'password-confirm' : 'password'}
          className="acct-line"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={invalid || undefined}
        />
        <button
          type="button"
          className="acct-eye"
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={show}
          onClick={() => setShow((v) => !v)}
        >
          <EyeIcon off={show} />
        </button>
      </div>
      {hint ? <p className="acct-hint">{hint}</p> : null}
    </div>
  );
}

export function CreateAccountFlow({
  busy,
  error,
  onRegister,
  onEdit,
  onHaveAccount,
  haveAccountHref,
}: Props) {
  const [step, setStep] = useState<'email' | 'details'>('email');
  const [email, setEmail] = useState('');
  const [displayEmail, setDisplayEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [issue, setIssue] = useState<SignupIssue | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'email') emailRef.current?.focus();
    else nameRef.current?.focus();
  }, [step]);

  function touch() {
    if (issue) setIssue(null);
    onEdit?.();
  }

  function fieldInvalid(field: SignupField) {
    return issue?.field === field;
  }

  function submitEmail(e: FormEvent) {
    e.preventDefault();
    const next = continueFromEmail(email);
    if (!next.ok) {
      setIssue(next.issue);
      return;
    }
    setIssue(null);
    onEdit?.();
    setDisplayEmail(next.displayEmail);
    setStep('details');
  }

  async function submitDetails(e: FormEvent) {
    e.preventDefault();
    const nextIssue = signupDetailsIssue({
      email: displayEmail,
      name,
      phone,
      password,
      confirmPassword,
      acceptedPrivacy,
    });
    if (nextIssue) {
      setIssue(nextIssue);
      return;
    }
    setIssue(null);
    await onRegister(
      buildRegisterBody({
        email: displayEmail,
        name,
        phone,
        password,
      }),
    );
  }

  const message = error || issue?.message || '';
  const accountAction = (
    <HaveAccount
      href={haveAccountHref}
      onClick={onHaveAccount}
      className={step === 'email' ? 'acct-secondary' : 'acct-textlink'}
    />
  );

  let body: ReactNode;
  if (step === 'email') {
    body = (
      <form data-signup-step="email" className="acct-form" noValidate onSubmit={submitEmail}>
        <p className="acct-step">Passo 1 de 2</p>
        <h1 className="acct-title">Criar meu cadastro</h1>
        <span className="acct-kicker" aria-hidden />
        <p className="acct-lead">
          Comece com o e-mail. No próximo passo ele fica fixo e você completa nome, WhatsApp e senha.
        </p>
        {message ? (
          <div className="alert" role="alert">
            {message}
          </div>
        ) : null}
        <div className={fieldInvalid('email') ? 'acct-field is-invalid' : 'acct-field'}>
          <label className="acct-label" htmlFor="signup-email">
            E-mail
          </label>
          <input
            ref={emailRef}
            id="signup-email"
            name="email"
            className="acct-line"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            aria-invalid={fieldInvalid('email') || undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              touch();
            }}
          />
        </div>
        <button className="acct-cta" type="submit">
          Continuar
        </button>
        {accountAction}
      </form>
    );
  } else {
    body = (
      <div data-signup-step="details">
        <button
          type="button"
          className="acct-back"
          onClick={() => {
            setIssue(null);
            onEdit?.();
            setStep('email');
          }}
          disabled={busy}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Criar meu cadastro
        </button>
        <div className="acct-identity">
          {/* Same mark the store header uses on mobile. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="acct-mark" src="/android-chrome-192x192.png" alt="" width={48} height={48} />
          <div>
            <strong>{SIGNUP_STORE_NAME}</strong>
            <p className="acct-identity-email" data-fixed-email={displayEmail}>
              {displayEmail}
            </p>
          </div>
        </div>
        <form className="acct-form" noValidate onSubmit={submitDetails} aria-busy={busy}>
          <p className="sr-only">Passo 2 de 2. O e-mail {displayEmail} já foi escolhido.</p>
          {message ? (
            <div className="alert" role="alert">
              {message}
            </div>
          ) : null}
          <div className={fieldInvalid('name') ? 'acct-field is-invalid' : 'acct-field'}>
            <label className="acct-label" htmlFor="signup-name">
              Nome completo
            </label>
            <input
              ref={nameRef}
              id="signup-name"
              name="name"
              className="acct-line"
              autoComplete="name"
              value={name}
              aria-invalid={fieldInvalid('name') || undefined}
              onChange={(e) => {
                setName(e.target.value);
                touch();
              }}
            />
          </div>
          <div className={fieldInvalid('phone') ? 'acct-field is-invalid' : 'acct-field'}>
            <label className="acct-label" htmlFor="signup-phone">
              WhatsApp (opcional, com DDD)
            </label>
            <input
              id="signup-phone"
              name="tel"
              className="acct-line"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={32}
              value={phone}
              aria-invalid={fieldInvalid('phone') || undefined}
              onChange={(e) => {
                setPhone(e.target.value);
                touch();
              }}
            />
          </div>
          <PasswordLine
            id="signup-password"
            label="Senha (no mínimo 8 caracteres)"
            value={password}
            autoComplete="new-password"
            invalid={fieldInvalid('password')}
            hint="Letras e números."
            onChange={(value) => {
              setPassword(value);
              touch();
            }}
          />
          <PasswordLine
            id="signup-confirm"
            label="Confirma senha"
            value={confirmPassword}
            autoComplete="new-password"
            invalid={fieldInvalid('confirm')}
            onChange={(value) => {
              setConfirmPassword(value);
              touch();
            }}
          />
          <div className={fieldInvalid('privacy') ? 'acct-privacy is-invalid' : 'acct-privacy'}>
            <p id="signup-privacy-copy">
              <label htmlFor="signup-privacy">Li e aceito a </label>
              <Link href="/privacidade" target="_blank" rel="noopener noreferrer">
                Política de Privacidade
              </Link>
              <label htmlFor="signup-privacy"> da Lojas Schimitz</label>
            </p>
            <input
              id="signup-privacy"
              type="checkbox"
              checked={acceptedPrivacy}
              aria-invalid={fieldInvalid('privacy') || undefined}
              aria-describedby="signup-privacy-copy"
              onChange={(e) => {
                setAcceptedPrivacy(e.target.checked);
                touch();
              }}
            />
          </div>
          <button className="acct-cta" type="submit" disabled={busy}>
            {busy ? 'Criando conta…' : 'Cadastrar e continuar'}
          </button>
          {accountAction}
        </form>
      </div>
    );
  }

  return body;
}
