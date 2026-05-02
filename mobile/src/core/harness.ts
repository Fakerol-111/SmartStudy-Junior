import type { HarnessEvent, Message, DeepSeekConfig, RouterResult, Intent, HarnessModelConfig, StudentProfileData } from './types';
import { DeepSeekClient } from './deepseek';
import { Router } from './router';
import { Reviewer } from './reviewer';
import { Teacher } from './teacher';
import { MemoryManager } from './memoryManager';
import { ToolRegistry } from '../tools/registry';
import { TopicDetector } from './topicDetector';
import { buildSystemPrompt } from './systemPrompt';
import { checkInput, checkOutput } from './safety';

export class StudyHarness {
  private router: Router;
  private reviewer: Reviewer;
  private topicDetector: TopicDetector;
  private teacher: Teacher;
  private fastClient: DeepSeekClient;
  private flagshipClient: DeepSeekClient | null;
  private currentClient: DeepSeekClient;
  private registry: ToolRegistry;
  memory: MemoryManager;

  private currentIntent: Intent = 'teach';
  private currentSubjects: string[] = [];
  private modelUpgraded = false;
  private previousProfileSnapshot: string | null = null;
  private abortController: AbortController | null = null;

  constructor(
    modelConfig: HarnessModelConfig,
    registry: ToolRegistry,
  ) {
    this.fastClient = new DeepSeekClient(modelConfig.handler.fast);
    this.flagshipClient = modelConfig.handler.flagship
      ? new DeepSeekClient(modelConfig.handler.flagship)
      : null;
    this.currentClient = this.fastClient;
    this.registry = registry;
    this.router = new Router(modelConfig.router.fast); // Router always uses fast
    this.reviewer = new Reviewer(
      modelConfig.reviewer.flagship || modelConfig.reviewer.fast,
    );
    this.topicDetector = new TopicDetector(modelConfig.router.fast);
    this.teacher = new Teacher(this.fastClient, registry);
    this.memory = new MemoryManager();
  }

