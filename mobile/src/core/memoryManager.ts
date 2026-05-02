import {
  StudentRepository,
  ConversationRepository,
  MessageRepository,
  MistakeRepository,
  KnowledgeNodeRepository,
  BlacklistRepository,
  Conversation,
  MessageRecord,
} from '../db/repository';
import { clearAllDbData } from '../db/database';
import type { StudentProfileData, TeacherSoulData } from './types';

export class MemoryManager {
  studentRepo = new StudentRepository();
  conversationRepo = new ConversationRepository();
  messageRepo = new MessageRepository();
  mistakeRepo = new MistakeRepository();
  knowledgeRepo = new KnowledgeNodeRepository();
  blacklistRepo = new BlacklistRepository();

  private currentStudentId: number | null = null;
  private currentConversationId: number | null = null;

  // ── Student ──────────────────────────────────────────────
  async ensureStudent(name: string): Promise<number> {
    let student = await this.studentRepo.findByName(name);
    if (!student) {
      student = await this.studentRepo.create({ name, grade: '初一', subjects: '[]' });
    }
    this.currentStudentId = student.id!;
    return student.id!;
  }

  getStudentId(): number | null {
    return this.currentStudentId;
  }

  async getProfile(): Promise<StudentProfileData | null> {
    if (!this.currentStudentId) return null;
    return this.studentRepo.getProfile(this.currentStudentId);
  }

  async updateProfile(profile: StudentProfileData): Promise<void> {
    if (!this.currentStudentId) return;
    await this.studentRepo.updateProfile(this.currentStudentId, profile);
  }

  async getSoul(): Promise<TeacherSoulData | null> {
    if (!this.currentStudentId) return null;
    return this.studentRepo.getSoul(this.currentStudentId);
  }

  async updateSoul(soul: TeacherSoulData): Promise<void> {
    if (!this.currentStudentId) return;
    await this.studentRepo.updateSoul(this.currentStudentId, soul);
  }

  async incrementConversationCount(): Promise<number> {
    if (!this.currentStudentId) return 0;
    await this.studentRepo.incrementConversationCount(this.currentStudentId);
    const student = await this.studentRepo.get(this.currentStudentId);
    return student?.conversation_count || 0;
  }

  // ── Conversation ─────────────────────────────────────────
  async getOrCreateConversation(subject: string, intent: string): Promise<number> {
    if (this.currentConversationId) {
      return this.currentConversationId;
    }
    const conv = await this.conversationRepo.create({
      student_id: this.currentStudentId!,
      subject,
      intent,
      title: '',
    });
    this.currentConversationId = conv.id!;
    return conv.id!;
  }

  async archiveCurrentConversation(): Promise<void> {
    if (this.currentConversationId) {
      await this.conversationRepo.markCompleted(this.currentConversationId);
      this.currentConversationId = null;
    }
  }

  /** Get the most recently completed conversation (for topic recovery) */
  async getLastCompletedConversation(): Promise<{ id: number; messages: MessageRecord[]; subject: string } | null> {
    if (!this.currentStudentId) return null;
    const all = await this.conversationRepo.listByStudent(this.currentStudentId);
    const last = all.find(c => c.status === 'completed');
    if (!last || !last.id) return null;
    const messages = await this.messageRepo.listByConversation(last.id);
    return { id: last.id, messages, subject: last.subject };
  }

  /** Restore a completed conversation back to active */
  async restoreConversation(id: number): Promise<void> {
    await this.conversationRepo.markActive(id);
    this.currentConversationId = id;
  }

  async startNewConversation(subject: string, intent: string): Promise<number> {
    await this.archiveCurrentConversation();
    return this.getOrCreateConversation(subject, intent);
  }

  // ── Messages ─────────────────────────────────────────────
  async saveMessage(
    role: string,
    content: string,
    toolName?: string,
    toolArgs?: string,
    toolResult?: string,
  ): Promise<MessageRecord> {
    if (!this.currentConversationId) throw new Error('No active conversation');
    return this.messageRepo.create({
      conversation_id: this.currentConversationId,
      role,
      content,
      tool_name: toolName,
      tool_args: toolArgs,
      tool_result: toolResult,
    });
  }

  async getHistory(): Promise<MessageRecord[]> {
    if (!this.currentConversationId) return [];
    return this.messageRepo.listByConversation(this.currentConversationId);
  }

  // ── Conversation History ─────────────────────────────────
  async listConversations(): Promise<Conversation[]> {
    if (!this.currentStudentId) return [];
    return this.conversationRepo.listByStudent(this.currentStudentId);
  }

  async loadConversation(conversationId: number): Promise<{
    messages: MessageRecord[];
    subject: string;
    title: string;
  }> {
    this.currentConversationId = conversationId;
    const conv = await this.conversationRepo.get(conversationId);
    const messages = await this.messageRepo.listByConversation(conversationId);
    return {
      messages,
      subject: conv?.subject || 'math',
      title: conv?.title || '',
    };
  }

