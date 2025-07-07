import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import {styles} from '../style/style';

const SignUpScreen = ({navigation}) => {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});

  const isValidEmail = email => /\S+@\S+\.\S+/.test(email);

  const validateField = (name, value) => {
    let error = '';

    switch (name) {
      case 'firstName':
      case 'lastName':
        if (!value.trim()) error = 'Required';
        break;
      case 'email':
        if (!value.trim()) error = 'Required';
        else if (!isValidEmail(value)) error = 'Invalid email';
        break;
      case 'password':
        if (!value.trim()) error = 'Required';
        else if (value.length < 6)
          error = 'Password must be at least 6 characters';
        break;
      case 'confirmPassword':
        if (!value.trim()) error = 'Required';
        else if (value !== form.password) error = 'Passwords do not match';
        break;
    }

    setErrors(prev => ({...prev, [name]: error}));
  };

  const handleChange = (name, value) => {
    setForm(prev => ({...prev, [name]: value}));
    validateField(name, value);
  };

  const handleSignUp = async () => {
    const newErrors = {};
    Object.keys(form).forEach(key => {
      validateField(key, form[key]);
      if (!form[key]) newErrors[key] = 'Required';
    });
    const hasErrors = Object.values(errors).some(e => e);
    if (hasErrors || Object.values(newErrors).some(e => e)) {
      Alert.alert('Error', 'Please correct the errors in the form');
      return;
    }
    try {
      const response = await fetch('http://10.0.2.2:5001/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.firstName + ' ' + form.lastName,
          email: form.email,
          password: form.password
        })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Sign-Up Successful!');
        navigation.navigate('login');
      } else {
        Alert.alert('Error', data.error || 'Registration failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.logoContainer}>
        <Image style={styles.logo} source={require('../assets/logo.png')} />
      </View>

      <Text style={styles.title}>Sign Up</Text>

      {/** First Name */}
      <TextInput
        style={styles.input}
        placeholder="First Name"
        value={form.firstName}
        onChangeText={text => handleChange('firstName', text)}
      />
      {errors.firstName ? (
        <Text style={styles.error}>{errors.firstName}</Text>
      ) : null}

      {/** Last Name */}
      <TextInput
        style={styles.input}
        placeholder="Last Name"
        value={form.lastName}
        onChangeText={text => handleChange('lastName', text)}
      />
      {errors.lastName ? (
        <Text style={styles.error}>{errors.lastName}</Text>
      ) : null}

      {/** Email */}
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={form.email}
        onChangeText={text => handleChange('email', text)}
      />
      {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}

      {/** Password */}
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={form.password}
        onChangeText={text => handleChange('password', text)}
      />
      {errors.password ? (
        <Text style={styles.error}>{errors.password}</Text>
      ) : null}

      {/** Confirm Password */}
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        secureTextEntry
        value={form.confirmPassword}
        onChangeText={text => handleChange('confirmPassword', text)}
      />
      {errors.confirmPassword ? (
        <Text style={styles.error}>{errors.confirmPassword}</Text>
      ) : null}

      {/** Submit Button */}
      <TouchableOpacity style={styles.button} onPress={handleSignUp}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      {/** Footer */}
      <View style={{marginTop: 20, alignItems: 'center'}} >
        <Text>
          Already have an account? <Text style={{color: 'blue', cursor: 'pointer'}} onPress={() => navigation.navigate('login')}>Log In</Text>
        </Text>
      </View>
    </ScrollView>
  );
};

export default SignUpScreen;
