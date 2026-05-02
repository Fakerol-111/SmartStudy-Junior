import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

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
];

interface Props {
  selected: string;
  onSelect: (subject: string) => void;
}

export default function SubjectSelector({ selected, onSelect }: Props) {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {SUBJECTS.map((subj) => {
          const isActive = selected === subj.id;
          return (
            <TouchableOpacity
              key={subj.id}
              style={[
                styles.chip,
                { backgroundColor: isActive ? subj.color : '#f0f0f0' },
              ]}
              onPress={() => onSelect(subj.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isActive ? '#fff' : '#666' },
                ]}
              >
                {subj.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
