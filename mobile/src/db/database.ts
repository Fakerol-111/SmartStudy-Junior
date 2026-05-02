import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('smartstudy.db');
    await initTables(db);
  }
  return db;
}

async function initTables(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      grade TEXT DEFAULT '初一',
      subjects TEXT DEFAULT '[]',
      extra_info TEXT DEFAULT '',
      profile TEXT DEFAULT '{}',
      soul TEXT DEFAULT '{}',
      conversation_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject TEXT DEFAULT 'general',
      intent TEXT DEFAULT 'teach',
      title TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT DEFAULT '',
      tool_name TEXT DEFAULT '',
      tool_args TEXT DEFAULT '',
      tool_result TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    CREATE TABLE IF NOT EXISTS mistake_book (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      question TEXT NOT NULL,
      correct_answer TEXT DEFAULT '',
      student_answer TEXT DEFAULT '',
      analysis TEXT DEFAULT '',
      knowledge_points TEXT DEFAULT '[]',
      mistake_type TEXT DEFAULT 'other',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS knowledge_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      node_name TEXT NOT NULL,
      mastery_level REAL DEFAULT 0.0,
      parent_id INTEGER DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (parent_id) REFERENCES knowledge_nodes(id)
    );

    CREATE TABLE IF NOT EXISTS knowledge_blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      knowledge_point TEXT NOT NULL,
      subject TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );
  `);
}

export async function clearAllDbData(): Promise<void> {
  const database = await getDb();
  await database.execAsync(`
    DELETE FROM messages;
    DELETE FROM conversations;
    DELETE FROM mistake_book;
    DELETE FROM knowledge_nodes;
    DELETE FROM knowledge_blacklist;
    DELETE FROM students;
  `);
}
