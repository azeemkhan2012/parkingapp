import React, {useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, Alert} from 'react-native';
import {styles} from '../style/style';
import {requestPasswordReset} from '../config/firebase';

const ForgotPasswordScreen = ({navigation}) => {
  const [email, setEmail] = useState('');
  // const [newPassword, setNewPassword] = useState('');

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter both email and new password');
      return;
    }
    try {
      const response = await requestPasswordReset(email);
      if (response.success) {
        Alert.alert(
          'Check your inbox',
          'If an account exists for that email, a password reset link has been sent.',
        );
        navigation.goBack();
      } else {
        const msg = /auth\/invalid-email/i.test(res.error)
          ? 'That email address is not valid.'
          : 'If an account exists for that email, a reset link has been sent.';
        Alert.alert('Password reset', msg);
        navigation.goBack();
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
      {/* <TextInput
        style={styles.input}
        placeholder="New Password"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      /> */}
      <TouchableOpacity style={styles.button} onPress={handleReset}>
        <Text style={styles.buttonText}>Reset Password</Text>
      </TouchableOpacity>
      <View style={{marginTop: 20, alignItems: 'center'}}>
        <Text
          style={{color: 'blue', cursor: 'pointer'}}
          onPress={() => navigation.navigate('login')}>
          Back to Login
        </Text>
      </View>
    </View>
  );
};

export default ForgotPasswordScreen;