  // ── Mistakes / Knowledge / Blacklist ────────────────────
  async getWeakPoints(subject: string): Promise<string[]> {
    if (!this.currentStudentId) return [];
    const nodes = await this.knowledgeRepo.getWeakPoints(this.currentStudentId, subject);
    return nodes.map(n => n.node_name);
  }

  async getBlacklist(subject: string): Promise<string[]> {
    if (!this.currentStudentId) return [];
    const entries = await this.blacklistRepo.listBySubject(this.currentStudentId, subject);
    return entries.map(e => e.knowledge_point);
  }

  // ── Export / Import ─────────────────────────────────────
  async exportAllData(studentName: string): Promise<string> {
    const student = await this.studentRepo.findByName(studentName);
    if (!student) throw new Error(`学生 "${studentName}" 不存在`);

    const sid = student.id!;
    const conversations = await this.conversationRepo.listByStudent(sid);
    const convData: any[] = [];
    for (const conv of conversations) {
      const messages = await this.messageRepo.listByConversation(conv.id!);
      convData.push({
        subject: conv.subject,
        intent: conv.intent,
        title: conv.title,
        status: conv.status,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          tool_name: m.tool_name,
          tool_args: m.tool_args,
          tool_result: m.tool_result,
        })),
      });
    }

    const mistakes = await this.mistakeRepo.listByStudent(sid);
    const blacklist = await this.blacklistRepo.list(sid);

    const allKns: any[] = [];
    const subjects = [...new Set(conversations.map(c => c.subject).concat(mistakes.map(m => m.subject)))];
    for (const subj of subjects) {
      const nodes = await this.knowledgeRepo.listBySubject(sid, subj);
      allKns.push(...nodes);
    }

    let profile = null;
    let soul = null;
    try { profile = await this.studentRepo.getProfile(sid); } catch {}
    try { soul = await this.studentRepo.getSoul(sid); } catch {}

    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      student: { name: student.name, grade: student.grade, profile, soul, conversation_count: student.conversation_count || 0 },
      conversations: convData,
      mistakes: mistakes.map(m => ({
        subject: m.subject, question: m.question, correct_answer: m.correct_answer,
        student_answer: m.student_answer, analysis: m.analysis, knowledge_points: m.knowledge_points, mistake_type: m.mistake_type,
      })),
      knowledgeNodes: allKns.map(n => ({
        subject: n.subject, node_name: n.node_name, mastery_level: n.mastery_level, parent_id: n.parent_id,
      })),
      blacklist: blacklist.map(b => ({ subject: b.subject, knowledge_point: b.knowledge_point })),
    }, null, 2);
  }

  async importAllData(jsonString: string, studentName: string): Promise<void> {
    const data = JSON.parse(jsonString);
    await clearAllDbData();
    this.currentStudentId = null;
    this.currentConversationId = null;

    const student = await this.studentRepo.create({
      name: studentName, grade: data.student?.grade || '初一', subjects: '[]',
      profile: data.student?.profile ? JSON.stringify(data.student.profile) : '{}',
      soul: data.student?.soul ? JSON.stringify(data.student.soul) : '{}',
    });
    this.currentStudentId = student.id!;

    const count = data.student?.conversation_count || 0;
    for (let i = 0; i < count; i++) await this.studentRepo.incrementConversationCount(this.currentStudentId);

    if (Array.isArray(data.conversations)) {
      for (const conv of data.conversations) {
        const created = await this.conversationRepo.create({
          student_id: this.currentStudentId, subject: conv.subject || 'general',
          intent: conv.intent || 'teach', title: conv.title || '', status: conv.status || 'completed',
        });
        const cid = created.id!;
        if (Array.isArray(conv.messages)) {
          for (const msg of conv.messages) {
            await this.messageRepo.create({
              conversation_id: cid, role: msg.role, content: msg.content || '',
              tool_name: msg.tool_name || '', tool_args: msg.tool_args || '', tool_result: msg.tool_result || '',
            });
          }
        }
      }
    }

    if (Array.isArray(data.mistakes)) {
      for (const m of data.mistakes) {
        await this.mistakeRepo.create({
          student_id: this.currentStudentId, subject: m.subject || '', question: m.question || '',
          correct_answer: m.correct_answer || '', student_answer: m.student_answer || '',
          analysis: m.analysis || '', knowledge_points: m.knowledge_points || '[]', mistake_type: m.mistake_type || 'other',
        });
      }
    }

    if (Array.isArray(data.knowledgeNodes)) {
      for (const n of data.knowledgeNodes) {
        await this.knowledgeRepo.upsert({
          student_id: this.currentStudentId, subject: n.subject || '', node_name: n.node_name || '',
          mastery_level: n.mastery_level ?? 0, parent_id: n.parent_id || null,
        });
      }
    }

    if (Array.isArray(data.blacklist)) {
      for (const b of data.blacklist) {
        await this.blacklistRepo.add({
          student_id: this.currentStudentId, subject: b.subject || '', knowledge_point: b.knowledge_point || '',
        });
      }
    }
  }
}
