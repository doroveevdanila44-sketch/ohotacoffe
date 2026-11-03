import { randomUUID } from 'node:crypto';
import mockCatalog from './mock-catalog.json';
import type { OneCAdapter, OneCCatalog, OneCOrder, OneCRepairRequest } from './types';

/**
 * Демо-режим без 1С: каталог из прототипа, заказы «записываются» в память.
 * Включается ONEC_MODE=mock. Нужен для разработки, тестов и проверки в сторах до подключения 1С.
 */
export class MockAdapter implements OneCAdapter {
  readonly name = 'mock';
  readonly orders: OneCOrder[] = [];
  readonly repairs: OneCRepairRequest[] = [];
  /** Для тестов: сколько следующих записей заказа завершить ошибкой. */
  failNext = 0;

  async ping() {}

  async fetchCatalog(): Promise<OneCCatalog> {
    return structuredClone(mockCatalog as OneCCatalog);
  }

  async createOrder(order: OneCOrder) {
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error('1С временно недоступна (тест)');
    }
    this.orders.push(order);
    return { ref: randomUUID() };
  }

  async createRepair(repair: OneCRepairRequest) {
    this.repairs.push(repair);
    return { ref: randomUUID() };
  }

  async getBonusBalance() {
    return 12;
  }
}
