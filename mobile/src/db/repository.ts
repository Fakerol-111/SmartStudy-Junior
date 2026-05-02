import { getDb } from './database';
import type { StudentProfileData, TeacherSoulData, BlacklistEntryData } from '../core/types';

export interface Student {
  id?: number;
  name: string;
  grade: string;
  subjects: string;
  extra_info?: string;
  profile?: string;
  soul?: string;
  conversation_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Conversation {
  id?: number;
  student_id: number;
  subject: string;
  intent?: string;
  title: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MessageRecord {
  id?: number;
  conversation_id: number;
  role: string;
  content: string;
  tool_name?: string;
  tool_args?: string;
  tool_result?: string;
  created_at?: string;
}

export interface MistakeRecord {
  id?: number;
  student_id: number;
  subject: string;
  question: string;
  correct_answer?: string;
  student_answer?: string;
  analysis?: string;
  knowledge_points?: string;
  mistake_type?: string;
  created_at?: string;
}

export interface KnowledgeNodeRecord {
  id?: number;
  student_id: number;
  subject: string;
  node_name: string;
  mastery_level: number;
  parent_id?: number;
  created_at?: string;
  updated_at?: string;
}

// ── Student Repository ─────────────────────────────────────
export class StudentRepository {
  async create(student: Student): Promise<Student> {
    const db = await getDb();
    const result = await db.runAsync(
      'INSERT INTO students (name, grade, subjects, extra_info, profile, soul, conversation_count) VALUES (?, ?, ?, ?, ?, ?, 0)',
      student.name,
      student.grade,
      student.subjects,
      student.extra_info || '',
      student.profile || '{}',
      student.soul || '{}',
    );
    return { ...student, id: result.lastInsertRowId };
  }

  async get(id: number): Promise<Student | null> {
    const db = await getDb();
    return (await db.getFirstAsync(
      'SELECT * FROM students WHERE id = ?', id
    )) as Student | null;
  }

  async findByName(name: string): Promise<Student | null> {
    const db = await getDb();
    return (await db.getFirstAsync(
      'SELECT * FROM students WHERE name = ?', name
    )) as Student | null;
  }

  async update(id: number, updates: Partial<Student>): Promise<void> {
    const db = await getDb();
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      await db.runAsync(
        `UPDATE students SET ${fields.join(', ')} WHERE id = ?`,
        ...values
      );
    }
  }

  async incrementConversationCount(id: number): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE students SET conversation_count = conversation_count + 1, updated_at = datetime('now') WHERE id = ?",
      id
    );
  }

  async getProfile(id: number): Promise<StudentProfileData | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ profile: string }>(
      'SELECT profile FROM students WHERE id = ?', id
    );
    if (!row) return null;
    try { return JSON.parse(row.profile); } catch { return null; }
  }

  async updateProfile(id: number, profile: StudentProfileData): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE students SET profile = ?, updated_at = datetime('now') WHERE id = ?",
      JSON.stringify(profile), id
    );
  }

  async getSoul(id: number): Promise<TeacherSoulData | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ soul: string }>(
      'SELECT soul FROM students WHERE id = ?', id
    );
    if (!row) return null;
    try { return JSON.parse(row.soul); } catch { return null; }
  }

  async updateSoul(id: number, soul: TeacherSoulData): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE students SET soul = ?, updated_at = datetime('now') WHERE id = ?",
      JSON.stringify(soul), id
    );
  }
}

// ── Conversation Repository ────────────────────────────────
export class ConversationRepository {
  async create(conv: Conversation): Promise<Conversation> {
    const db = await getDb();
    const result = await db.runAsync(
      'INSERT INTO conversations (student_id, subject, intent, title, status) VALUES (?, ?, ?, ?, ?)',
      conv.student_id,
      conv.subject,
      conv.intent || 'teach',
      conv.title,
      conv.status || 'active',
    );
    return { ...conv, id: result.lastInsertRowId };
  }

  async get(id: number): Promise<Conversation | null> {
    const db = await getDb();
    return (await db.getFirstAsync(
      'SELECT * FROM conversations WHERE id = ?', id
    )) as Conversation | null;
  }

  async getActive(studentId: number): Promise<Conversation | null> {
    const db = await getDb();
    return (await db.getFirstAsync(
      "SELECT * FROM conversations WHERE student_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1",
      studentId
    )) as Conversation | null;
  }

  async listByStudent(studentId: number): Promise<Conversation[]> {
    const db = await getDb();
    return (await db.getAllAsync(
      'SELECT * FROM conversations WHERE student_id = ? ORDER BY updated_at DESC',
      studentId
    )) as Conversation[];
  }

  async markCompleted(id: number): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE conversations SET status = 'completed', updated_at = datetime('now') WHERE id = ?",
      id
    );
  }

  async markActive(id: number): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE conversations SET status = 'active', updated_at = datetime('now') WHERE id = ?",
      id
    );
  }
}

