import sqlite3 from 'sqlite3';

const sqlite = sqlite3.verbose();

let db = null;

const requireDb = () => {
  if (!db) {
    throw new Error('Database is not initialized');
  }

  return db;
};

const openDatabase = async () =>
  new Promise((resolve, reject) => {
    const instance = new sqlite.Database(':memory:', (err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(instance);
    });
  });

const closeDatabase = async (instance) =>
  new Promise((resolve, reject) => {
    instance.close((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });

const runStatements = async (instance, sql) =>
  new Promise((resolve, reject) => {
    instance.exec(sql, (err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });

export const createNewDBInstance = async () => {
  if (db) {
    await closeDatabase(db);
  }

  db = await openDatabase();

  await runStatements(
    db,
    `
      PRAGMA foreign_keys = ON;

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_sub TEXT NOT NULL DEFAULT 'google-oauth2|mock-user',
        role TEXT NOT NULL,
        level TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        is_processing INTEGER NOT NULL DEFAULT 0,
        summary_json TEXT,
        current_question_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE questions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        question_text TEXT NOT NULL,
        question_type TEXT NOT NULL DEFAULT 'verbal',
        language TEXT,
        order_index INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE responses (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        answer_text TEXT NOT NULL,
        answer_type TEXT NOT NULL DEFAULT 'verbal',
        language TEXT,
        technical_score INTEGER,
        communication_score INTEGER,
        feedback TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
      );
    `,
  );
};

export const destroyDBInstance = async () => {
  if (!db) {
    return;
  }

  await closeDatabase(db);
  db = null;
};

export const run = async (sql, params = []) => {
  const instance = requireDb();

  return new Promise((resolve, reject) => {
    instance.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const get = async (sql, params = []) => {
  const instance = requireDb();

  return new Promise((resolve, reject) => {
    instance.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row ?? null);
    });
  });
};

export const all = async (sql, params = []) => {
  const instance = requireDb();

  return new Promise((resolve, reject) => {
    instance.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows ?? []);
    });
  });
};
