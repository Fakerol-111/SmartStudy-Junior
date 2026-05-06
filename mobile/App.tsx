import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar as RNStatusBar,
  Modal,
  Alert,
  Share,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import type { HarnessEvent, Message } from './src/core/types';
import { setLatestImage, getLatestImage } from './src/core/imageStore';
import { multimodalChat, analyzeImage } from './src/core/multimodalClient';
import { StudyHarness } from './src/core/harness';
import { ToolRegistry } from './src/tools/registry';
import { Calculator } from './src/tools/calculator';
import { WebSearch } from './src/tools/webSearch';

import ChatMessage from './src/components/ChatMessage';
import CameraCapture from './src/components/CameraCapture';
import DevLogin from './src/components/DevLogin';
import DevPanel from './src/components/DevPanel';
import type { TestQuestion } from './src/data/testQuestions';
import type { HarnessModelConfig } from './src/core/types';
import { apiUsageTracker } from './src/core/apiUsageTracker';
import { getDb } from './src/db/database';

// ── Helpers ───────────────────────────────────────────────
const SUBJECT_CN: Record<string, string> = {
  math: '数学', physics: '物理', chemistry: '化学',
  english: '英语', chinese: '语文', history: '历史',
  geography: '地理', biology: '生物', politics: '政治',
};

// Teacher intro shown on new conversation (display only, NOT sent to AI)
const TEACHER_INTRO = '你好！我是你的 AI 学习助手，我可以帮你解答数学、语文、英语等各科学习问题。我不用直接给答案的方式，而是用提问一步步引导你理解。有什么不懂的，尽管问我吧！';

// ── Model Configs (static env access for Metro inlining) ──
const HANDLER_CONFIG: HarnessModelConfig['handler'] = {
  fast: {
    apiKey: process.env.EXPO_PUBLIC_HANDLER_API_KEY || process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY || '',
    baseUrl: process.env.EXPO_PUBLIC_HANDLER_BASE_URL || process.env.EXPO_PUBLIC_DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.EXPO_PUBLIC_HANDLER_MODEL || process.env.EXPO_PUBLIC_DEEPSEEK_MODEL || 'deepseek-chat',
  },
  flagship: process.env.EXPO_PUBLIC_HANDLER_FLAGSHIP_API_KEY
    ? {
        apiKey: process.env.EXPO_PUBLIC_HANDLER_FLAGSHIP_API_KEY,
        baseUrl: process.env.EXPO_PUBLIC_HANDLER_FLAGSHIP_BASE_URL || process.env.EXPO_PUBLIC_FLAGSHIP_BASE_URL || 'https://api.deepseek.com',
        model: process.env.EXPO_PUBLIC_HANDLER_FLAGSHIP_MODEL || process.env.EXPO_PUBLIC_FLAGSHIP_MODEL || 'deepseek-chat',
      }
    : process.env.EXPO_PUBLIC_FLAGSHIP_API_KEY
      ? {
          apiKey: process.env.EXPO_PUBLIC_FLAGSHIP_API_KEY,
          baseUrl: process.env.EXPO_PUBLIC_FLAGSHIP_BASE_URL || 'https://api.deepseek.com',
          model: process.env.EXPO_PUBLIC_FLAGSHIP_MODEL || 'deepseek-chat',
        }
      : undefined,
};

const ROUTER_CONFIG: HarnessModelConfig['router'] = {
  fast: {
    apiKey: process.env.EXPO_PUBLIC_ROUTER_API_KEY || process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY || '',
    baseUrl: process.env.EXPO_PUBLIC_ROUTER_BASE_URL || process.env.EXPO_PUBLIC_DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.EXPO_PUBLIC_ROUTER_MODEL || process.env.EXPO_PUBLIC_DEEPSEEK_MODEL || 'deepseek-chat',
  },
};

