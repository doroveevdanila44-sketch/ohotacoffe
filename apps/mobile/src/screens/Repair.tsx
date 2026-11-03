import { useEffect, useState } from 'react';
import { DIAGNOSTICS_PRICE, REPAIR_STAGES, estimateRepair, type Repair } from '@kbs/shared';
import { Icon } from '../components/Icons';
import { Spinner } from '../components/common';
import { api } from '../lib/api';
import { dateShort, dateTime, money, uuid } from '../lib/format';
import { openUrl, telHref } from '../lib/native';
import { queryClient, useRepairs, useSettings } from '../lib/queries';
import { useSession } from '../store/session';
import { toast, useUi } from '../store/ui';

const DEMO = [
  { n: 1, t: 'Принята', d: 'Приняли машину в сервис-центре и оформили заказ', w: '29 октября, 12:10' },
  { n: 2, t: 'Диагностика', d: 'Нашли износ помпы и накипь в гидросистеме', w: '30 октября' },
  { n: 4, t: 'Ремонт', d: 'Меняем помпу и уплотнители, чистим от накипи', w: 'Идёт сейчас' },
  { n: 6, t: 'Готова к выдаче', d: 'Позвоним и пришлём уведомление в приложении', w: 'До 6 ноября' },
];

const closed = (r: Repair) => r.stage === 'returned' || r.stage === 'cancelled';

