import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {styles} from '../style/style';
import {
  changeAuthEmail,
  getUserProfile,
  updateUserProfile,
  getCurrentUser,
  changeUsername, // <-- NEW
} from '../config/firebase';

const NAME_RE = /^[A-Za-z]+$/; // letters only

const UserProfileEdit = ({navigation}) => {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    address: '',
    mobileNo: '',
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    setIsLoading(true);
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'Please login to view your profile');
        navigation.navigate('login');
        return;
      }
      const result = await getUserProfile(currentUser.uid);
      if (result.success) {
        setUserData(result.userData);
        setForm({
          firstName: result.userData.firstName || '',
          lastName: result.userData.lastName || '',
          username: result.userData.username || '',
          email: result.userData.email || currentUser.email || '',
          address: result.userData.address || '',
          mobileNo: result.userData.mobileNo || '',
        });
      } else {
        Alert.alert('Error', result.error || 'Failed to load profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const validateField = (name, value) => {
    let error = '';
    const v = (value || '').trim();

    switch (name) {
      case 'firstName':
      case 'lastName':
        if (!v) error = 'Required';
        else if (!NAME_RE.test(v)) error = 'Letters only (A–Z)';
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

      case 'currentPassword':
        if (!v) error = 'Password is required to change email';
        break;
    }

    setErrors(prev => ({...prev, [name]: error}));
    return error;
  };

  // Sanitize first/last name as user types (keep letters only)
  const handleNameChange = (field, text) => {
    const cleaned = (text || '').replace(/[^A-Za-z]/g, '');
    setForm(prev => ({...prev, [field]: cleaned}));
    if (errors[field]) setErrors(prev => ({...prev, [field]: ''}));
  };

  const handleChange = (name, value) => {
    setForm(prev => ({...prev, [name]: value}));
    if (errors[name]) setErrors(prev => ({...prev, [name]: ''}));
  };

  const handleSave = async () => {
    const newErrors = {};
    for (const [key, value] of Object.entries(form)) {
      const err = validateField(key, value);
      if (err) newErrors[key] = err;
    }

    const emailChanging =
      form.email.trim().toLowerCase() !== (userData?.email || '').toLowerCase();
    const usernameChanging =
      form.username.trim().toLowerCase() !==
      (userData?.username || '').toLowerCase();

    if (emailChanging) {
      const e2 = validateField('currentPassword', currentPassword);
      if (e2) newErrors.currentPassword = e2;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Alert.alert('Error', 'Please correct the errors in the form');
      return;
    }

    setIsSaving(true);
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'Please login to update your profile');
        return;
      }

      if (usernameChanging) {
        try {
          await changeUsername(
            currentUser.uid,
            userData?.username || '',
            form.username.trim(),
            form.email.trim(),
          );
        } catch (e) {
          const raw = e?.code || e?.message || JSON.stringify(e);
          const msg = /permission-denied/i.test(raw)
            ? 'Permissions blocked this change. Publish the Firestore rules for /usernames.'
            : /username-taken/i.test(raw)
            ? 'That username is already taken. Please choose another.'
            : /invalid-username/i.test(raw)
            ? 'Invalid username (use 3–30 letters, numbers, or _).'
            : String(raw);
          Alert.alert('Username change failed', msg);
          setIsSaving(false);
          return;
        }
      }

      if (emailChanging) {
        try {
          await changeAuthEmail(form.email.trim(), currentPassword);
          await updateUserProfile(currentUser.uid, {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            address: form.address.trim(),
            mobileNo: form.mobileNo.trim(),
          });
          Alert.alert(
            'Verify your email',
            'We sent a verification link to your new email. Click it to finish changing your login email.',
          );
          setCurrentPassword('');
          await loadUserProfile();
          setIsSaving(false);
          return;
        } catch (e) {
          const code = e?.code || '';
          const msg =
            code === 'auth/wrong-password'
              ? 'Wrong password'
              : code === 'auth/requires-recent-login'
              ? 'Please log out and back in, then try again.'
              : code === 'missing-password'
              ? 'Password is required to change email'
              : code === 'auth/operation-not-allowed'
              ? 'Your project requires verifying the new email. We just sent a link — please use that.'
              : e?.message || 'Failed to change email';
          Alert.alert('Email change failed', msg);
          setIsSaving(false);
          return;
        }
      }

      const result = await updateUserProfile(currentUser.uid, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        mobileNo: form.mobileNo.trim(),
      });

      if (result.success) {
        Alert.alert('Success', 'Profile updated successfully!');
        await loadUserProfile();
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{marginTop: 20}}>Loading profile...</Text>
      </View>
    );
  }

  const emailChanged =
    form.email.trim().toLowerCase() !== (userData?.email || '').toLowerCase();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Profile</Text>

      {/* First Name (letters only) */}
      <TextInput
        style={[styles.input, errors.firstName ? styles.inputError : null]}
        placeholder="First Name"
        value={form.firstName}
        onChangeText={text => handleNameChange('firstName', text)}
        onBlur={() => validateField('firstName', form.firstName)}
        autoCapitalize="words"
        maxLength={40}
      />
      {errors.firstName ? <Text style={styles.error}>{errors.firstName}</Text> : null}

      {/* Last Name (letters only) */}
      <TextInput
        style={[styles.input, errors.lastName ? styles.inputError : null]}
        placeholder="Last Name"
        value={form.lastName}
        onChangeText={text => handleNameChange('lastName', text)}
        onBlur={() => validateField('lastName', form.lastName)}
        autoCapitalize="words"
        maxLength={40}
      />
      {errors.lastName ? <Text style={styles.error}>{errors.lastName}</Text> : null}

      {/* Username */}
      <TextInput
        style={[styles.input, errors.username ? styles.inputError : null]}
        placeholder="Username"
        value={form.username}
        onChangeText={text => handleChange('username', text)}
        onBlur={() => validateField('username', form.username)}
        autoCapitalize="none"
      />
      {errors.username ? <Text style={styles.error}>{errors.username}</Text> : null}

      {/* Email */}
      <TextInput
        style={[styles.input, errors.email ? styles.inputError : null]}
        placeholder="Email Address"
        keyboardType="email-address"
        autoCapitalize="none"
        value={form.email}
        onChangeText={text => handleChange('email', text)}
        onBlur={() => validateField('email', form.email)}
      />
      {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}

      {/* Current Password (only if changing email) */}
      <TextInput
        style={[
          styles.input,
          emailChanged || errors.currentPassword ? styles.inputError : null,
        ]}
        placeholder="Current Password (only if changing email)"
        secureTextEntry
        value={currentPassword}
        onChangeText={setCurrentPassword}
      />
      {emailChanged && !currentPassword ? (
        <Text style={styles.error}>Password is required to change email</Text>
      ) : null}
      {errors.currentPassword ? (
        <Text style={styles.error}>{errors.currentPassword}</Text>
      ) : null}

      {/* Address */}
      <TextInput
        style={[styles.input, errors.address ? styles.inputError : null]}
        placeholder="Full Address"
        value={form.address}
        onChangeText={text => handleChange('address', text)}
        onBlur={() => validateField('address', form.address)}
        multiline
        numberOfLines={2}
      />
      {errors.address ? <Text style={styles.error}>{errors.address}</Text> : null}

      {/* Mobile Number */}
      <TextInput
        style={[styles.input, errors.mobileNo ? styles.inputError : null]}
        placeholder="Mobile Number"
        value={form.mobileNo}
        onChangeText={text => handleChange('mobileNo', text)}
        onBlur={() => validateField('mobileNo', form.mobileNo)}
        keyboardType="phone-pad"
      />
      {errors.mobileNo ? <Text style={styles.error}>{errors.mobileNo}</Text> : null}

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.button, isSaving ? styles.buttonDisabled : null]}
        onPress={handleSave}
        disabled={isSaving}>
        <Text style={styles.buttonText}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Text>
      </TouchableOpacity>

      {/* Cancel Button */}
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default UserProfileEdit;
