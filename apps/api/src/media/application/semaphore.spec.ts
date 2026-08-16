import { describe, expect, it } from 'vitest';
import { Semaphore } from './semaphore';

describe('Semaphore', () => {
  it('permite adquirir hasta el máximo', async () => {
    const sem = new Semaphore(2);
    await sem.acquire();
    await sem.acquire();
    sem.release();
    sem.release();
  });

  it('bloquea cuando se alcanza el máximo', async () => {
    const sem = new Semaphore(1);
    await sem.acquire();

    let resolved = false;
    const promise = sem.acquire().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    sem.release();
    await promise;
    expect(resolved).toBe(true);
    sem.release();
  });

  it('libera en orden FIFO', async () => {
    const sem = new Semaphore(1);
    await sem.acquire();

    const order: number[] = [];
    const p1 = sem.acquire().then(() => {
      order.push(1);
      sem.release();
    });
    const p2 = sem.acquire().then(() => {
      order.push(2);
      sem.release();
    });

    sem.release();
    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });
});
