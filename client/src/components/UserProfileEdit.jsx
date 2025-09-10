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
} from '../config/firebase';

const UserProfileEdit = ({navigation}) => {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    address: '',
    mobileNo: '',
  });

  // for email change
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
      case 'currentPassword': // only validated when email changes
        if (!value.trim()) error = 'Password is required to change email';
        break;
    }

    setErrors(prev => ({...prev, [name]: error}));
    return error;
  };

  const handleChange = (name, value) => {
    setForm(prev => ({...prev, [name]: value}));
    if (errors[name]) setErrors(prev => ({...prev, [name]: ''}));
  };

  const handleSave = async () => {
    // Validate all fields
    const newErrors = {};
    for (const [key, value] of Object.entries(form)) {
      const error = validateField(key, value);
      if (error) newErrors[key] = error;
    }

    const emailChanging =
      form.email.trim().toLowerCase() !== (userData?.email || '').toLowerCase();

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

      if (emailChanging) {
        // 1) Request email verification to the NEW email
        try {
          const res = await changeAuthEmail(form.email.trim(), currentPassword);

          // 2) Save other profile fields (WITHOUT email yet)
          await updateUserProfile(currentUser.uid, {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            username: form.username.trim(),
            address: form.address.trim(),
            mobileNo: form.mobileNo.trim(),
            // keep existing email in Firestore until user verifies
          });

          Alert.alert(
            'Verify your email',
            'We sent a verification link to your new email. Click the link to finish changing your login email. Other profile fields were saved.',
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

      // Email not changing — save everything normally (including email)
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

      {/* First Name */}
      <TextInput
        style={[styles.input, errors.firstName ? styles.inputError : null]}
        placeholder="First Name"
        value={form.firstName}
        onChangeText={text => handleChange('firstName', text)}
        onBlur={() => validateField('firstName', form.firstName)}
      />
      {errors.firstName ? (
        <Text style={styles.error}>{errors.firstName}</Text>
      ) : null}

      {/* Last Name */}
      <TextInput
        style={[styles.input, errors.lastName ? styles.inputError : null]}
        placeholder="Last Name"
        value={form.lastName}
        onChangeText={text => handleChange('lastName', text)}
        onBlur={() => validateField('lastName', form.lastName)}
      />
      {errors.lastName ? (
        <Text style={styles.error}>{errors.lastName}</Text>
      ) : null}

      {/* Username */}
      <TextInput
        style={[styles.input, errors.username ? styles.inputError : null]}
        placeholder="Username"
        value={form.username}
        onChangeText={text => handleChange('username', text)}
        onBlur={() => validateField('username', form.username)}
        autoCapitalize="none"
      />
      {errors.username ? (
        <Text style={styles.error}>{errors.username}</Text>
      ) : null}

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
      {errors.address ? (
        <Text style={styles.error}>{errors.address}</Text>
      ) : null}

      {/* Mobile Number */}
      <TextInput
        style={[styles.input, errors.mobileNo ? styles.inputError : null]}
        placeholder="Mobile Number"
        value={form.mobileNo}
        onChangeText={text => handleChange('mobileNo', text)}
        onBlur={() => validateField('mobileNo', form.mobileNo)}
        keyboardType="phone-pad"
      />
      {errors.mobileNo ? (
        <Text style={styles.error}>{errors.mobileNo}</Text>
      ) : null}

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
