import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import {styles} from '../style/style';
import { signIn, getCurrentUser } from '../config/firebase';

const LoginScreen = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }
    try {
      const result = await signIn(email, password);
      if (result.success) {
        Alert.alert('Success', 'Login Successful!');
        navigation.navigate('home');
      } else {
        Alert.alert('Error', result.error || 'Invalid credentials');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image style={styles.logo} source={require('../assets/logo.png')} />
      </View>
      <Text style={styles.title}>Login</Text>
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
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <View style={{alignItems: 'flex-end', marginBottom: 4}}>
        <Text
          style={{color: 'blue', cursor: 'pointer'}}
          onPress={() => navigation.navigate('ForgotPassword')}>
          Forgot Password?
        </Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>
      <View style={{marginTop: 20, alignItems: 'center'}}>
        <Text>
          Don't have an account?{' '}
          <Text
            style={{color: 'blue', cursor: 'pointer'}}
            onPress={() => navigation.navigate('signup')}>
            Sign up
          </Text>
        </Text>
      </View>
    </View>
  );
};

export default LoginScreen;
