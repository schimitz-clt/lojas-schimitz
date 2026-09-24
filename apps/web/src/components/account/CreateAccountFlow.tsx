'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  REGISTER_EMAIL_EXISTS_MESSAGE,
  SIGNUP_EMAIL_AVAILABILITY_PATH,
  SIGNUP_STORE_NAME,
  birthDateToIso,
  buildRegisterBody,
  continueFromEmail,
  cpfDigits,
  maskBirthDate,
  maskCpf,
  signupAccessIssue,
  signupBirthDateDisplayIssue,
  signupCpfIssue,
  signupEmailCheckFailure,
  signupEmailForApi,
  signupEmailIssue,
  signupEmailMayAdvance,
  signupNameIssue,
  signupPhoneIssue,
  signupProfileIssue,
  type RegisterBody,
  type SignupField,
  type SignupIssue,
  type SignupStep,
} from '@/lib/signup-flow';

type Props = {
  busy: boolean;
  error: string;
  /** 409 from POST /auth/register, already pointed at CPF or e-mail. */
  serverIssue?: SignupIssue | null;
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
  serverIssue,
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
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [profileTried, setProfileTried] = useState(false);
  const emailCheckGen = useRef(0);
  const [touched, setTouched] = useState<Partial<Record<'name' | 'cpf' | 'birthDate' | 'phone', boolean>>>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const cpfRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const activeIssue = serverIssue ?? issue;
  const nameIssue = signupNameIssue(name);
  const cpfIssue = signupCpfIssue(cpf);
  const birthIssue = signupBirthDateDisplayIssue(birthDate);
  const phoneIssue = signupPhoneIssue(phone);
  const profileReady = !nameIssue && !cpfIssue && !birthIssue && !phoneIssue;
  const showNameError = profileTried || Boolean(touched.name) || /\s/.test(name.trim()) || name.trim().length >= 8;
  const showCpfError = profileTried || Boolean(touched.cpf) || cpfDigits(cpf).length >= 11;
  const showBirthError = profileTried || Boolean(touched.birthDate) || birthDate.trim().length >= 10;
  const showPhoneError = profileTried || Boolean(touched.phone) || phone.replace(/\D/g, '').length >= 10;
  const viewStep: SignupStep =
    serverIssue?.field === 'email' ? 'email' : serverIssue?.field === 'cpf' ? 'profile' : step;

  useEffect(() => {
    if (!serverIssue) return;
    setIssue(serverIssue);
    if (serverIssue.field === 'email') setStep('email');
    else if (serverIssue.field === 'cpf') setStep('profile');
  }, [serverIssue]);

  useEffect(() => {
    // Focus only when the step changes. Refocusing when the CPF error clears
    // would jump the caret off the field on the first keystroke.
    if (viewStep === 'email') emailRef.current?.focus();
    else if (viewStep === 'profile') {
      if (activeIssue?.field === 'cpf') cpfRef.current?.focus();
      else nameRef.current?.focus();
    } else passwordRef.current?.focus();
  }, [viewStep]);

  function touch() {
    emailCheckGen.current += 1;
    setCheckingEmail(false);
    if (issue) setIssue(null);
    onEdit?.();
  }

  function markTouched(field: 'name' | 'cpf' | 'birthDate' | 'phone') {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  function fieldInvalid(field: SignupField) {
    return activeIssue?.field === field;
  }

  function profileMessage(
    field: 'name' | 'cpf' | 'birthDate' | 'phone',
    local: SignupIssue | null,
    show: boolean,
  ): string {
    if (viewStep !== 'profile') return '';
    if (activeIssue?.field === field) return activeIssue.message;
    if (show && local) return local.message;
    return '';
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

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    const next = continueFromEmail(email);
    if (!next.ok) {
      setIssue(next.issue);
      return;
    }
    const gen = ++emailCheckGen.current;
    setCheckingEmail(true);
    setIssue(null);
    onEdit?.();
    try {
      const data = await api<{ available?: boolean }>(SIGNUP_EMAIL_AVAILABILITY_PATH, {
        method: 'POST',
        body: JSON.stringify({ email: signupEmailForApi(next.displayEmail) }),
      });
      if (gen !== emailCheckGen.current) return;
      if (!signupEmailMayAdvance(data)) {
        setIssue({ field: 'email', message: REGISTER_EMAIL_EXISTS_MESSAGE });
        return;
      }
      setDisplayEmail(next.displayEmail);
      setStep('profile');
    } catch (err: unknown) {
      if (gen !== emailCheckGen.current) return;
      setIssue(signupEmailCheckFailure(err));
    } finally {
      if (gen === emailCheckGen.current) setCheckingEmail(false);
    }
  }

  function submitProfile(e: FormEvent) {
    e.preventDefault();
    setProfileTried(true);
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
    const profileIssue = signupProfileIssue({ name, cpf, birthDate, phone });
    if (profileIssue) {
      setProfileTried(true);
      setIssue(profileIssue);
      setStep('profile');
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

  const nameFieldError = profileMessage('name', nameIssue, showNameError);
  const cpfFieldError = profileMessage('cpf', cpfIssue, showCpfError);
  const birthFieldError = profileMessage('birthDate', birthIssue, showBirthError);
  const phoneFieldError = profileMessage('phone', phoneIssue, showPhoneError);
  const emailFieldError = viewStep === 'email' && activeIssue?.field === 'email' ? activeIssue.message : '';
  const message =
    error ||
    (viewStep === 'profile' || emailFieldError ? '' : activeIssue?.message || '');
  const accountAction = (
    <HaveAccount
      href={haveAccountHref}
      onClick={onHaveAccount}
      className={viewStep === 'email' ? 'acct-secondary' : 'acct-textlink'}
    />
  );

  let body: ReactNode;
  if (viewStep === 'email') {
    body = (
      <form data-signup-step="email" className="acct-form" noValidate onSubmit={submitEmail} aria-busy={checkingEmail || undefined}>
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
            aria-describedby={emailFieldError ? 'signup-email-error' : undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              touch();
            }}
          />
          {emailFieldError ? (
            <p className="acct-field-error" id="signup-email-error" role="alert">
              {emailFieldError}
            </p>
          ) : null}
        </div>
        <button className="acct-cta" type="submit" disabled={checkingEmail || busy}>
          {checkingEmail ? 'Verificando…' : 'Continuar'}
        </button>
        {accountAction}
      </form>
    );
  } else if (viewStep === 'profile') {
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
          <SignupProgress step={viewStep} />
          <p className="sr-only">Passo 2 de 3. O e-mail {displayEmail} já foi escolhido.</p>
          {message ? (
            <div className="alert" role="alert">
              {message}
            </div>
          ) : null}
          <div className={nameFieldError ? 'acct-field is-invalid' : 'acct-field'}>
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
              aria-invalid={Boolean(nameFieldError) || undefined}
              aria-describedby={nameFieldError ? 'signup-name-error' : undefined}
              onBlur={() => markTouched('name')}
              onChange={(e) => {
                setName(e.target.value);
                touch();
              }}
            />
            {nameFieldError ? (
              <p className="acct-field-error" id="signup-name-error" role="alert">
                {nameFieldError}
              </p>
            ) : null}
          </div>
          <div className={cpfFieldError ? 'acct-field is-invalid' : 'acct-field'}>
            <label className="acct-label" htmlFor="signup-cpf">
              CPF
            </label>
            <input
              ref={cpfRef}
              id="signup-cpf"
              name="cpf"
              className="acct-line"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              maxLength={14}
              enterKeyHint="next"
              value={cpf}
              aria-invalid={Boolean(cpfFieldError) || undefined}
              aria-describedby={cpfFieldError ? 'signup-cpf-error' : undefined}
              onBlur={() => markTouched('cpf')}
              onChange={(e) => {
                setCpf(maskCpf(e.target.value));
                touch();
              }}
            />
            {cpfFieldError ? (
              <p className="acct-field-error" id="signup-cpf-error" role="alert">
                {cpfFieldError}
              </p>
            ) : null}
          </div>
          <div className={birthFieldError ? 'acct-field is-invalid' : 'acct-field'}>
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
              aria-invalid={Boolean(birthFieldError) || undefined}
              aria-describedby={birthFieldError ? 'signup-birth-hint signup-birth-error' : 'signup-birth-hint'}
              onBlur={() => markTouched('birthDate')}
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
            {birthFieldError ? (
              <p className="acct-field-error" id="signup-birth-error" role="alert">
                {birthFieldError}
              </p>
            ) : null}
          </div>
          <div className={phoneFieldError ? 'acct-field is-invalid' : 'acct-field'}>
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
              aria-invalid={Boolean(phoneFieldError) || undefined}
              aria-describedby={phoneFieldError ? 'signup-phone-error' : undefined}
              onBlur={() => markTouched('phone')}
              onChange={(e) => {
                setPhone(e.target.value);
                touch();
              }}
            />
            {phoneFieldError ? (
              <p className="acct-field-error" id="signup-phone-error" role="alert">
                {phoneFieldError}
              </p>
            ) : null}
          </div>
          <button className="acct-cta" type="submit" disabled={!profileReady || busy}>
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
