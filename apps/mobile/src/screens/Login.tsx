import { useEffect, useRef, useState } from 'react';
import type { User } from '@kbs/shared';
import { Panel, Spinner } from '../components/common';
import { api } from '../lib/api';
import { formatPhone, maskPhone, phoneDigits } from '../lib/format';
import { openUrl } from '../lib/native';
import { invalidateUser, queryClient, useSettings } from '../lib/queries';
import { registerPush } from '../native';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';

export function LoginPanel({ open, reason }: { open: boolean; reason?: string }) {
  const settings = useSettings().data;
  const close = useUi((s) => s.close);
  const setAfterLogin = useUi((s) => s.setAfterLogin);
  const setAuth = useSession((s) => s.setAuth);
  const [step, setStep] = useState<'phone' | 'code' | 'name'>('phone');
  const [phone, setPhone] = useState('+7');
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState(['', '', '', '']);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep('phone');
        setCode(['', '', '', '']);
        setErr(null);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [open]);
  useEffect(() => {
    if (step !== 'code') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);

  const full = `+7${phoneDigits(phone)}`;
  const phoneOk = phoneDigits(phone).length === 10;

  const request = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await api<{ resendIn: number; devCode?: string }>('/v1/auth/request-code', { method: 'POST', body: { phone: full, consent: true } });
      setResendAt(Date.now() + r.resendIn * 1000);
      setNow(Date.now());
      setStep('code');
      if (r.devCode) {
        // Только в режиме разработки сервер возвращает код: подставляем и входим сразу.
        const d = r.devCode.split('');
        setCode(d);
        setTimeout(() => void verify(d), 400);
      } else {
        setCode(['', '', '', '']);
        setTimeout(() => inputs.current[0]?.focus(), 350);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (digits: string[]) => {
    setErr(null);
    setBusy(true);
    try {
      const r = await api<{ token: string; isNew: boolean }>('/v1/auth/verify', { method: 'POST', body: { phone: full, code: digits.join('') } });
      setAuth(r.token, full);
      invalidateUser();
      void registerPush();
      const me = await queryClient.fetchQuery({ queryKey: ['/v1/me'], queryFn: () => api<User>('/v1/me') }).catch(() => null);
      if (me && !me.name) setStep('name');
      else close('login');
    } catch (e) {
      setErr((e as Error).message);
      setCode(['', '', '', '']);
      setTimeout(() => inputs.current[0]?.focus(), 50);
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    if (name.trim()) {
      await api<User>('/v1/me', { method: 'PATCH', body: { name: name.trim() } })
        .then((u) => queryClient.setQueryData(['/v1/me'], u))
        .catch(() => undefined);
    }
    close('login');
  };

  const onDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '');
    if (d.length > 1) {
      // Вставка кода целиком или автозаполнение из SMS.
      const all = d.slice(0, 4).split('');
      const next = [0, 1, 2, 3].map((k) => all[k] ?? '');
      setCode(next);
      if (all.length === 4) void verify(next);
      return;
    }
    const next = [...code];
    next[i] = d;
    setCode(next);
    if (d && i < 3) inputs.current[i + 1]?.focus();
    if (next.every(Boolean)) void verify(next);
  };

  const left = Math.max(0, Math.ceil((resendAt - now) / 1000));

  return (
    <Panel
      open={open}
      title=""
      label="Вход"
      onBack={() => {
        if (step === 'code') return setStep('phone');
        setAfterLogin(null);
        close('login');
      }}
    >
      <div className="lgn">
        {step === 'phone' ? (
          <>
            <h1>Вход</h1>
            <p className="ord">{reason ?? 'Войдите, чтобы оформлять заказы, следить за ремонтом и копить бонусы'}</p>
            <div className="box">
              <label className="lb" htmlFor="lPhone" style={{ marginTop: 0 }}>
                Номер телефона
              </label>
              <input
                className="fi"
                id="lPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && phoneOk && consent && void request()}
              />
              <button className={`chk${consent ? ' on' : ''}`} onClick={() => setConsent(!consent)}>
                <i />
                <span>
                  Соглашаюсь на обработку персональных данных в соответствии с{' '}
                  <a
                    onClick={(e) => {
                      e.stopPropagation();
                      if (settings) openUrl(settings.privacyUrl);
                    }}
                  >
                    политикой конфиденциальности
                  </a>
                </span>
              </button>
              {err ? <div className="err">{err}</div> : null}
              <button className="bt" disabled={!phoneOk || !consent || busy} onClick={request}>
                {busy ? <Spinner /> : 'Получить код'}
              </button>
            </div>
          </>
        ) : step === 'code' ? (
          <>
            <h1>Код из SMS</h1>
            <p className="ord">Отправили на {formatPhone(full)}</p>
            <div className="box">
              <div className="code">
                {code.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputs.current[i] = el;
                    }}
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={i === 0 ? 4 : 1}
                    value={d}
                    disabled={busy}
                    aria-label={`Цифра ${i + 1}`}
                    onChange={(e) => onDigit(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !code[i] && i > 0) inputs.current[i - 1]?.focus();
                    }}
                  />
                ))}
              </div>
              {err ? <div className="err">{err}</div> : null}
              {busy ? (
                <div className="loading" style={{ padding: '16px 0 0' }}>
                  <Spinner />
                </div>
              ) : null}
              <button className="lnk" disabled={left > 0 || busy} onClick={request} style={left > 0 ? { color: 'var(--muted)' } : undefined}>
                {left > 0 ? `Отправить снова через ${left} с` : 'Отправить код ещё раз'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1>Как к вам обращаться?</h1>
            <p className="ord">Имя увидит курьер и бариста</p>
            <div className="box">
              <input className="fi" placeholder="Имя" autoComplete="given-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
              <button className="bt" onClick={saveName}>
                Готово
              </button>
              <button className="lnk" onClick={() => close('login')}>
                Пропустить
              </button>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
