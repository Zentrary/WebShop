export function makeSupabaseMock(opts = {}) {
  const calls = { rpc: [], insert: [], update: [], select: [], delete: [], storage: [], auth: [] };
  const cfg = {
    rpcResults: opts.rpcResults || {},
    tableData: opts.tableData || {},
    rpcError: opts.rpcError || null,
    session: opts.session || null,
    user: opts.user || null,
  };

  function pickOne(table, state) {
    const raw = cfg.tableData[table];
    if (raw === undefined || raw === null) return null;
    if (!Array.isArray(raw)) return raw;
    let rows = raw;
    for (const [col, val] of state.filters || []) {
      rows = rows.filter((r) => String(r[col]) === String(val));
    }
    return rows.length ? rows[0] : null;
  }

  function chainable(table) {
    const state = { op: 'select', filters: [], data: null, error: null, table };
    const self = {
      _state: state,
      select: (...a) => {
        // `filters` is a live reference so a test can inspect the `.eq()`
        // calls that were chained onto this query afterwards.
        calls.select.push({ table, args: a, filters: state.filters });
        state.op = 'select';
        return self;
      },
      insert: (payload) => {
        calls.insert.push({ table, payload });
        state.op = 'insert';
        state.data = payload;
        return self;
      },
      update: (payload) => {
        calls.update.push({ table, payload });
        state.op = 'update';
        state.data = payload;
        return self;
      },
      delete: () => {
        calls.delete.push({ table });
        state.op = 'delete';
        return self;
      },
      upsert: (payload) => {
        calls.update.push({ table, payload });
        state.op = 'upsert';
        state.data = payload;
        return self;
      },
      eq: (col, val) => {
        state.filters.push([col, val]);
        return self;
      },
      neq: () => self,
      gte: () => self,
      lte: () => self,
      order: () => self,
      limit: () => self,
      range: () => self,
      maybeSingle: async () => ({ data: pickOne(table, state), error: null }),
      single: async () => ({ data: pickOne(table, state), error: null }),
      then: (resolve, reject) => {
        const err = cfg.rpcError && cfg.rpcError.table === table ? cfg.rpcError : null;
        const payload = { data: cfg.tableData[table] ?? (state.op === 'select' ? [] : state.data), error: err };
        return Promise.resolve(payload).then(resolve, reject);
      },
    };
    return self;
  }

  const supabase = {
    calls,
    config: cfg,
    from: (table) => chainable(table),
    rpc: async (name, params) => {
      calls.rpc.push({ name, params });
      if (cfg.rpcError && cfg.rpcError.rpc === name) {
        return { data: null, error: { message: cfg.rpcError.message, code: cfg.rpcError.code } };
      }
      const r = cfg.rpcResults[name];
      if (typeof r === 'function') return { data: await r(params), error: null };
      return { data: r ?? null, error: null };
    },
    auth: {
      getSession: async () => {
        calls.auth.push({ m: 'getSession' });
        return { data: { session: cfg.session }, error: null };
      },
      getUser: async () => {
        calls.auth.push({ m: 'getUser' });
        return { data: { user: cfg.user }, error: null };
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async () => ({ data: null, error: null }),
      signUp: async () => ({ data: null, error: null }),
      signOut: async () => ({ error: null }),
    },
    storage: {
      from: (bucket) => ({
        upload: async (p, file) => {
          calls.storage.push({ bucket, m: 'upload', path: p, file });
          if (opts.storageError) return { data: null, error: { message: opts.storageError } };
          return { data: { path: p }, error: null };
        },
        getPublicUrl: (p) => ({ data: { publicUrl: `https://cdn.test/${bucket}/${p}` } }),
        remove: async (paths) => {
          calls.storage.push({ bucket, m: 'remove', paths });
          return { data: null, error: null };
        },
        list: async () => ({ data: [], error: null }),
      }),
    },
    channel: () => ({
      on: () => ({ on: () => ({ subscribe: () => ({ unsubscribe() {} }) }) }),
      subscribe: () => ({ unsubscribe() {} }),
    }),
  };
  return supabase;
}

export function createClient() {
  const mock = globalThis.__SUPABASE_MOCK__;
  if (!mock) throw new Error('Supabase mock not configured');
  return mock;
}
