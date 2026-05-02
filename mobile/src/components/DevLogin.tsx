import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
} from 'react-native';

const DEV_ACCOUNT = '123456';
const DEV_PASSWORD = '123456';

interface Props {
  visible: boolean;
  onLoginSuccess: () => void;
  onClose: () => void;
}

export default function DevLogin({ visible, onLoginSuccess, onClose }: Props) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (account === DEV_ACCOUNT && password === DEV_PASSWORD) {
      setAccount('');
      setPassword('');
      onLoginSuccess();
    } else {
      Alert.alert('登录失败', '账号或密码错误，请重试');
    }
  };

  const handleClose = () => {
    setAccount('');
    setPassword('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>开发者模式</Text>
          <Text style={styles.subtitle}>请输入开发者账号和密码</Text>

          <TextInput
            style={styles.input}
            value={account}
            onChangeText={setAccount}
            placeholder="账号"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            maxLength={20}
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="密码"
            placeholderTextColor="#999"
            secureTextEntry
            maxLength={20}
          />

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>登录</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    height: 48,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 12,
  },
  loginButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 16,
  },
  cancelText: {
    fontSize: 15,
    color: '#999',
  },
});
