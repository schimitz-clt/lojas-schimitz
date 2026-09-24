'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react';
import Link from 'next/link';
import {
  REGISTER_CPF_EXISTS_MESSAGE,
  REGISTER_EMAIL_EXISTS_MESSAGE,
  SIGNUP_STORE_NAME,
  birthDateToIso,
  buildRegisterBody,
  continueFromEmail,
  cpfDigits,
  maskBirthDate,
  maskCpf,
  passwordResetHref,
  signupAccessIssue,
  signupBirthDateDisplayIssue,
  signupCpfIssue,
  signupEmailForApi,
  signupEmailIssue,
  SIGNUP_CPF_LOOKUP_FALLBACK,
  signupLookupErrorMessage,
  signupNameIssue,
  signupPathAfterCpf,
  signupPathAfterEmail,
  signupPhoneIssue,
  signupProfileIssue,
  signupSignInIssue,
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
  /** POST /auth/signup-email. The server decides exists; format-only checks are not enough. */
  onLookupEmail: (email: string) => Promise<boolean>;
  /** POST /auth/signup-cpf. A taken CPF stops registration before a second password is created. */
  onLookupCpf: (cpf: string) => Promise<boolean>;
  /** Existing account: POST /auth/login, same cookie session as Entrar. */
  onSignIn: (input: { email: string; password: string }) => Promise<void> | void;
  onEdit?: () => void;
  /** Switch the Entrar/Criar conta sheet back to login without leaving the page. */
  onHaveAccount?: () => void;
  /** Standalone /cadastro keeps a real link to login. */
  haveAccountHref?: string;
};

type CreateStep = Exclude<SignupStep, 'signin' | 'existing-cpf'>;

const STEP_CAPTION: Record<CreateStep, string> = {
  email: 'E-mail',
  profile: 'Seus dados',
  access: 'Senha',
};

function stepNumber(step: CreateStep): 1 | 2 | 3 {
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
  label = 'Já tenho conta',
}: {
  href?: string;
  onClick?: () => void;
  className: string;
  label?: string;
}) {
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {label}
      </button>
    );
  }
  if (href) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }
  return null;
}

