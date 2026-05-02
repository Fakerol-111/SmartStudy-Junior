import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import type { Message } from '../core/types';
import MathFormula from './MathFormula';

interface ChatMessageData {
  role: string;
  content: string;
}

interface Props {
  message: ChatMessageData;
  isStatus?: boolean;
}

const CONTAINER_MARGIN = 24;   // 12px horizontal margin on each side
const BUBBLE_MAX_WIDTH_PCT = 0.85;
const BUBBLE_PADDING = 24;     // 12px on each side

export default function ChatMessage({ message, isStatus }: Props) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const isSystem = message.role === 'system';
  const { width: screenWidth } = useWindowDimensions();

  // Calculate the max content width available for WebView
  const maxContentWidth = (screenWidth - CONTAINER_MARGIN) * BUBBLE_MAX_WIDTH_PCT - BUBBLE_PADDING;

  if (isSystem || isTool) return null;

  if (isStatus) {
    return (
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{message.content}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.roleText, isUser ? styles.userRole : styles.aiRole]}>
          {isUser ? '你' : 'AI 老师'}
        </Text>
        {isUser ? (
          <Text
            style={[styles.content, styles.userContent]}
            selectable={true}
          >
            {message.content}
          </Text>
        ) : (
          <MathFormula
            content={message.content}
            textColor="#1a1a1a"
            width={maxContentWidth}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 12,
    flexDirection: 'row',
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  aiContainer: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 12,
  },
  userBubble: {
    backgroundColor: '#4A90D9',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  userRole: {
    color: 'rgba(255,255,255,0.8)',
  },
  aiRole: {
    color: '#666',
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
  },
  userContent: {
    color: '#fff',
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#999',
    textAlign: 'center',
  },
});
