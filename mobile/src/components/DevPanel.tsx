import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  ScrollView,
} from 'react-native';
import { TEST_QUESTIONS, type TestQuestion } from '../data/testQuestions';

const SUBJECTS = [
  { id: 'math', label: '数学', color: '#4A90D9' },
  { id: 'physics', label: '物理', color: '#E74C3C' },
  { id: 'chemistry', label: '化学', color: '#2ECC71' },
  { id: 'english', label: '英语', color: '#9B59B6' },
  { id: 'chinese', label: '语文', color: '#E67E22' },
  { id: 'history', label: '历史', color: '#1ABC9C' },
  { id: 'geography', label: '地理', color: '#3498DB' },
  { id: 'biology', label: '生物', color: '#27AE60' },
  { id: 'politics', label: '道法', color: '#8E44AD' },
] as const;

interface Props {
  visible: boolean;
  onSelectQuestion: (question: TestQuestion) => void;
  onExport: () => void;
  onImport: () => void;
  onLogout: () => void;
  onClose: () => void;
}

export default function DevPanel({ visible, onSelectQuestion, onExport, onImport, onLogout, onClose }: Props) {
  const [selectedSubject, setSelectedSubject] = useState('math');

  const filtered = useMemo(
    () => TEST_QUESTIONS.filter((q) => q.subject === selectedSubject),
    [selectedSubject]
  );

  const handleSelect = (q: TestQuestion) => {
    onSelectQuestion(q);
  };

  const renderQuestion = ({ item }: { item: TestQuestion }) => (
    <View style={styles.questionCard}>
      <Text style={styles.questionTitle}>{item.title}</Text>
      <Text style={styles.questionText} numberOfLines={3}>
        {item.text}
      </Text>
      <TouchableOpacity
        style={styles.sendButton}
        onPress={() => handleSelect(item)}
      >
        <Text style={styles.sendButtonText}>发送测试</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>开发者测试面板</Text>
            <Text style={styles.headerSubtitle}>选择一个测试问题发送给 AI 老师</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.exportButton} onPress={onExport}>
              <Text style={styles.exportButtonText}>导出</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.importButton} onPress={onImport}>
              <Text style={styles.importButtonText}>导入</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
              <Text style={styles.logoutText}>退出</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Subject Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.subjectRow}
          contentContainerStyle={styles.subjectContent}
        >
          {SUBJECTS.map((subj) => {
            const isActive = selectedSubject === subj.id;
            return (
              <TouchableOpacity
                key={subj.id}
                style={[
                  styles.subjectChip,
                  { backgroundColor: isActive ? subj.color : '#f0f0f0' },
                ]}
                onPress={() => setSelectedSubject(subj.id)}
              >
                <Text
                  style={[
                    styles.subjectChipText,
                    { color: isActive ? '#fff' : '#666' },
                  ]}
                >
                  {subj.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Questions */}
        <FlatList
          data={filtered}
          renderItem={renderQuestion}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>该学科暂无测试题目</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
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
    gap: 8,
    alignItems: 'center',
  },
  exportButton: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  exportButtonText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  importButton: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  importButtonText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  logoutText: {
    fontSize: 14,
    color: '#E74C3C',
    fontWeight: '600',
  },
  subjectRow: {
    maxHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  subjectContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  subjectChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  subjectChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  questionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  questionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  questionText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
  },
  sendButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignSelf: 'flex-end',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#bbb',
  },
});
