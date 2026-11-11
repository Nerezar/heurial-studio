// Storage adapters with one shape: list, get, insert, update, remove.
// catalystStore talks to the Data Store through the Catalyst SDK; memoryStore is for local tests.

function catalystStore(Datastore) {
  const ds = new Datastore();
  return {
    async list(table) {
      const rows = [];
      let nextToken;
      do {
        const page = await ds.table(table).getPagedRows({ nextToken, maxRows: 200 });
        rows.push(...(page.data || []));
        nextToken = page.more_records ? page.next_token : undefined;
      } while (nextToken);
      return rows;
    },
    async get(table, id) {
      try {
        return await ds.table(table).getRow(String(id));
      } catch (err) {
        if (/not.?found|no.?such|invalid.*rowid/i.test(String(err && (err.code || err.message)))) return null;
        throw err;
      }
    },
    insert: (table, row) => ds.table(table).insertRow(row),
    update: (table, row) => ds.table(table).updateRow({ ...row, ROWID: String(row.ROWID) }),
    remove: (table, id) => ds.table(table).deleteRow(String(id)),
  };
}

/** In-memory stand-in with Catalyst-like behaviour: string ROWIDs larger than 2^53, rows as plain objects. */
function memoryStore(seed = {}) {
  const tables = {};
  let next = 141722000000030000n; // beyond Number.MAX_SAFE_INTEGER, like real ROWIDs
  for (const [name, rows] of Object.entries(seed)) {
    tables[name] = new Map();
    for (const r of rows) {
      const id = String(r.ROWID ?? next++);
      tables[name].set(id, { ...r, ROWID: id });
    }
  }
  const t = (name) => (tables[name] ||= new Map());
  return {
    async list(name) { return [...t(name).values()].map((r) => ({ ...r })); },
    async get(name, id) { const r = t(name).get(String(id)); return r ? { ...r } : null; },
    async insert(name, row) { const id = String(next++); const r = { ...row, ROWID: id }; t(name).set(id, r); return { ...r }; },
    async update(name, row) {
      const id = String(row.ROWID);
      if (!t(name).has(id)) throw new Error("not found");
      const r = { ...t(name).get(id), ...row, ROWID: id };
      t(name).set(id, r);
      return { ...r };
    },
    async remove(name, id) { t(name).delete(String(id)); },
    _tables: tables,
  };
}

module.exports = { catalystStore, memoryStore };