export function RepairScreen({ active }: { active: boolean }) {
  const token = useSession((s) => s.token);
  const repairs = useRepairs(active).data ?? [];
  const current = repairs.find((r) => !closed(r));
  const [step, setStep] = useState<'form' | 'est' | 'track'>('form');
  const [trackId, setTrackId] = useState<string | null>(null);
  const [model, setModel] = useState('');
  const [problem, setProblem] = useState('');
  const [address, setAddress] = useState('');
  const [modelErr, setModelErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reqId, setReqId] = useState(uuid);
  const { open, afterLogin, setAfterLogin } = useUi();
  const setRepairStep = useUi((s) => s.setRepairStep);
  useEffect(() => setRepairStep(step), [step, setRepairStep]);

  // Если есть машина в ремонте, сразу показываем её ход.
  useEffect(() => {
    if (current && step === 'form' && !trackId) {
      setTrackId(current.id);
      setStep('track');
    }
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (s: typeof step) => {
    setStep(s);
    document.getElementById('s-machine')?.scrollTo({ top: 0 });
  };

  const est = estimateRepair(problem);

  const book = async () => {
    setErr(null);
    if (!useSession.getState().token) {
      setAfterLogin('repair');
      open({ type: 'login', reason: 'Войдите по номеру телефона, чтобы записаться на диагностику' });
      return;
    }
    setBusy(true);
    try {
      const r = await api<Repair>('/v1/repairs', {
        method: 'POST',
        body: { model: model.trim(), problem: problem.trim() || null, pickupAddress: address.trim() || null, clientRequestId: reqId },
      });
      queryClient.setQueryData<Repair[]>(['/v1/repairs'], (x) => [r, ...(x ?? []).filter((y) => y.id !== r.id)]);
      toast('Записали на диагностику');
      setReqId(uuid());
      setModel('');
      setProblem('');
      setTrackId(r.id);
      go('track');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (afterLogin === 'repair' && token) {
      setAfterLogin(null);
      void book();
    }
  }, [afterLogin, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const tracked = repairs.find((r) => r.id === trackId);

  return (
    <section className={`screen${active ? ' active' : ''}`} id="s-machine">
      <div className="mach">
        {step === 'form' ? (
          <>
            <div className="rhero">
              <div className="rt">
                Заберём и вернём
                <br />
                бесплатно
              </div>
              <img src="img/crane3.webp" alt="" />
            </div>
            <h1>Починить кофемашину</h1>
            <p className="ord">Расчёт и запись на диагностику</p>
            <Demo active={active} />
            <p className="nt" style={{ textAlign: 'center', margin: '4px 0 0' }}>
              Так вы будете следить за ремонтом в приложении
            </p>
            <div className="box">
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
                Введите название или номер модели вашей кофемашины. Мы рассчитаем примерную стоимость и запишем машину на диагностику.
              </p>
              <label className="lb" htmlFor="mModel">
                Название или номер модели
              </label>
              <input className="fi" id="mModel" placeholder="Например, DeLonghi Magnifica S" autoComplete="off" value={model} onChange={(e) => (setModel(e.target.value), setModelErr(false))} />
              <div className={`er${modelErr ? ' show' : ''}`}>Введите модель кофемашины</div>
              <label className="lb" htmlFor="mWhat">
                Что случилось
              </label>
              <textarea className="fi" id="mWhat" placeholder="Не греет воду, течёт, не мелет зёрна" maxLength={1000} value={problem} onChange={(e) => setProblem(e.target.value)} />
              <label className="lb" htmlFor="mAddr">
                Откуда забрать машину
              </label>
              <input className="fi" id="mAddr" placeholder="Адрес или оставьте пустым, привезёте сами" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} />
              <button
                className="bt"
                onClick={() => {
                  if (model.trim().length < 2) {
                    setModelErr(true);
                    document.getElementById('mModel')?.focus();
                    return;
                  }
                  go('est');
                }}
              >
                Рассчитать стоимость
              </button>
            </div>
            <div className="box">
              <h3>Как это работает</h3>
              <div className="stp"><b>1</b><span>Рассчитаем примерную стоимость ремонта</span></div>
              <div className="stp"><b>2</b><span>Заберём машину и проведём диагностику</span></div>
              <div className="stp"><b>3</b><span>Вы увидите ход ремонта здесь, в приложении</span></div>
            </div>
            {repairs.length ? (
              <div className="box" style={{ paddingTop: 6, paddingBottom: 6 }}>
                {repairs.map((r) => (
                  <button key={r.id} className="rw" onClick={() => (setTrackId(r.id), go('track'))}>
                    <span>
                      {r.model}
                      <small>
                        {r.number} · {stageTitle(r)}
                      </small>
                    </span>
                    <Icon name="chev" />
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : step === 'est' ? (
          <>
            <h1>Стоимость ремонта</h1>
            <p className="ord">Предварительный расчёт</p>
            <div className="box">
              <div className="mname">{model}</div>
              <div className="msub">{problem.trim() || 'Без описания неисправности'}</div>
              <div className="sum">
                от {money(est.min).replace(' ₽', '')} до {money(est.max)}
              </div>
              <div className="msub">Диагностика {money(DIAGNOSTICS_PRICE)} входит в стоимость ремонта</div>
              {address.trim() ? <div className="msub" style={{ marginTop: 8 }}>Заберём по адресу: {address.trim()}</div> : null}
            </div>
            <p className="nt">Точную сумму назовёт мастер после диагностики. Ремонт начнём только после вашего согласия.</p>
            {err ? <div className="err">{err}</div> : null}
            <button className="bt" disabled={busy} onClick={book}>
              {busy ? <Spinner /> : 'Записать на диагностику'}
            </button>
            <button className="bt gh" onClick={() => go('form')}>
              Изменить данные
            </button>
          </>
        ) : tracked ? (
          <Track r={tracked} onNew={() => (setTrackId(null), go('form'))} />
        ) : (
          <button className="bt gh" onClick={() => go('form')}>
            Назад
          </button>
        )}
      </div>
    </section>
  );
}

const stageTitle = (r: Repair) =>
  r.stage === 'new' ? 'Заявка принята' : r.stage === 'returned' ? 'Выдана' : r.stage === 'cancelled' ? 'Отменена' : (REPAIR_STAGES.find((s) => s.id === r.stage)?.title ?? '');

function Track({ r, onNew }: { r: Repair; onNew: () => void }) {
  const settings = useSettings().data;
  const idx = REPAIR_STAGES.findIndex((s) => s.id === r.stage);
  const cur = r.stage === 'returned' ? REPAIR_STAGES.length : idx; // -1: заявка ещё не принята
  const at = (id: string) => r.history.find((h) => h.stage === id);
  const servicesTotal = r.services.reduce((s, x) => s + x.price, 0);
  const phone = settings?.supportPhone ?? '';

  return (
    <>
      <h1>Моя кофемашина</h1>
      <p className="ord">Заявка № {r.number}</p>
      <div className="mc rp">
        <img src="img/machine.webp" alt="Кофемашина в ремонте" />
        <div className="live glass">
          <i />
          {stageTitle(r)}
        </div>
      </div>
      <div className="box">
        <div className="mname">{r.model}</div>
        <div className="msub">
          {r.serial ? (
            <>
              Серийный № {r.serial}
              <br />
            </>
          ) : null}
          Заявка от {dateShort(r.createdAt)}
          {r.readyBy ? `, готовность до ${dateShort(r.readyBy)}` : ''}
        </div>
        {r.stage === 'cancelled' ? null : (
          <>
            <div className="pbar">
              {cur >= 0 ? `Этап ${Math.min(cur + 1, 6)} из 6` : 'Ждём машину'}
              <span>{stageTitle(r)}</span>
            </div>
            <div className="segs">
              {REPAIR_STAGES.map((s, k) => (
                <i key={s.id} className={k < cur || r.stage === 'returned' ? 'g' : k === cur ? 'v' : ''} />
              ))}
            </div>
          </>
        )}
      </div>
      {r.stage === 'new' ? (
        <div className="box">
          <h3>Что дальше</h3>
          <div className="msub" style={{ marginTop: 0 }}>
            Позвоним с номера {phone}, чтобы договориться, когда забрать машину. Предварительно: от {money(r.estimateMin).replace(' ₽', '')} до {money(r.estimateMax)}.
          </div>
        </div>
      ) : null}
      <div className="box">
        <h3>Ход ремонта</h3>
        {REPAIR_STAGES.map((s, i) => {
          const st = i < cur || r.stage === 'returned' ? 'done' : i === cur ? 'cur' : 'pend';
          const h = at(s.id);
          return (
            <div className={`st ${st}`} key={s.id}>
              <div className="dot">{st === 'done' ? <Icon name="check" /> : st === 'cur' ? '' : i + 1}</div>
              <div>
                <div className="t">{s.title}</div>
                <div className="d">{h?.note || s.text}</div>
                <div className="w">{h ? dateTime(h.at) : st === 'cur' ? 'Идёт сейчас' : s.id === 'ready' && r.readyBy ? `До ${dateShort(r.readyBy)}` : 'Ожидается'}</div>
              </div>
            </div>
          );
        })}
      </div>
      {r.services.length ? (
        <div className="box">
          <h3>Услуги</h3>
          {r.services.map((s, i) => (
            <div key={i} className={`sv ${s.state === 'done' ? 'done' : s.state === 'in_progress' ? 'act' : 'pend'}`}>
              <div className="n">
                {s.title}
                <small>{s.state === 'done' ? 'Выполнено' : s.state === 'in_progress' ? 'В работе' : 'Ожидает'}</small>
              </div>
              <b>{money(s.price)}</b>
            </div>
          ))}
          <div className="tot">
            <span>{r.total ? 'Смета согласована' : 'Смета'}</span>
            <b>{money(r.total ?? servicesTotal)}</b>
          </div>
        </div>
      ) : null}
      <div className="box mst">
        <div className="ava">{(r.master?.name ?? 'К')[0]}</div>
        <div>
          {r.master?.name ?? 'Сервис-центр KAMBARSERVICE'}
          <small>{r.master ? 'Мастер сервис-центра' : 'Мастер будет назначен после приёма'}</small>
        </div>
        <button className="btn" onClick={() => (phone ? openUrl(telHref(phone)) : undefined)}>
          Позвонить
        </button>
      </div>
      {settings?.workingHours ? <p className="nt">Связаться с мастером можно в рабочие часы: {settings.workingHours}.</p> : null}
      <button className="bt gh" onClick={onNew}>
        Новая заявка на ремонт
      </button>
    </>
  );
}

/** Слайд-шоу «как вы будете следить за ремонтом». */
function Demo({ active }: { active: boolean }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      if (document.hidden || Date.now() < hold) return;
      setI((x) => (x + 1) % DEMO.length);
    }, 4500);
    return () => clearInterval(t);
  }, [active, hold]);
  return (
    <>
      <div className="dm" aria-label="Пример хода ремонта">
        {DEMO.map((x, k) => (
          <div className={`sl${k === i ? ' on' : ''}`} key={k}>
            <div className="sc">
              <div className="tp">
                <b className="a" style={{ animationDelay: '.05s' }}>
                  {x.t}
                </b>
                <i className="a" style={{ animationDelay: '.15s' }}>
                  Шаг {x.n} из 6
                </i>
              </div>
              <div className="segs">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <i key={n} className={n < x.n ? 'g' : n === x.n ? 'v' : ''} style={{ animationDelay: `${0.3 + n * 0.12}s` }} />
                ))}
              </div>
              <p className="dd a" style={{ animationDelay: '1.1s' }}>
                {x.d}
              </p>
              <p className="dw a" style={{ animationDelay: '1.3s' }}>
                {x.w}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="dmc">
        {DEMO.map((_, k) => (
          <button key={k} aria-label={`Шаг ${k + 1}`} className={k === i ? 'on' : ''} onClick={() => (setHold(Date.now() + 9000), setI(k))} />
        ))}
      </div>
    </>
  );
}
