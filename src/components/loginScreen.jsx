import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { styles } from '../style/style';

const LoginScreen = ({navigation}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (username === 'admin' && password === '1234') {
      Alert.alert('Success', 'Login Successful!');
      // Navigate to next screen here
    } else {
      Alert.alert('Error', 'Invalid credentials');
    }
  };

  return (
    <View style={styles.container}>
    <View style={styles.logoContainer}><Image style={styles.logo} source={require('../assets/logo.png')} /></View>
      <Text style={styles.title}>Login</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>
      <View style={{marginTop: 20, alignItems: 'center'}} >
              <Text>
                Don't have an account? <Text style={{color: 'blue'}} onPress={() => navigation.navigate('signup')}>Sign up</Text>
              </Text>
            </View>
    </View>
  );
};

export default LoginScreen;