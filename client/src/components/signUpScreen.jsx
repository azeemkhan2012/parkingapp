// SignUpScreen.js
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
import {
  signUp,
  updateUserProfile,
  getCurrentUser,
  isUsernameAvailable,
  ensureUsernameMapping,
} from '../config/firebase';

const SignUpScreen = ({navigation}) => {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    address: '',
    mobileNo: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const isValidEmail = email => /\S+@\S+\.\S+/.test(email);

  const validateField = (name, value) => {
    let error = '';
    switch (name) {
      case 'firstName':
      case 'lastName':
        if (!value.trim()) error = 'Required';
        else if (value.trim().length < 2)
          error = 'Must be at least 2 characters';
        break;
      case 'username':
        if (!value.trim()) error = 'Required';
        else if (value.trim().length < 3)
          error = 'Must be at least 3 characters';
        else if (!/^[a-zA-Z0-9_]+$/.test(value))
          error = 'Only letters, numbers, and underscore allowed';
        break;
      case 'email':
        if (!value.trim()) error = 'Required';
        else if (!/\S+@\S+\.\S+/.test(value)) error = 'Invalid email format';
        break;
      case 'address':
        if (!value.trim()) error = 'Required';
        else if (value.trim().length < 10)
          error = 'Please enter complete address';
        break;
      case 'mobileNo':
        if (!value.trim()) error = 'Required';
        else if (!/^\d{10,15}$/.test(value.replace(/\D/g, '')))
          error = 'Invalid mobile number';
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
    setIsLoading(true)
    const newErrors = {};
    Object.keys(form).forEach(key => {
      validateField(key, form[key]);
      if (!form[key]) newErrors[key] = 'Required';
    });
    const hasErrors = Object.values({...errors, ...newErrors}).some(e => e);

    if (hasErrors) {
      Alert.alert('Error', 'Please correct the errors in the form');
      return;
    }
    try {
      const available = await isUsernameAvailable(form.username);
      if (!available) {
        Alert.alert('Username taken', 'Please choose another username.');
        return;
      }
      const result = await signUp(form.email, form.password);
      if (result.success) {
        setIsLoading(true)
        // Save extended profile in Firestore
        const user = getCurrentUser();
        if (user) {
          await ensureUsernameMapping(user.uid, form.username, form.email); 
          await updateUserProfile(user.uid, {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            username: form.username.trim(),
            email: form.email.trim(),
            address: form.address.trim(),
            mobileNo: form.mobileNo.trim(),
            created_at: new Date(), // serverTimestamp() is also set in updateUserProfile merge
          });
        }
        Alert.alert('Success', 'Sign-Up Successful!');
        navigation.navigate('login');
      } else {
        setIsLoading(false)
        Alert.alert('Error', result.error || 'Registration failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.signupContainer}
      showsVerticalScrollIndicator={true}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={true}
      bounces={true}
      alwaysBounceVertical={false}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.logoContainer}>
        <Image style={styles.logo} source={require('../assets/logo.png')} />
      </View>

      <Text style={styles.title}>Sign Up</Text>

      <TextInput
        style={styles.input}
        placeholder="First Name"
        value={form.firstName}
        onChangeText={text => handleChange('firstName', text)}
      />
      {errors.firstName ? (
        <Text style={styles.error}>{errors.firstName}</Text>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Last Name"
        value={form.lastName}
        onChangeText={text => handleChange('lastName', text)}
      />
      {errors.lastName ? (
        <Text style={styles.error}>{errors.lastName}</Text>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        value={form.username}
        onChangeText={text => handleChange('username', text)}
      />
      {errors.username ? (
        <Text style={styles.error}>{errors.username}</Text>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={form.email}
        onChangeText={text => handleChange('email', text)}
      />
      {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Address"
        value={form.address}
        onChangeText={text => handleChange('address', text)}
      />
      {errors.address ? (
        <Text style={styles.error}>{errors.address}</Text>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Mobile No"
        keyboardType="phone-pad"
        value={form.mobileNo}
        onChangeText={text => handleChange('mobileNo', text)}
      />
      {errors.mobileNo ? (
        <Text style={styles.error}>{errors.mobileNo}</Text>
      ) : null}

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

      <TouchableOpacity style={styles.button} disabled={isLoading} onPress={handleSignUp}>
        <Text style={styles.buttonText}>{isLoading ? 'loading...' : 'Sign Up'}</Text>
      </TouchableOpacity>

      <View style={{marginTop: 20, alignItems: 'center'}}>
        <Text>
          Already have an account?{' '}
          <Text
            style={{color: 'blue', cursor: 'pointer'}}
            onPress={() => navigation.navigate('login')}>
            Log In
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
};

export default SignUpScreen;
