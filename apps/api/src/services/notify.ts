import type { AppNotification } from '@kbs/shared';
import type { Db } from '../db/client';
import { notifications } from '../db/schema';
import { enqueue } from './outbox';

/** Уведомление в колокольчике приложения + push на телефоны пользователя. */
export async function notifyUser(
  db: Pick<Db, 'insert'>,
  userId: string | null,
  n: { kind: AppNotification['kind']; title: string; body: string; refId?: string | null },
) {
  if (!userId) return;
  await db.insert(notifications).values({ userId, kind: n.kind, title: n.title, body: n.body, refId: n.refId ?? null });
  await enqueue(db, 'push', {
    userId,
    title: n.title,
    body: n.body,
    data: { kind: n.kind, ...(n.refId ? { refId: n.refId } : {}) },
  });
}