const REVIEWER_CONFIG: HarnessModelConfig['reviewer'] = {
  fast: {
    apiKey: process.env.EXPO_PUBLIC_REVIEWER_API_KEY || process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY || '',
    baseUrl: process.env.EXPO_PUBLIC_REVIEWER_BASE_URL || process.env.EXPO_PUBLIC_DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.EXPO_PUBLIC_REVIEWER_MODEL || process.env.EXPO_PUBLIC_DEEPSEEK_MODEL || 'deepseek-chat',
  },
  flagship: process.env.EXPO_PUBLIC_REVIEWER_FLAGSHIP_API_KEY
    ? {
        apiKey: process.env.EXPO_PUBLIC_REVIEWER_FLAGSHIP_API_KEY,
        baseUrl: process.env.EXPO_PUBLIC_REVIEWER_FLAGSHIP_BASE_URL || process.env.EXPO_PUBLIC_FLAGSHIP_BASE_URL || 'https://api.deepseek.com',
        model: process.env.EXPO_PUBLIC_REVIEWER_FLAGSHIP_MODEL || process.env.EXPO_PUBLIC_FLAGSHIP_MODEL || 'deepseek-chat',
      }
    : process.env.EXPO_PUBLIC_FLAGSHIP_API_KEY
      ? {
          apiKey: process.env.EXPO_PUBLIC_FLAGSHIP_API_KEY,
          baseUrl: process.env.EXPO_PUBLIC_FLAGSHIP_BASE_URL || 'https://api.deepseek.com',
          model: process.env.EXPO_PUBLIC_FLAGSHIP_MODEL || 'deepseek-chat',
        }
      : undefined,
};

function createHarness(): StudyHarness {
  const registry = new ToolRegistry();
  registry.register(new Calculator());
  registry.register(new WebSearch());
  return new StudyHarness({
    handler: HANDLER_CONFIG,
    router: ROUTER_CONFIG,
    reviewer: REVIEWER_CONFIG,
  }, registry);
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'error' | 'status';
  content: string;
  timestamp: Date;
}

