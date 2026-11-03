import { and, desc, eq } from 'drizzle-orm';
import type { CreateRepairInput, Repair, RepairService, RepairStage } from '@kbs/shared';
import { REPAIR_STAGES, estimateRepair } from '@kbs/shared';
import type { Db } from '../db/client';
import { repairs, users } from '../db/schema';
import { notifyUser } from './notify';
import { enqueue } from './outbox';
import { OrderError } from './orders';

type RepairRow = typeof repairs.$inferSelect;
type History = Repair['history'];

export const repairNumber = (seq: number) => `Р-${1000 + seq}`;

export function toRepair(r: RepairRow): Repair {
  return {
    id: r.id,
    number: repairNumber(r.seq),
    model: r.model,
    serial: r.serial,
    problem: r.problem,
    stage: r.stage as RepairStage,
    history: r.history as History,
    services: r.services as RepairService[],
    estimateMin: r.estimateMin,
    estimateMax: r.estimateMax,
    total: r.total,
    readyBy: r.readyBy?.toISOString() ?? null,
    master: r.masterName ? { name: r.masterName } : null,
    pickupAddress: r.pickupAddress,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const STAGE_ORDER: RepairStage[] = ['new', 'accepted', 'diagnostics', 'approval', 'repair', 'testing', 'ready', 'returned'];

export class RepairsService {
  constructor(private readonly db: Db) {}

  async create(userId: string, input: CreateRepairInput): Promise<Repair> {
    const [dup] = await this.db
      .select()
      .from(repairs)
      .where(and(eq(repairs.userId, userId), eq(repairs.clientRequestId, input.clientRequestId)));
    if (dup) return toRepair(dup);
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new OrderError('Пользователь не найден', 401);
    const est = estimateRepair(input.problem);
    return this.db.transaction(async (tx) => {
      const [r] = await tx
        .insert(repairs)
        .values({
          userId,
          clientRequestId: input.clientRequestId,
          phone: user.phone,
          model: input.model,
          problem: input.problem,
          pickupAddress: input.pickupAddress,
          stage: 'new',
          history: [{ stage: 'new', at: new Date().toISOString(), note: null }],
          estimateMin: est.min,
          estimateMax: est.max,
        })
        .returning();
      const repair = toRepair(r!);
      await enqueue(tx, 'onec.repair', { repairId: r!.id });
      await enqueue(tx, 'internal.webhook', { event: 'repair.created', data: { ...repair, phone: user.phone, customerName: user.name } });
      await notifyUser(tx, userId, {
        kind: 'repair',
        title: `Заявка ${repair.number} принята`,
        body: 'Позвоним, чтобы договориться, когда забрать машину',
        refId: r!.id,
      });
      return repair;
    });
  }

  async listForUser(userId: string): Promise<Repair[]> {
    const rows = await this.db.select().from(repairs).where(eq(repairs.userId, userId)).orderBy(desc(repairs.createdAt)).limit(50);
    return rows.map(toRepair);
  }

  async getForUser(userId: string, id: string): Promise<Repair | null> {
    const [r] = await this.db.select().from(repairs).where(and(eq(repairs.id, id), eq(repairs.userId, userId)));
    return r ? toRepair(r) : null;
  }

  async listAll(opts: { stage?: RepairStage; limit: number }): Promise<Repair[]> {
    const rows = await this.db
      .select()
      .from(repairs)
      .where(opts.stage ? eq(repairs.stage, opts.stage) : undefined)
      .orderBy(desc(repairs.createdAt))
      .limit(opts.limit);
    return rows.map(toRepair);
  }

  /** Обновление из внутреннего приложения: этап, смета, мастер, срок. */
  async update(
    id: string,
    patch: {
      stage?: RepairStage;
      note?: string | null;
      services?: RepairService[];
      total?: number | null;
      readyBy?: string | null;
      masterName?: string | null;
      serial?: string | null;
    },
  ): Promise<Repair> {
    return this.db.transaction(async (tx) => {
      const [r] = await tx.select().from(repairs).where(eq(repairs.id, id)).for('update');
      if (!r) throw new OrderError('Заявка не найдена', 404);
      const history = [...(r.history as History)];
      const stageChanged = patch.stage && patch.stage !== r.stage;
      if (stageChanged) {
        const from = r.stage as RepairStage;
        if (from === 'returned' || from === 'cancelled') throw new OrderError('Заявка закрыта', 409, 'closed');
        if (patch.stage !== 'cancelled' && STAGE_ORDER.indexOf(patch.stage!) < STAGE_ORDER.indexOf(from)) {
          throw new OrderError('Нельзя вернуть заявку на предыдущий этап', 409, 'bad_transition');
        }
        history.push({ stage: patch.stage!, at: new Date().toISOString(), note: patch.note ?? null });
      }
      const [u] = await tx
        .update(repairs)
        .set({
          ...(patch.stage ? { stage: patch.stage } : {}),
          history,
          ...(patch.services ? { services: patch.services } : {}),
          ...(patch.total !== undefined ? { total: patch.total } : {}),
          ...(patch.readyBy !== undefined ? { readyBy: patch.readyBy ? new Date(patch.readyBy) : null } : {}),
          ...(patch.masterName !== undefined ? { masterName: patch.masterName } : {}),
          ...(patch.serial !== undefined ? { serial: patch.serial } : {}),
          updatedAt: new Date(),
        })
        .where(eq(repairs.id, id))
        .returning();
      const repair = toRepair(u!);
      await enqueue(tx, 'internal.webhook', { event: 'repair.updated', data: repair });
      if (stageChanged) {
        const st = REPAIR_STAGES.find((s) => s.id === patch.stage);
        await notifyUser(tx, u!.userId, {
          kind: 'repair',
          title: `${repair.model}: ${st?.title.toLowerCase() ?? (patch.stage === 'returned' ? 'выдана' : 'заявка отменена')}`,
          body: patch.note || st?.text || '',
          refId: id,
        });
      }
      return repair;
    });
  }
}
