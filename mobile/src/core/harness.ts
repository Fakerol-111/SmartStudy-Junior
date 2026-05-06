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
import prompts from '../../prompts/instructions.json';

const PROFILE_PROMPT = prompts.profile.system_prompt.join('\n');
const GUIDANCE_PROMPT = prompts.guidance.student_prompt.join('\n');

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
  private abortController: AbortController | null = null;

  constructor(
    modelConfig: HarnessModelConfig,
    registry: ToolRegistry,
  ) {
    this.fastClient = new DeepSeekClient(modelConfig.handler.fast, 'handler');
    this.flagshipClient = modelConfig.handler.flagship
      ? new DeepSeekClient(modelConfig.handler.flagship, 'handler')
      : null;
    this.currentClient = this.fastClient;
    this.registry = registry;
    this.router = new Router(modelConfig.router.fast, 'router');
    this.reviewer = new Reviewer(
      modelConfig.reviewer.flagship || modelConfig.reviewer.fast,
      'reviewer',
    );
    this.topicDetector = new TopicDetector(modelConfig.router.fast, 'topicDetector');
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

      // 10. Save to memory + periodic profile update (every 5 conversations)
      try {
        if (signal.aborted) { yield { type: 'cancelled' }; return; }
        await this.memory.saveMessage('user', text);
        await this.memory.saveMessage('assistant', finalResponse);
        const conversationCount = await this.memory.incrementConversationCount();

        // Every 5 conversations: analyze history, update profile, encourage + guide
        if (conversationCount > 0 && conversationCount % 5 === 0 && !finalResponse.includes('__TOPIC_END__')) {
          yield { type: 'progress', stage: 'review', message: '老师帮你总结一下这段时间的学习情况……' };
          const summary = await this.analyzeAndUpdateProfile(handlerHistory, signal);
          if (summary) {
            yield { type: 'delta', content: '\n\n' + summary };
            const summaryMsg: Message = { role: 'assistant', content: summary };
            yield { type: 'done', history: [...handlerHistory, summaryMsg] };
          }
        }
      } catch { /* DB not ready */ }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Every 5 conversations: analyze history, update student profile,
   * and return encouragement text if progress detected.
   */
  private async analyzeAndUpdateProfile(conversationHistory: Message[], signal?: AbortSignal): Promise<string> {
    try {
      // 1. Get old profile
      const oldProfile = await this.memory.getProfile();

      // 2. Extract recent dialogue (exclude system prompts)
      const recentMessages = conversationHistory
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-30)
        .map(m => `${m.role === 'user' ? '学生' : '老师'}: ${m.content.slice(0, 300)}`)
        .join('\n');

      if (!recentMessages.trim()) return '';

      // 3. Ask AI to analyze and generate updated profile
      const existingHint = oldProfile
        ? `\n\n该生当前的画像（结合新对话进行增量更新，不要丢失已有信息）:\n${JSON.stringify(oldProfile, null, 2)}`
        : '\n\n该生暂无画像，请根据对话建立。';

      const prompt = `${PROFILE_PROMPT}${existingHint}

最近对话:
${recentMessages}`;

      const { message } = await this.fastClient.chatCompletion(
        [{ role: 'user', content: prompt }],
        undefined,
        0.3,
        1024,
        signal,
      );

      const text = message.content.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return '';

      const parsed = JSON.parse(jsonMatch[0]);
      const newProfile: StudentProfileData = {
        description: parsed.description || oldProfile?.description || '',
        scores: { ...oldProfile?.scores, ...(parsed.scores || {}) },
        weakPoints: parsed.weakPoints || oldProfile?.weakPoints || [],
        strengths: parsed.strengths || oldProfile?.strengths || [],
        commonMistakes: parsed.commonMistakes || oldProfile?.commonMistakes || [],
        learningStyle: parsed.learningStyle || oldProfile?.learningStyle || '',
        confidence: parsed.confidence || oldProfile?.confidence || '',
        focus: parsed.focus || oldProfile?.focus || '',
        updatedAt: new Date().toISOString(),
      };

      // 4. Detect progress: did any weak points get mastered?
      let encouragementContent = '';
      if (oldProfile && oldProfile.weakPoints.length > 0) {
        const mastered = oldProfile.weakPoints.filter(
          (wp: string) => !newProfile.weakPoints.includes(wp)
        );
        if (mastered.length > 0) {
          const progressNote = `学生之前在"${mastered.join('、')}"上是薄弱点，现在已经掌握了。`;
          const excerpt = recentMessages.length > 100
            ? recentMessages.slice(0, 100) + '…'
            : recentMessages;

          const encouragePrompt = `你是一位热情的初中老师。${progressNote}\n\n近期对话:\n${excerpt || '(无)'}\n\n写一段简短的鼓励语（40字以内），具体指出学生的进步并大力表扬。只说鼓励的话，不要格式标记。`;

          const { message: encMsg } = await this.fastClient.chatCompletion(
            [{ role: 'user', content: encouragePrompt }],
            undefined,
            0.8,
            150,
            signal,
          );
          encouragementContent = encMsg.content || '';
        }
      }

      // 5. Save updated profile
      await this.memory.updateProfile(newProfile);

      // 6. Generate guidance if there are remaining weak points
      let guidanceContent = '';
      if (newProfile.weakPoints.length > 0) {
        const strengthsText = newProfile.strengths.length > 0
          ? `已掌握: ${newProfile.strengths.join('、')}`
          : '';
        const mistakesText = newProfile.commonMistakes && newProfile.commonMistakes.length > 0
          ? `\n常见错误: ${newProfile.commonMistakes.join('、')}`
          : '';
        const styleText = newProfile.learningStyle ? `\n学习特点: ${newProfile.learningStyle}` : '';

        const guidanceInput = `当前画像:
- 薄弱点: ${newProfile.weakPoints.join('、')}
- ${strengthsText}${mistakesText}${styleText}`;

        const { message: guideMsg } = await this.fastClient.chatCompletion(
          [{ role: 'user', content: `${GUIDANCE_PROMPT}\n\n${guidanceInput}` }],
          undefined,
          0.7,
          200,
          signal,
        );
        guidanceContent = guideMsg.content || '';
      }

      // 7. Combine: encouragement first, then guidance
      const parts = [encouragementContent, guidanceContent].filter(Boolean);
      return parts.length > 0 ? parts.join('\n\n') : '';
    } catch {
      return '';
    }
  }
}