  /** Cancel the currently running operation */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async *processMessage(
    text: string,
    history: Message[],
    subject: string,
    studentName: string,
  ): AsyncGenerator<HarnessEvent> {
    // Create abort controller for this run
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      // 1. Safety check
      const safety = checkInput(text);
      if (!safety.passed) {
        yield { type: 'error', detail: safety.reason };
        return;
      }

      let isContinuation = false;
      let detectedSubject = subject;

      // 2. Topic detection (only for follow-ups)
      if (history.length > 0) {
        if (signal.aborted) { yield { type: 'cancelled' }; return; }
        const topicResult = await this.topicDetector.detect(text, history, subject, signal);
        if (signal.aborted) { yield { type: 'cancelled' }; return; }
        if (topicResult.topicChanged) {
          yield { type: 'progress', stage: 'router', message: '让我看看你问的是什么……' };
          await this.memory.archiveCurrentConversation();
          history = [];
          detectedSubject = topicResult.newSubject || subject;
        } else if (topicResult.restorePrevious) {
          yield { type: 'progress', stage: 'router', message: '好的，继续刚才的题目……' };
          await this.memory.archiveCurrentConversation();
          const prevConv = await this.memory.getLastCompletedConversation();
          if (prevConv) {
            history = prevConv.messages.map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }));
            await this.memory.restoreConversation(prevConv.id);
            detectedSubject = prevConv.subject;
          }
          isContinuation = true;
        } else {
          isContinuation = true;
        }
      }

      // 3. Router (always runs — determines current intent for every message)
      let route: RouterResult;
      try {
        if (signal.aborted) { yield { type: 'cancelled' }; return; }
        route = await this.router.route(text, detectedSubject, history.length > 0, signal);
      } catch (e: any) {
        route = { intent: 'teach', subjects: [detectedSubject], newTopic: false, targetHandler: 'teach', confidence: 0.5 };
      }
      this.currentIntent = route.intent;
      this.currentSubjects = route.subjects;

      this.modelUpgraded = false;

      // 4. Handle unknown intent
      if (route.intent === 'unknown') {
        yield {
          type: 'delta',
          content: '我不太明白你的意思，能换个说法吗？😊',
        };
        yield { type: 'done', history: [] };
        return;
      }

      // 5. Get profile & soul for context
      let studentProfile: string | undefined;
      let teacherSoul: string | undefined;
      try {
        const profile = await this.memory.getProfile();
        const soul = await this.memory.getSoul();
        if (profile) studentProfile = JSON.stringify(profile);
        if (soul) teacherSoul = JSON.stringify(soul);
      } catch {
        // Memory not available yet
      }

      // 6. Get blacklist for reviewer
      let blacklist: string[] = [];
      try {
        blacklist = await this.memory.getBlacklist(route.subjects[0] || detectedSubject);
      } catch { /* ignore */ }

      // 7. Execute handler
      const handlerSubject = route.subjects[0] || detectedSubject;
      const handlerHistoryInput: Message[] = [
        ...history,
        { role: 'user', content: text },
      ];
      const handlerContext = {
        intent: route.intent,
        subjects: route.subjects,
        studentName,
        history: handlerHistoryInput,
        subject: handlerSubject,
        studentProfile,
        teacherSoul,
        isContinuation,
      };

      // Save conversation
      try {
        await this.memory.getOrCreateConversation(handlerSubject, route.intent);
      } catch { /* DB not ready */ }

      // Yield review progress BEFORE streaming (user sees it during response)
      if (!isContinuation && route.intent !== 'feedback') {
        yield { type: 'progress', stage: 'review', message: '老师检查一下这样讲合不合适……' };
      }

      // Execute handler and relay events
      let finalResponse = '';
      let handlerHistory: Message[] = [];

      try {
        if (signal.aborted) { yield { type: 'cancelled' }; return; }
        const generator = this.teacher.execute(handlerContext, signal);
        for await (const event of generator) {
          if (signal.aborted) { yield { type: 'cancelled' }; return; }
          if (event.type === 'delta') {
            finalResponse += event.content;
          }
          if (event.type === 'done' && event.history) {
            handlerHistory = event.history;
          }
          yield event;
        }
      } catch (e: any) {
        if (e.name === 'AbortError') {
          yield { type: 'cancelled' };
          return;
        }
        yield { type: 'error', detail: `Handler 执行失败: ${e.message}` };
        return;
      }

      // 8. Review the output (skip for same-topic continuations)
      if (!isContinuation && finalResponse && route.intent !== 'feedback') {
        if (signal.aborted) { yield { type: 'cancelled' }; return; }
        const reviewResult = await this.reviewer.review(
          text,
          finalResponse,
          handlerSubject,
          blacklist,
          signal,
        );

        if (!reviewResult.passed && !this.modelUpgraded && this.flagshipClient) {
          yield { type: 'progress', stage: 'generate', message: '这个老师不太行，再为您换一个老师……' };

          this.modelUpgraded = true;
          this.currentClient = this.flagshipClient;

          const upgradeTeacher = new Teacher(this.flagshipClient, this.registry);

          try {
            if (signal.aborted) { yield { type: 'cancelled' }; return; }
            const retryGenerator = upgradeTeacher.execute(handlerContext, signal);
            let retryResponse = '';
            for await (const event of retryGenerator) {
              if (signal.aborted) { yield { type: 'cancelled' }; return; }
              if (event.type === 'delta') {
                retryResponse += event.content;
                yield event;
              }
            }
            if (retryResponse) finalResponse = retryResponse;
          } catch (e: any) {
            if (e.name === 'AbortError') {
              yield { type: 'cancelled' };
              return;
            }
            /* use original fast response on other errors */ }
        }
      }

      // 9. Safety check output
      const outputSafety = checkOutput(finalResponse);
      if (!outputSafety.passed) {
        yield { type: 'error', detail: outputSafety.reason };
        return;
      }

      // 10. Save to memory
      try {
        if (signal.aborted) { yield { type: 'cancelled' }; return; }
        await this.memory.saveMessage('user', text);
        await this.memory.saveMessage('assistant', finalResponse);
        await this.memory.incrementConversationCount();

        // Encouragement: triggered by actual profile progress (not by conversation count)
        let encouragementContent = '';
        if (!finalResponse.includes('__TOPIC_END__')) {
          encouragementContent = await this.generateEncouragement(handlerHistory, signal);
        }

        if (encouragementContent) {
          yield { type: 'delta', content: '\n\n' + encouragementContent };
          const encouragementMsg: Message = { role: 'assistant', content: encouragementContent };
          yield { type: 'done', history: [...handlerHistory, encouragementMsg] };
        }
      } catch { /* DB not ready */ }
    } finally {
      this.abortController = null;
    }
  }

  /** Generate encouragement only when profile shows measurable progress */
  private async generateEncouragement(conversationHistory: Message[], signal?: AbortSignal): Promise<string> {
    try {
      const profile = await this.memory.getProfile();
      let progressNote = '';

      // Check profile-based progress
      if (profile && this.previousProfileSnapshot) {
        const prev = JSON.parse(this.previousProfileSnapshot) as StudentProfileData;
        if (profile.weakPoints.length < prev.weakPoints.length) {
          const mastered = prev.weakPoints.filter(
            (wp: string) => !profile.weakPoints.includes(wp)
          );
          progressNote = mastered.length > 0
            ? `学生之前在"${mastered.join('、')}"上是薄弱点，现在已经进步了。`
            : '学生的薄弱点减少了，有明显的进步。';
        }
      }

      // Update snapshot for next comparison
      if (profile) {
        this.previousProfileSnapshot = JSON.stringify(profile);
      }

      // Only generate encouragement if actual progress detected
      if (!progressNote) return '';

      // Extract recent user messages for context
      const recentExchanges = conversationHistory
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-4)
        .map(m => `${m.role === 'user' ? '学生' : '老师'}: ${m.content.slice(0, 100)}`)
        .join('\n');

      const prompt = `你是一位热情的初中老师。${progressNote}\n\n最近对话片段:\n${recentExchanges || '(无)'}\n\n请根据以上内容写一段简短的鼓励语（40字以内），具体指出学生的进步并大力表扬。只说鼓励的话，不要格式标记。`;

      const { message } = await this.fastClient.chatCompletion(
        [{ role: 'user', content: prompt }],
        undefined,
        0.8,
        150,
        signal,
      );
      return message.content || '';
    } catch {
      return '';
    }
  }
}
