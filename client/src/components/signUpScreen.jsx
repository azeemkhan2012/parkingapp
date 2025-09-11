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

const NAME_RE = /^[A-Za-z ]+$/; // letters & spaces only

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

  const validateField = (name, value) => {
    let error = '';
    const v = (value || '').trim();

    switch (name) {
      case 'firstName':
      case 'lastName':
        if (!v) error = 'Required';
        else if (!NAME_RE.test(v)) error = 'Letters and spaces only';
        else if (v.length < 2) error = 'Must be at least 2 characters';
        break;

      case 'username':
        if (!v) error = 'Required';
        else if (v.length < 3) error = 'Must be at least 3 characters';
        else if (!/^[a-zA-Z0-9_]+$/.test(v))
          error = 'Only letters, numbers, and underscore allowed';
        break;

      case 'email':
        if (!v) error = 'Required';
        else if (!/\S+@\S+\.\S+/.test(v)) error = 'Invalid email format';
        break;

      case 'address':
        if (!v) error = 'Required';
        else if (v.length < 10) error = 'Please enter complete address';
        break;

      case 'mobileNo':
        if (!v) error = 'Required';
        else if (!/^\d{10,15}$/.test(v.replace(/\D/g, '')))
          error = 'Invalid mobile number';
        break;

      case 'password':
        if (!v) error = 'Required';
        else if (v.length < 6) error = 'Password must be at least 6 characters';
        break;

      case 'confirmPassword':
        if (!v) error = 'Required';
        else if (v !== form.password) error = 'Passwords do not match';
        break;
    }
    setErrors(prev => ({...prev, [name]: error}));
    return error;
  };

  // sanitizes names as the user types (letters & spaces only)
  const handleNameChange = (field, text) => {
    const cleaned = (text || '').replace(/[^A-Za-z ]/g, '');
    setForm(prev => ({...prev, [field]: cleaned}));
    validateField(field, cleaned);
  };

  const handleChange = (name, value) => {
    setForm(prev => ({...prev, [name]: value}));
    validateField(name, value);
  };

  const handleSignUp = async () => {
    setIsLoading(true);
    const newErrors = {};
    Object.keys(form).forEach(key => {
      const err = validateField(key, form[key]);
      if (err) newErrors[key] = err;
    });

    const hasErrors = Object.values(newErrors).some(Boolean);
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

      const result = await signUp(form.email.trim(), form.password);
      if (result.success) {
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
            created_at: new Date(),
          });
        }
        Alert.alert('Success', 'Sign-Up Successful!');
        navigation.navigate('login');
        setIsLoading(false);
      } else {
        Alert.alert('Error', result.error || 'Registration failed');
        setIsLoading(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
      setIsLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.signupContainer}
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.logoContainer}>
        <Image style={styles.logo} source={require('../assets/logo.png')} />
      </View>

      <Text style={styles.title}>Sign Up</Text>

      {/* First Name (letters & spaces only) */}
      <TextInput
        style={styles.input}
        placeholder="First Name"
        value={form.firstName}
        onChangeText={text => handleNameChange('firstName', text)}
        autoCapitalize="words"
        maxLength={40}
      />
      {errors.firstName ? (
        <Text style={styles.error}>{errors.firstName}</Text>
      ) : null}

      {/* Last Name (letters & spaces only) */}
      <TextInput
        style={styles.input}
        placeholder="Last Name"
        value={form.lastName}
        onChangeText={text => handleNameChange('lastName', text)}
        autoCapitalize="words"
        maxLength={40}
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
        maxLength={30}
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
        maxLength={15}
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

      <TouchableOpacity
        style={styles.button}
        disabled={isLoading}
        onPress={handleSignUp}>
        <Text style={styles.buttonText}>
          {isLoading ? 'loading...' : 'Sign Up'}
        </Text>
      </TouchableOpacity>

      <View style={{marginTop: 20, alignItems: 'center'}}>
        <Text>
          Already have an account?{' '}
          <Text
            style={{color: 'blue'}}
            onPress={() => navigation.navigate('login')}>
            Log In
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
};

export default SignUpScreen;
