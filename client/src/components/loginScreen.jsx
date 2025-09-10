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
import { signInWithIdentifier, getUserProfile, ensureUsernameMapping} from '../config/firebase';

const LoginScreen = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
  const idTrim = (email || '').trim();   // username OR email
  const passTrim = (password || '').trim();
  if (!idTrim || !passTrim) { Alert.alert('Error','Please enter username/email and password'); return; }

  const result = await signInWithIdentifier(idTrim, passTrim);
  if (result.success) {
    try {
      // if they logged in with email, backfill the username mapping
      if (idTrim.includes('@')) {
        const prof = await getUserProfile(result.user.uid);
        if (prof.success && prof.userData?.username) {
          await ensureUsernameMapping(result.user.uid, prof.userData.username, result.user.email);
        }
      }
    } catch (_) {}
    navigation.navigate('home');
  } else {
    const err = String(result.error || '');
    const msg =
      /username-not-found/i.test(err) ? 'No account with that username'
      : /invalid-credential|wrong-password/i.test(err) ? 'Incorrect credentials'
      : /user-not-found/i.test(err) ? 'No account with that email'
      : /too-many-requests/i.test(err) ? 'Too many attempts. Try again later.'
      : err;
    Alert.alert('Error', msg);
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
