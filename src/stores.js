const fs = require("fs");
const path = require("path");

class MemoryStore {
  constructor(initial = {}) {
    this.map = new Map(Object.entries(initial));
  }

  get(guildId) {
    return this.map.get(guildId);
  }

  set(guildId, locale) {
    this.map.set(guildId, locale);
  }

  delete(guildId) {
    this.map.delete(guildId);
  }
}

class JsonFileStore {
  constructor(filePath, { field = "language" } = {}) {
    this.filePath = path.resolve(filePath);
    this.field = field;
    this.data = null;
    this.queue = Promise.resolve();
  }

  async load() {
    if (this.data) return this.data;
    try {
      const raw = await fs.promises.readFile(this.filePath, "utf8");
      this.data = raw.trim() ? JSON.parse(raw) : {};
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
      this.data = {};
    }
    if (!this.data.guilds || typeof this.data.guilds !== "object") this.data.guilds = {};
    return this.data;
  }

  async get(guildId) {
    const data = await this.load();
    return data.guilds[guildId]?.[this.field];
  }

  set(guildId, locale) {
    return this.update((data) => {
      data.guilds[guildId] = { ...data.guilds[guildId], [this.field]: locale };
    });
  }

  delete(guildId) {
    return this.update((data) => {
      const entry = data.guilds[guildId];
      if (!entry) return;
      delete entry[this.field];
      if (Object.keys(entry).length === 0) delete data.guilds[guildId];
    });
  }

  update(mutate) {
    const run = async () => {
      const data = await this.load();
      mutate(data);
      await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.${process.pid}.tmp`;
      await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
      await fs.promises.rename(tmp, this.filePath);
    };
    this.queue = this.queue.then(run, run);
    return this.queue;
  }
}

module.exports = { MemoryStore, JsonFileStore };
