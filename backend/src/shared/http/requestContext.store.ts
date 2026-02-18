import { AsyncLocalStorage } from 'async_hooks';

type RequestContext = {
  requestId: string;
  correlationId: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  userEmail?: string;
};

const store = new AsyncLocalStorage<RequestContext>();

export const requestContextStore = {
  run<T>(context: RequestContext, cb: () => T): T {
    return store.run(context, cb);
  },
  get(): RequestContext | undefined {
    return store.getStore();
  },
  patch(values: Partial<RequestContext>) {
    const current = store.getStore();
    if (!current) return;
    Object.assign(current, values);
  },
};

export type { RequestContext };