// ── Message Repository ─────────────────────────────────────
export class MessageRepository {
  async create(msg: MessageRecord): Promise<MessageRecord> {
    const db = await getDb();
    const result = await db.runAsync(
      'INSERT INTO messages (conversation_id, role, content, tool_name, tool_args, tool_result) VALUES (?, ?, ?, ?, ?, ?)',
      msg.conversation_id,
      msg.role,
      msg.content,
      msg.tool_name || '',
      msg.tool_args || '',
      msg.tool_result || ''
    );
    return { ...msg, id: result.lastInsertRowId };
  }

  async listByConversation(conversationId: number): Promise<MessageRecord[]> {
    const db = await getDb();
    return (await db.getAllAsync(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      conversationId
    )) as MessageRecord[];
  }
}

// ── Mistake Repository ─────────────────────────────────────
export class MistakeRepository {
  async create(mistake: MistakeRecord): Promise<MistakeRecord> {
    const db = await getDb();
    const result = await db.runAsync(
      `INSERT INTO mistake_book (student_id, subject, question, correct_answer, student_answer, analysis, knowledge_points, mistake_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      mistake.student_id,
      mistake.subject,
      mistake.question,
      mistake.correct_answer || '',
      mistake.student_answer || '',
      mistake.analysis || '',
      mistake.knowledge_points || '[]',
      mistake.mistake_type || 'other'
    );
    return { ...mistake, id: result.lastInsertRowId };
  }

  async listByStudent(studentId: number): Promise<MistakeRecord[]> {
    const db = await getDb();
    return (await db.getAllAsync(
      'SELECT * FROM mistake_book WHERE student_id = ? ORDER BY created_at DESC',
      studentId
    )) as MistakeRecord[];
  }

  async listBySubject(studentId: number, subject: string): Promise<MistakeRecord[]> {
    const db = await getDb();
    return (await db.getAllAsync(
      'SELECT * FROM mistake_book WHERE student_id = ? AND subject = ? ORDER BY created_at DESC',
      studentId, subject
    )) as MistakeRecord[];
  }
}

// ── Knowledge Node Repository ──────────────────────────────
export class KnowledgeNodeRepository {
  async upsert(node: KnowledgeNodeRecord): Promise<void> {
    const db = await getDb();
    const existing = await db.getFirstAsync<KnowledgeNodeRecord>(
      'SELECT id FROM knowledge_nodes WHERE student_id = ? AND subject = ? AND node_name = ?',
      node.student_id, node.subject, node.node_name
    );
    if (existing) {
      const eid = existing.id!;
      await db.runAsync(
        "UPDATE knowledge_nodes SET mastery_level = ?, updated_at = datetime('now') WHERE id = ?",
        node.mastery_level, eid
      );
    } else {
      const sid = node.student_id!;
      await db.runAsync(
        'INSERT INTO knowledge_nodes (student_id, subject, node_name, mastery_level, parent_id) VALUES (?, ?, ?, ?, ?)',
        sid, node.subject, node.node_name, node.mastery_level, node.parent_id || null
      );
    }
  }

  async listBySubject(studentId: number, subject: string): Promise<KnowledgeNodeRecord[]> {
    const db = await getDb();
    return (await db.getAllAsync(
      'SELECT * FROM knowledge_nodes WHERE student_id = ? AND subject = ? ORDER BY mastery_level ASC',
      studentId, subject
    )) as KnowledgeNodeRecord[];
  }

  async getWeakPoints(studentId: number, subject: string, threshold = 0.4): Promise<KnowledgeNodeRecord[]> {
    const db = await getDb();
    return (await db.getAllAsync(
      'SELECT * FROM knowledge_nodes WHERE student_id = ? AND subject = ? AND mastery_level <= ? ORDER BY mastery_level ASC',
      studentId, subject, threshold
    )) as KnowledgeNodeRecord[];
  }
}

// ── Blacklist Repository ───────────────────────────────────
export class BlacklistRepository {
  async add(entry: BlacklistEntryData): Promise<void> {
    const db = await getDb();
    const existing = await db.getFirstAsync(
      'SELECT id FROM knowledge_blacklist WHERE student_id = ? AND knowledge_point = ?',
      entry.student_id, entry.knowledge_point
    );
    if (!existing) {
      await db.runAsync(
        'INSERT INTO knowledge_blacklist (student_id, knowledge_point, subject) VALUES (?, ?, ?)',
        entry.student_id, entry.knowledge_point, entry.subject
      );
    }
  }

  async list(studentId: number): Promise<BlacklistEntryData[]> {
    const db = await getDb();
    return (await db.getAllAsync(
      'SELECT * FROM knowledge_blacklist WHERE student_id = ? ORDER BY created_at DESC',
      studentId
    )) as BlacklistEntryData[];
  }

  async listBySubject(studentId: number, subject: string): Promise<BlacklistEntryData[]> {
    const db = await getDb();
    return (await db.getAllAsync(
      'SELECT * FROM knowledge_blacklist WHERE student_id = ? AND subject = ? ORDER BY created_at DESC',
      studentId, subject
    )) as BlacklistEntryData[];
  }

  async isBlacklisted(studentId: number, knowledgePoint: string): Promise<boolean> {
    const db = await getDb();
    const row = await db.getFirstAsync(
      'SELECT id FROM knowledge_blacklist WHERE student_id = ? AND knowledge_point = ?',
      studentId, knowledgePoint
    );
    return !!row;
  }
}
