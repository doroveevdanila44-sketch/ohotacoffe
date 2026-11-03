import { z } from 'zod';

/** Российский номер в формате +7XXXXXXXXXX. Принимает 8…, 7…, +7…, с пробелами и скобками. */
export const phoneSchema = z
  .string()
  .transform((s) => s.replace(/[^\d+]/g, ''))
  .transform((s) => (s.startsWith('8') && s.length === 11 ? `+7${s.slice(1)}` : s))
  .transform((s) => (s.startsWith('7') && s.length === 11 ? `+${s}` : s))
  .refine((s) => /^\+7\d{10}$/.test(s), 'Введите номер в формате +7 900 000-00-00');

export const requestCodeSchema = z.object({
  phone: phoneSchema,
  /** Согласие на обработку персональных данных (152-ФЗ). */
  consent: z.literal(true),
});

export const verifyCodeSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{4}$/),
});

export const orderModifierSchema = z.object({
  addonId: z.string().min(1),
  qty: z.number().int().min(1).max(5).default(1),
  /** Для сиропа: id вкуса (вариант товара-сиропа). */
  flavorId: z.string().min(1).nullable().default(null),
});

export const orderLineInputSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable().default(null),
  qty: z.number().int().min(1).max(50),
  modifiers: z.array(orderModifierSchema).max(20).default([]),
});

export const createOrderSchema = z
  .object({
    lines: z.array(orderLineInputSchema).min(1).max(100),
    delivery: z.object({
      type: z.enum(['delivery', 'pickup']),
      address: z.string().trim().max(300).nullable().default(null),
      pickupPointId: z.string().nullable().default(null),
      comment: z.string().trim().max(500).nullable().default(null),
    }),
    paymentMethod: z.enum(['card_on_delivery', 'cash', 'online']),
    /** Ключ идемпотентности с клиента: повторная отправка не создаст второй заказ. */
    clientRequestId: z.string().uuid(),
  })
  .refine((o) => o.delivery.type !== 'delivery' || (o.delivery.address?.length ?? 0) >= 5, {
    message: 'Укажите адрес доставки',
    path: ['delivery', 'address'],
  })
  .refine((o) => o.delivery.type !== 'pickup' || !!o.delivery.pickupPointId, {
    message: 'Выберите пункт самовывоза',
    path: ['delivery', 'pickupPointId'],
  });

export const createRepairSchema = z.object({
  model: z.string().trim().min(2).max(120),
  problem: z.string().trim().max(1000).nullable().default(null),
  pickupAddress: z.string().trim().max(300).nullable().default(null),
  clientRequestId: z.string().uuid(),
});

export const updateMeSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  city: z.string().trim().max(80).optional(),
});

export const deviceSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(['ios', 'android', 'web']),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderLineInput = z.infer<typeof orderLineInputSchema>;
export type CreateRepairInput = z.infer<typeof createRepairSchema>;
