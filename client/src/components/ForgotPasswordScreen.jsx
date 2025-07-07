import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { styles } from '../style/style';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleReset = async () => {
    if (!email || !newPassword) {
      Alert.alert('Error', 'Please enter both email and new password');
      return;
    }
    try {
      const response = await fetch('http://10.0.2.2:5001/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Password reset successful!');
        navigation.navigate('login');
      } else {
        Alert.alert('Error', data.error || 'Reset failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="New Password"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      <TouchableOpacity style={styles.button} onPress={handleReset}>
        <Text style={styles.buttonText}>Reset Password</Text>
      </TouchableOpacity>
      <View style={{marginTop: 20, alignItems: 'center'}}>
        <Text
          style={{color: 'blue', cursor: 'pointer'}}
          onPress={() => navigation.navigate('login')}
        >
          Back to Login
        </Text>
      </View>
    </View>
  );
};

export default ForgotPasswordScreen; 