import { useEffect } from 'react';
import type { AppNotification } from '@kbs/shared';
import { Icon, type IconName } from '../components/Icons';
import { Loading, Panel } from '../components/common';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import { queryClient, useNotifications } from '../lib/queries';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';

const ICON: Record<AppNotification['kind'], IconName> = { order: 'bag', repair: 'mach', promo: 'cup', bonus: 'heart' };

export function NotificationsPanel({ open }: { open: boolean }) {
  const token = useSession((s) => s.token);
  const { data, isPending } = useNotifications();
  const { close, setTab, open: openOverlay } = useUi();

  useEffect(() => {
    if (!open || !data?.unread) return;
    const t = setTimeout(() => {
      void api('/v1/notifications/read', { method: 'POST' }).then(() => queryClient.invalidateQueries({ queryKey: ['/v1/notifications'] }));
    }, 1500);
    return () => clearTimeout(t);
  }, [open, data?.unread]);

  return (
    <Panel open={open} title="Уведомления" onBack={() => close('notifications')} label="Уведомления">
      <div className="box">
        {!token ? (
          <div className="nempty">
            Войдите, чтобы получать статусы заказов и ремонта
            <button className="bt" onClick={() => openOverlay({ type: 'login' })}>
              Войти
            </button>
          </div>
        ) : isPending ? (
          <Loading />
        ) : !data?.items.length ? (
          <div className="nempty">Пока ничего нет. Здесь будут статусы заказов и ремонта.</div>
        ) : (
          data.items.map((n) => (
            <button
              key={n.id}
              className={`nf${n.readAt ? '' : ' un'}`}
              onClick={() => {
                if (n.kind === 'order') setTab('profile');
                else if (n.kind === 'repair') setTab('machine');
              }}
            >
              <div className="nfi">
                <Icon name={ICON[n.kind] ?? 'bell'} />
              </div>
              <div className="tx">
                {n.title}
                {n.body ? <small>{n.body}</small> : null}
                <em>{dateTime(n.createdAt)}</em>
              </div>
            </button>
          ))
        )}
      </div>
    </Panel>
  );
}