function SignupProgress({ step }: { step: CreateStep }) {
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
  onLookupEmail,
  onLookupCpf,
  onSignIn,
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
  const [signInPassword, setSignInPassword] = useState('');
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [issue, setIssue] = useState<SignupIssue | null>(null);
  const [profileTried, setProfileTried] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<'name' | 'cpf' | 'birthDate' | 'phone', boolean>>>({});
  const [checking, setChecking] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const cpfRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const lookupSeq = useRef(0);
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
  const emailAlreadyRegistered = serverIssue?.field === 'email' && Boolean(displayEmail);
  const cpfAlreadyRegistered = serverIssue?.field === 'cpf';
  const viewStep: SignupStep = emailAlreadyRegistered
    ? 'signin'
    : cpfAlreadyRegistered
      ? 'existing-cpf'
      : serverIssue?.field === 'email'
        ? 'email'
        : step;

  useEffect(() => {
    if (!serverIssue) return;
    setIssue(serverIssue);
    if (serverIssue.field === 'email') setStep(displayEmail ? 'signin' : 'email');
    else if (serverIssue.field === 'cpf') setStep('existing-cpf');
  }, [serverIssue, displayEmail]);

  useEffect(() => {
    // Focus only when the step changes. Refocusing when the CPF error clears
    // would jump the caret off the field on the first keystroke.
    if (viewStep === 'email') emailRef.current?.focus();
    else if (viewStep === 'profile') {
      if (activeIssue?.field === 'cpf') cpfRef.current?.focus();
      else nameRef.current?.focus();
    } else if (viewStep === 'access' || viewStep === 'signin') passwordRef.current?.focus();
  }, [viewStep]);

  function touch() {
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
    lookupSeq.current += 1;
    setChecking(false);
    setIssue(null);
    setSignInPassword('');
    onEdit?.();
    setStep('email');
  }

  function editCpf() {
    lookupSeq.current += 1;
    setChecking(false);
    setIssue(null);
    onEdit?.();
    setStep('profile');
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
    const seq = ++lookupSeq.current;
    setIssue(null);
    onEdit?.();
    setChecking(true);
    try {
      const exists = await onLookupEmail(next.displayEmail);
      if (seq !== lookupSeq.current) return;
      const typed = signupEmailForApi(emailRef.current?.value || '');
      if (typed !== signupEmailForApi(next.displayEmail)) return;
      setDisplayEmail(next.displayEmail);
      setSignInPassword('');
      const path = signupPathAfterEmail(exists);
      setStep(path === 'signin' ? 'signin' : 'profile');
    } catch (err: unknown) {
      if (seq !== lookupSeq.current) return;
      setIssue({ field: 'email', message: signupLookupErrorMessage(err) });
    } finally {
      if (seq === lookupSeq.current) setChecking(false);
    }
  }

  async function submitSignIn(e: FormEvent) {
    e.preventDefault();
    const emailIssue = signupEmailIssue(displayEmail);
    if (emailIssue) {
      setIssue(emailIssue);
      setStep('email');
      return;
    }
    const nextIssue = signupSignInIssue(signInPassword);
    if (nextIssue) {
      setIssue(nextIssue);
      return;
    }
    setIssue(null);
    await onSignIn({ email: displayEmail, password: signInPassword });
  }

  async function submitProfile(e: FormEvent) {
    e.preventDefault();
    setProfileTried(true);
    const nextIssue = signupProfileIssue({ name, cpf, birthDate, phone });
    if (nextIssue) {
      setIssue(nextIssue);
      return;
    }
    const submitted = cpfDigits(cpf);
    const seq = ++lookupSeq.current;
    setIssue(null);
    onEdit?.();
    setChecking(true);
    try {
      const exists = await onLookupCpf(cpf);
      if (seq !== lookupSeq.current) return;
      if (cpfDigits(cpfRef.current?.value || '') !== submitted) return;
      const path = signupPathAfterCpf(exists);
      setStep(path === 'existing-cpf' ? 'existing-cpf' : 'access');
    } catch (err: unknown) {
      if (seq !== lookupSeq.current) return;
      setIssue({ field: 'cpf', message: signupLookupErrorMessage(err, SIGNUP_CPF_LOOKUP_FALLBACK) });
    } finally {
      if (seq === lookupSeq.current) setChecking(false);
    }
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
  const hideEmailExistsOnSignIn =
    viewStep === 'signin' &&
    activeIssue?.field === 'email' &&
    activeIssue.message === REGISTER_EMAIL_EXISTS_MESSAGE;
  const hideCpfExists =
    viewStep === 'existing-cpf' && activeIssue?.message === REGISTER_CPF_EXISTS_MESSAGE;
  const message =
    error ||
    (viewStep === 'profile' || emailFieldError || hideEmailExistsOnSignIn || hideCpfExists
      ? ''
      : activeIssue?.message || '');
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
      <form data-signup-step="email" className="acct-form" noValidate onSubmit={submitEmail} aria-busy={checking || undefined}>
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
        <button className="acct-cta" type="submit" disabled={checking || busy}>
          {checking ? 'Verificando…' : 'Continuar'}
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
          <button className="acct-cta" type="submit" disabled={!profileReady || busy || checking}>
            {checking ? 'Verificando…' : 'Continuar'}
          </button>
          {accountAction}
        </form>
      </div>
    );
  } else if (viewStep === 'access') {
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
  } else if (viewStep === 'signin') {
    body = (
      <div data-signup-step="signin" data-fixed-email={displayEmail} data-account-gate="existing">
        <div className="acct-head">
          <button type="button" className="acct-back" aria-label="Voltar" onClick={editEmail} disabled={busy}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="acct-title">Você já tem cadastro</h1>
        </div>
        <FixedEmail email={displayEmail} busy={busy} onAlter={editEmail} />
        <form className="acct-form" noValidate onSubmit={submitSignIn} aria-busy={busy}>
          <p className="acct-lead">Este e-mail já tem conta. Informe a senha para entrar.</p>
          <p className="sr-only">Não pedimos nome, CPF nem data de nascimento de novo.</p>
          {message ? (
            <div className="alert" role="alert">
              {message}
            </div>
          ) : null}
          <PasswordLine
            id="signup-signin-password"
            label="Senha"
            value={signInPassword}
            autoComplete="current-password"
            invalid={fieldInvalid('password')}
            inputRef={passwordRef}
            onChange={(value) => {
              setSignInPassword(value);
              touch();
            }}
          />
          <button className="acct-cta" type="submit" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
          <Link className="acct-textlink" href={passwordResetHref(displayEmail)}>
            Esqueci minha senha
          </Link>
          <Link className="acct-textlink" href={passwordResetHref(displayEmail)}>
            Alterar senha
          </Link>
        </form>
      </div>
    );
  } else {
    body = (
      <div data-signup-step="existing-cpf" data-account-gate="existing-cpf">
        <div className="acct-head">
          <button type="button" className="acct-back" aria-label="Voltar" onClick={editCpf} disabled={busy}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="acct-title">Este CPF já tem conta</h1>
        </div>
        <p className="acct-lead">
          Encontramos uma conta com este CPF. Entre com o e-mail dessa conta. Não vamos criar outra.
        </p>
        <p className="acct-hint">CPF informado: {cpf}</p>
        {message ? (
          <div className="alert" role="alert">
            {message}
          </div>
        ) : null}
        <HaveAccount href={haveAccountHref} onClick={onHaveAccount} className="acct-cta" label="Entrar" />
        <Link className="acct-textlink" href={passwordResetHref('')}>
          Esqueci minha senha
        </Link>
        <Link className="acct-textlink" href={passwordResetHref('')}>
          Alterar senha
        </Link>
        <button type="button" className="acct-textlink" onClick={editCpf}>
          Usar outro CPF
        </button>
      </div>
    );
  }

  return body;
}
