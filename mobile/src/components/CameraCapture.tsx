import React, { useCallback, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  View,
  Modal,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface Props {
  onImageCapture: (base64: string) => void;
  disabled?: boolean;
}

export default function CameraCapture({ onImageCapture, disabled }: Props) {
  const [menuVisible, setMenuVisible] = useState(false);

  const takePhoto = useCallback(async () => {
    setMenuVisible(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要相机权限', '请在设置中允许访问相机');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      onImageCapture(result.assets[0].base64);
    }
  }, [onImageCapture]);

  const pickFromAlbum = useCallback(async () => {
    setMenuVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要相册权限', '请在设置中允许访问相册');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      onImageCapture(result.assets[0].base64);
    }
  }, [onImageCapture]);

  const handlePress = () => setMenuVisible(true);

  return (
    <>
      <TouchableOpacity
        style={[styles.button, disabled && styles.disabled]}
        onPress={handlePress}
        disabled={disabled}
      >
        <Text style={styles.icon}>📷</Text>
      </TouchableOpacity>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>选择图片来源</Text>
            <TouchableOpacity style={styles.menuItem} onPress={takePhoto}>
              <Text style={styles.menuItemText}>📸 拍照</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={pickFromAlbum}>
              <Text style={styles.menuItemText}>🖼️ 从相册选择</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.cancelItem]}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  icon: {
    fontSize: 20,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menu: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  menuItemText: {
    fontSize: 16,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  cancelItem: {
    backgroundColor: '#f0f0f0',
    marginTop: 4,
  },
  cancelText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});