export default function App() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [subject, setSubject] = useState('math');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [useOcrModel, setUseOcrModel] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);

  const flatListRef = useRef<FlatList>(null);
  const harnessRef = useRef<StudyHarness | null>(null);
  const historyRef = useRef<Message[]>([]);
  const multimodalHistoryRef = useRef<{ role: string; content: string }[]>([]);
  const loadingRef = useRef(false);
  const streamIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  if (!harnessRef.current) {
    harnessRef.current = createHarness();
  }

  // Ensure student exists in DB from the start (fixes empty history)
  useEffect(() => {
    harnessRef.current?.memory.ensureStudent('同学').catch(() => {});
    // Initialize API usage tracker
    const telemetryEndpoint = process.env.EXPO_PUBLIC_TELEMETRY_ENDPOINT || '';
    if (telemetryEndpoint) {
      getDb().then(db => {
        apiUsageTracker.init(telemetryEndpoint, {
          get: (key: string) => db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key).then(r => r?.value || null),
          set: (key: string, value: string) => db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', key, value),
        });
      }).catch(() => {});
    }
  }, []);

  // Sync loadingRef with isLoading for stale-closure-safe checks
  useEffect(() => { loadingRef.current = isLoading; }, [isLoading]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 30);
  }, []);

  const handleImageCapture = useCallback(async (base64: string) => {
    setPendingImage(base64);
    setLatestImage(base64);
  }, []);

  const removePendingImage = useCallback(() => {
    setPendingImage(null);
    setLatestImage(null);
  }, []);

  const handleCancel = useCallback(() => {
    // Abort any in-flight fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Cancel the harness (if running)
    harnessRef.current?.cancel();
    // If in multimodal mode, exit it
    setUseOcrModel(false);
    multimodalHistoryRef.current = [];
  }, []);

  const sendMessage = useCallback(async (text: string, imageBase64: string | null) => {
    if ((!text && !imageBase64) || loadingRef.current) return;

    const harness = harnessRef.current!;

    const userContent = imageBase64
      ? (text ? `${text}\n\n📷 [图片已上传]` : '📷 [图片已上传]')
      : text;

    const userMsgId = Date.now().toString();
    const aiMsgId = (Date.now() + 1).toString();
    streamIdRef.current = aiMsgId;

    setMessages(prev => [...prev,
      { id: userMsgId, role: 'user', content: userContent, timestamp: new Date() },
      { id: aiMsgId, role: 'assistant', content: '', timestamp: new Date() },
    ]);
    setIsLoading(true);
    setStatusText('AI 老师正在思考...');
    scrollToEnd();

    const history: Message[] = useOcrModel ? [] : historyRef.current;

    // Create abort controller for this operation (multimodal + harness)
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const cancelSignal = abortController.signal;

    try {
      // ── Image preprocessing (before sending to handler) ──
      if (imageBase64 && !useOcrModel) {
        setStatusText('正在分析图片...');
        const ocrResult = await analyzeImage(imageBase64, cancelSignal);

        if (ocrResult.isTakeover) {
          // Complex diagram — use multimodal model directly
          setUseOcrModel(true);
          multimodalHistoryRef.current = [{ role: 'user', content: text || '' }];
          historyRef.current = [];
          const rawResponse = await multimodalChat(
            [{ role: 'user', content: text || '' }],
            imageBase64,
            cancelSignal,
          );
          let displayResponse = rawResponse;
          if (rawResponse.includes('__TOPIC_END__')) {
            setUseOcrModel(false);
            multimodalHistoryRef.current = [];
            displayResponse = rawResponse.replace('__TOPIC_END__', '').trim();
          } else {
            multimodalHistoryRef.current = [
              { role: 'user', content: text || '' },
              { role: 'assistant', content: rawResponse },
            ];
          }
          const sid = streamIdRef.current;
          setMessages(prev => prev.map(m => m.id === sid ? { ...m, content: displayResponse } : m));
          setIsLoading(false);
          setStatusText('');
          streamIdRef.current = null;
          return;
        }

        // Inject extracted text so handler doesn't need OCR tool
        if (ocrResult.text) {
          text = text ? `${text}\n\n[图片内容: ${ocrResult.text}]` : `[图片内容: ${ocrResult.text}]`;
        }
      }

      if (useOcrModel) {
        const currentImage = imageBase64 || getLatestImage();
        const multimodalHistory = [...multimodalHistoryRef.current, { role: 'user', content: text }];
        const rawResponse = await multimodalChat(multimodalHistory, currentImage || undefined, cancelSignal);
        let displayResponse = rawResponse;

        if (rawResponse.includes('__TOPIC_END__')) {
          setUseOcrModel(false);
          multimodalHistoryRef.current = [];
          historyRef.current = [];
          displayResponse = rawResponse.replace('__TOPIC_END__', '').trim();
        } else {
          multimodalHistoryRef.current = [...multimodalHistory, { role: 'assistant', content: rawResponse }];
        }

        const sid = streamIdRef.current;
        setMessages(prev => prev.map(m => m.id === sid ? { ...m, content: displayResponse } : m));
      } else {
        // Yield to React so the loading state renders before generator starts
        await new Promise(resolve => setTimeout(resolve, 16));

        const generator = harness.processMessage(text, history, subject, '同学');

        for await (const event of generator) {
          switch (event.type) {
            case 'progress': {
              // Only update the loading bar text, don't add to message list
              setStatusText(event.message);
              // Yield to React render cycle so progress text shows immediately
              await new Promise(resolve => setTimeout(resolve, 16));
              break;
            }
            case 'delta': {
              const sid = streamIdRef.current;
              setMessages(prev => prev.map(m => m.id === sid ? { ...m, content: m.content + event.content } : m));
              break;
            }
            case 'error':
              setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'error', content: event.detail || '出错了', timestamp: new Date() }]);
              scrollToEnd();
              break;
            case 'tool_call':
              setStatusText(`🔧 正在使用${event.tool_name}...`);
              break;
            case 'tool_result':
              if (event.result?.startsWith('__TAKEOVER__')) {
                setUseOcrModel(true);
                multimodalHistoryRef.current = [];
                historyRef.current = [];
              }
              break;
            case 'cancelled':
              setMessages(prev => prev.map(m =>
                m.id === streamIdRef.current
                  ? { ...m, content: m.content || '(已取消)' }
                  : m
              ));
              return; // exit the for-await loop early
            case 'done':
              if (event.history) {
                const msgs = event.history.filter(m => m.role !== 'system');
                historyRef.current = msgs;
                const lastAssistant = msgs.filter(m => m.role === 'assistant').pop();
                if (lastAssistant?.content.includes('__TOPIC_END__')) {
                  historyRef.current = [];
                  multimodalHistoryRef.current = [];
                  setMessages(prev => prev.map(m => ({
                    ...m, content: m.content.replace(/__TOPIC_END__/g, '').trim(),
                  })));
                }
              }
              break;
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === streamIdRef.current
            ? { ...m, content: m.content || '(已取消)' }
            : m
        ));
      } else {
        setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'error', content: `发生错误: ${e.message}`, timestamp: new Date() }]);
        scrollToEnd();
      }
    } finally {
      setIsLoading(false);
      setStatusText('');
      streamIdRef.current = null;
      abortControllerRef.current = null;
    }
  }, [subject, useOcrModel, scrollToEnd]);

  const handleNewConversation = useCallback(async () => {
    const harness = harnessRef.current;
    if (harness) {
      try { await harness.memory.archiveCurrentConversation(); } catch {}
    }
    historyRef.current = [];
    multimodalHistoryRef.current = [];
    setUseOcrModel(false);
    setSubject('math');
    // Show teacher intro (display only, NOT in historyRef)
    setMessages([
      { id: `intro-${Date.now()}`, role: 'assistant', content: TEACHER_INTRO, timestamp: new Date() },
    ]);
  }, []);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text && !pendingImage) return;
    setInputText('');
    const img = pendingImage;
    setPendingImage(null);
    sendMessage(text, img);
  }, [inputText, pendingImage, sendMessage]);

  const handleDevQuestion = useCallback((question: TestQuestion) => {
    setShowDevPanel(false);
    setIsDevMode(true);
    sendMessage(question.text, null);
  }, [sendMessage]);

  const handleShowHistory = useCallback(async () => {
    const harness = harnessRef.current;
    if (!harness) return;
    try {
      const list = await harness.memory.listConversations();
      setConversations(list.filter(c => c.status === 'completed' || c.status === 'active'));
      setShowHistory(true);
    } catch {}
  }, []);

  const handleLoadConversation = useCallback(async (convId: number) => {
    const harness = harnessRef.current;
    if (!harness) return;
    try {
      const { messages: msgs, subject: convSubject } = await harness.memory.loadConversation(convId);
      setSubject(convSubject);
      const displayMsgs: DisplayMessage[] = msgs.map(m => ({
        id: `hist-${m.id}`,
        role: (m.role === 'assistant' || m.role === 'user' ? m.role : 'assistant') as 'user' | 'assistant' | 'error' | 'status',
        content: m.content,
        timestamp: new Date(m.created_at || Date.now()),
      }));
      const historyMsgs: Message[] = msgs.map(m => ({
        role: m.role as Message['role'],
        content: m.content,
      }));
      setMessages(displayMsgs);
      historyRef.current = historyMsgs.filter(m => m.role !== 'system');
      setShowHistory(false);
    } catch (e: any) {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'error', content: `加载失败: ${e.message}`, timestamp: new Date() }]);
    }
  }, []);

  const handleExportData = useCallback(async () => {
    const harness = harnessRef.current;
    if (!harness) return;
    try {
      await harness.memory.ensureStudent('同学');
      const json = await harness.memory.exportAllData('同学');
      await Share.share({ message: json, title: 'SmartStudy 数据导出' });
    } catch (e: any) {
      Alert.alert('导出失败', e.message);
    }
  }, []);

  const handleImportData = useCallback(async () => {
    try {
      const { getDocumentAsync } = require('expo-document-picker');
      const result = await getDocumentAsync({ type: 'application/json' });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      const { readAsStringAsync } = require('expo-file-system');
      const content = await readAsStringAsync(uri);
      const harness = harnessRef.current;
      if (!harness) return;
      await harness.memory.importAllData(content, '同学');
      historyRef.current = [];
      multimodalHistoryRef.current = [];
      setUseOcrModel(false);
      setMessages([{ id: `import-${Date.now()}`, role: 'status', content: '数据已成功导入，请开始新对话', timestamp: new Date() }]);
      setSubject('math');
      Alert.alert('导入成功', '所有数据已恢复。如有旧对话，可在历史记录中查看。');
    } catch (e: any) {
      Alert.alert('导入失败', e.message || '请选择有效的 JSON 文件');
    }
  }, []);

  const renderMessage = useCallback(({ item }: { item: DisplayMessage }) => (
    <ChatMessage
      message={{
        role: item.role === 'error' ? 'assistant' : item.role,
        content: item.role === 'error' ? `⚠️ ${item.content}`
          : item.role === 'status' ? `⏳ ${item.content}`
          : item.content,
      }}
      isStatus={item.role === 'status'}
    />
  ), []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>个人AI学习助手</Text>
          <Text style={styles.headerSubtitle}>
            {useOcrModel ? '🖼️ 多模态模式' : statusText || '随时问我问题'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={handleNewConversation}>
            <Text style={styles.headerBtnIcon}>📝</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleShowHistory}>
            <Text style={styles.headerBtnIcon}>📋</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => {
            if (isDevMode) setShowDevPanel(true);
            else setShowDevLogin(true);
          }}>
            <Text style={styles.headerBtnIcon}>{isDevMode ? '🔓' : '🔧'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.contentArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={flatListRef}
          style={styles.messageList}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>有什么问题想问？</Text>
              <Text style={styles.emptySubtitle}>直接输入你的问题，AI 老师为你解答</Text>
            </View>
          }
        />

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#4A90D9" />
            <Text style={styles.loadingText}>{statusText || 'AI 老师正在思考...'}</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        )}

        {pendingImage && (
          <View style={styles.imageBanner}>
            <Text style={styles.imageBannerText}>📎 图片已选择</Text>
            <TouchableOpacity onPress={removePendingImage}>
              <Text style={styles.removeImageText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputContainer}>
          <CameraCapture onImageCapture={handleImageCapture} disabled={isLoading} />
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="输入你的问题..."
            placeholderTextColor="#999"
            multiline
            maxLength={2000}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[styles.sendButton, ((!inputText.trim() && !pendingImage) || isLoading) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={(!inputText.trim() && !pendingImage) || isLoading}
          >
            <Text style={styles.sendButtonText}>发送</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <DevLogin
        visible={showDevLogin}
        onLoginSuccess={() => { setIsDevMode(true); setShowDevLogin(false); setShowDevPanel(true); }}
        onClose={() => setShowDevLogin(false)}
      />
      <DevPanel
        visible={showDevPanel}
        onSelectQuestion={handleDevQuestion}
        onExport={handleExportData}
        onImport={handleImportData}
        onLogout={() => { setIsDevMode(false); setShowDevPanel(false); }}
        onClose={() => setShowDevPanel(false)}
      />

      {/* History Panel */}
      <Modal visible={showHistory} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.historyPanel}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>历史记录</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Text style={styles.historyClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {conversations.length === 0 ? (
              <View style={styles.historyEmpty}>
                <Text style={styles.historyEmptyText}>暂无历史记录</Text>
              </View>
            ) : (
              <FlatList
                data={conversations}
                keyExtractor={item => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.historyItem}
                    onPress={() => handleLoadConversation(item.id)}
                  >
                    <Text style={styles.historyItemSubject}>
                      {SUBJECT_CN[item.subject] || item.subject || '综合'}
                    </Text>
                    <Text style={styles.historyItemDate}>
                      {item.created_at?.split('T')[0] || ''}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 0,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnIcon: {
    fontSize: 18,
  },
  contentArea: {
    flex: 1,
  },
  messageList: {
    flex: 1,
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#bbb',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f0f6ff',
    borderTopWidth: 1,
    borderTopColor: '#d6e4f5',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#666',
    maxWidth: '60%',
  },
  cancelButton: {
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#e74c3c',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    fontSize: 16,
    color: '#1a1a1a',
  },
  sendButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  imageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#d0e0f8',
  },
  imageBannerText: {
    fontSize: 13,
    color: '#4A90D9',
    marginRight: 8,
  },
  removeImageText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
  },

  // ── History Panel ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  historyPanel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
    paddingBottom: 24,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  historyClose: {
    fontSize: 20,
    color: '#999',
    fontWeight: '600',
    padding: 4,
  },
  historyEmpty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  historyEmptyText: {
    fontSize: 15,
    color: '#bbb',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  historyItemSubject: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  historyItemDate: {
    fontSize: 13,
    color: '#999',
  },
});
