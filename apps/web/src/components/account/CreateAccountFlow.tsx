'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react';
import Link from 'next/link';
import {
  SIGNUP_STORE_NAME,
  birthDateToIso,
  buildRegisterBody,
  continueFromEmail,
  maskBirthDate,
  maskCpf,
  signupAccessIssue,
  signupEmailIssue,
  signupProfileIssue,
  type RegisterBody,
  type SignupField,
  type SignupIssue,
  type SignupStep,
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

const STEP_CAPTION: Record<SignupStep, string> = {
  email: 'E-mail',
  profile: 'Seus dados',
  access: 'Senha',
};

function stepNumber(step: SignupStep): 1 | 2 | 3 {
  if (step === 'email') return 1;
  if (step === 'profile') return 2;
  return 3;
}

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

function SignupProgress({ step }: { step: SignupStep }) {
  const current = stepNumber(step);
  return (
    <div className="acct-progress-wrap">
      <p className="acct-step">
        Passo {current} de 3 · {STEP_CAPTION[step]}
      </p>
      <div
        className="acct-progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={current}
        aria-label={`Passo ${current} de 3, ${STEP_CAPTION[step]}`}
      >
        {[1, 2, 3].map((n) => (
          <span key={n} className={n < current ? 'is-done' : n === current ? 'is-current' : undefined} />
        ))}
      </div>
    </div>
  );
}

function PasswordLine({
  id,
  label,
  value,
  onChange,
  autoComplete,
  invalid,
  hint,
  inputRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  invalid: boolean;
  hint?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={invalid ? 'acct-field is-invalid' : 'acct-field'}>
      <label className="acct-label" htmlFor={id}>
        {label}
      </label>
      <div className="acct-pass">
        <input
          ref={inputRef}
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

function FixedEmail({
  email,
  busy,
  onAlter,
}: {
  email: string;
  busy: boolean;
  onAlter: () => void;
}) {
  return (
    <div className="acct-identity">
      {/* Same mark the store header uses. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="acct-mark" src="/android-chrome-192x192.png" alt="" width={48} height={48} />
      <div>
        <strong>{SIGNUP_STORE_NAME}</strong>
        <p className="acct-identity-email" data-fixed-email={email}>
          <span className="sr-only">E-mail da conta: </span>
          {email}
        </p>
      </div>
      <button type="button" className="acct-alter" onClick={onAlter} disabled={busy}>
        Alterar
      </button>
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
  const [step, setStep] = useState<SignupStep>('email');
  const [email, setEmail] = useState('');
  const [displayEmail, setDisplayEmail] = useState('');
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [issue, setIssue] = useState<SignupIssue | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'email') emailRef.current?.focus();
    else if (step === 'profile') nameRef.current?.focus();
    else passwordRef.current?.focus();
  }, [step]);

  function touch() {
    if (issue) setIssue(null);
    onEdit?.();
  }

  function fieldInvalid(field: SignupField) {
    return issue?.field === field;
  }

  function editEmail() {
    setIssue(null);
    onEdit?.();
    setStep('email');
  }

  function goBack() {
    setIssue(null);
    onEdit?.();
    setStep((current) => (current === 'access' ? 'profile' : 'email'));
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
    setStep('profile');
  }

  function submitProfile(e: FormEvent) {
    e.preventDefault();
    const nextIssue = signupProfileIssue({ name, cpf, birthDate, phone });
    if (nextIssue) {
      setIssue(nextIssue);
      return;
    }
    setIssue(null);
    onEdit?.();
    setStep('access');
  }

  async function submitAccess(e: FormEvent) {
    e.preventDefault();
    const emailIssue = signupEmailIssue(displayEmail);
    if (emailIssue) {
      setIssue(emailIssue);
      setStep('email');
      return;
    }
    const nextIssue = signupAccessIssue({ password, confirmPassword, acceptedPrivacy });
    if (nextIssue) {
      setIssue(nextIssue);
      return;
    }
    const birthIso = birthDateToIso(birthDate);
    if (!birthIso) {
      setIssue({ field: 'birthDate', message: 'Informe a data de nascimento no formato DD/MM/AAAA.' });
      setStep('profile');
      return;
    }
    setIssue(null);
    await onRegister(
      buildRegisterBody({
        email: displayEmail,
        name,
        cpf,
        birthDate: birthIso,
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
        <SignupProgress step="email" />
        <h1 className="acct-title">Criar meu cadastro</h1>
        <span className="acct-kicker" aria-hidden />
        <p className="acct-lead">Informe seu e-mail para começar.</p>
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
            enterKeyHint="next"
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
  } else if (step === 'profile') {
    body = (
      <div data-signup-step="profile" data-fixed-email={displayEmail}>
        <div className="acct-head">
          <button type="button" className="acct-back" aria-label="Voltar" onClick={goBack}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="acct-title">Criar meu cadastro</h1>
        </div>
        <FixedEmail email={displayEmail} busy={busy} onAlter={editEmail} />
        <form className="acct-form" noValidate onSubmit={submitProfile}>
          <SignupProgress step="profile" />
          <p className="sr-only">Passo 2 de 3. O e-mail {displayEmail} já foi escolhido.</p>
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
              enterKeyHint="next"
              value={name}
              aria-invalid={fieldInvalid('name') || undefined}
              onChange={(e) => {
                setName(e.target.value);
                touch();
              }}
            />
          </div>
          <div className={fieldInvalid('cpf') ? 'acct-field is-invalid' : 'acct-field'}>
            <label className="acct-label" htmlFor="signup-cpf">
              CPF
            </label>
            <input
              id="signup-cpf"
              name="cpf"
              className="acct-line"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              maxLength={14}
              enterKeyHint="next"
              value={cpf}
              aria-invalid={fieldInvalid('cpf') || undefined}
              onChange={(e) => {
                setCpf(maskCpf(e.target.value));
                touch();
              }}
            />
          </div>
          <div className={fieldInvalid('birthDate') ? 'acct-field is-invalid' : 'acct-field'}>
            <label className="acct-label" htmlFor="signup-birth">
              Data de nascimento
            </label>
            <input
              id="signup-birth"
              name="bday"
              className="acct-line"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="bday"
              enterKeyHint="next"
              placeholder="DD/MM/AAAA"
              maxLength={10}
              value={birthDate}
              aria-invalid={fieldInvalid('birthDate') || undefined}
              aria-describedby="signup-birth-hint"
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                document.getElementById('signup-phone')?.focus();
              }}
              onChange={(e) => {
                setBirthDate(maskBirthDate(e.target.value, birthDate));
                touch();
              }}
            />
            <p id="signup-birth-hint" className="acct-hint">É preciso ter 18 anos ou mais.</p>
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
              placeholder="(51) 99999-0000"
              maxLength={32}
              enterKeyHint="next"
              value={phone}
              aria-invalid={fieldInvalid('phone') || undefined}
              onChange={(e) => {
                setPhone(e.target.value);
                touch();
              }}
            />
          </div>
          <button className="acct-cta" type="submit">
            Continuar
          </button>
          {accountAction}
        </form>
      </div>
    );
  } else {
    body = (
      <div data-signup-step="access" data-fixed-email={displayEmail}>
        <div className="acct-head">
          <button type="button" className="acct-back" aria-label="Voltar" onClick={goBack} disabled={busy}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="acct-title">Criar meu cadastro</h1>
        </div>
        <FixedEmail email={displayEmail} busy={busy} onAlter={editEmail} />
        <form className="acct-form" noValidate onSubmit={submitAccess} aria-busy={busy}>
          <SignupProgress step="access" />
          <p className="sr-only">Passo 3 de 3. O e-mail {displayEmail} já foi escolhido.</p>
          {message ? (
            <div className="alert" role="alert">
              {message}
            </div>
          ) : null}
          <PasswordLine
            id="signup-password"
            label="Senha (no mínimo 8 caracteres)"
            value={password}
            autoComplete="new-password"
            invalid={fieldInvalid('password')}
            hint="Letras e números."
            inputRef={passwordRef}
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
