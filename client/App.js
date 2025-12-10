import React, {useEffect, useRef, useState} from 'react';
import 'react-native-gesture-handler';
import LoginScreen from './src/components/loginScreen';
import SignUpScreen from './src/components/signUpScreen';
import ForgotPasswordScreen from './src/components/ForgotPasswordScreen';
import UserProfileEdit from './src/components/UserProfileEdit';
import DirectionsView from './src/components/DirectionsView';
import BookingsScreen from './src/components/BookingsScreen';
import BillingHistoryScreen from './src/components/BillingHistoryScreen';
import HomePage from './src/components/homePage';

import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer} from '@react-navigation/native';

import {StripeProvider} from '@stripe/stripe-react-native';
import {
  Alert,
  Linking,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

import {
  bookParkingSpot,
  getCurrentUser,
  saveFCMToken,
  getPaymentBySessionId,
  getUserBookings,
  updatePaymentStatus,
} from './src/config/firebase';

import {setupNotificationListeners} from './src/utils/notifications';

import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Stack = createNativeStackNavigator();

function App() {
  const navigationRef = useRef(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  //  DEEP LINK INITIALIZATION
  useEffect(() => {
    const extractSessionId = url => {
      if (!url) return null;
      const match = url.match(/[?&]session_id=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    };

    const handleDeepLink = async url => {
      if (!url) return;

      const sessionId = extractSessionId(url);
      const isSuccess = url.includes('checkout/success');
      const isCancel = url.includes('checkout/cancel');

      if (!sessionId && isSuccess) {
        Alert.alert('Error', 'Missing session ID');
        return;
      }

      if (isCancel) {
        await AsyncStorage.removeItem('checkout_in_progress');
        return;
      }

      if (isSuccess) {
        setIsProcessingPayment(true);

        try {
          await handleCheckoutSuccess(sessionId);
        } catch (err) {
          Alert.alert(
            'Payment Processing Error',
            'Payment succeeded but booking failed. Please check your bookings.',
          );
        } finally {
          await AsyncStorage.removeItem('checkout_in_progress');
          setIsProcessingPayment(false);
        }
      }
    };

    Linking.getInitialURL().then(handleDeepLink);
    const subscription = Linking.addEventListener('url', ({url}) =>
      handleDeepLink(url),
    );

    return () => subscription.remove();
  }, []);

  //  NOTIFICATION LISTENERS
  useEffect(() => {
    const unsubscribeForeground = setupNotificationListeners(
      () => navigationRef.current,
    );

    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async token => {
      const currentUser = getCurrentUser();
      if (currentUser) await saveFCMToken(currentUser.uid, token);
    });

    return () => {
      unsubscribeForeground();
      unsubscribeTokenRefresh();
    };
  }, []);

  //  HANDLE CHECKOUT SUCCESS
  async function handleCheckoutSuccess(sessionId) {
    if (!sessionId) throw new Error('Invalid session ID');

    const verificationRes = await fetch(
      'https://us-central1-parking-app-1cb84.cloudfunctions.net/verifyCheckoutSession',
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sessionId}),
      },
    );

    const data = await verificationRes.json();
    if (!verificationRes.ok)
      throw new Error(data?.error || 'Verification failed');

    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('No active user');

    if (!data.spotId) throw new Error('Missing spotId');

    // Lookup payment record
    let paymentId = null;
    const paymentRecord = await getPaymentBySessionId(
      sessionId,
      currentUser.uid,
    ).catch(() => null);
    if (paymentRecord?.success && paymentRecord.payment) {
      paymentId = paymentRecord.payment.id;
    }

    // Prevent duplicate booking
    const userBookings = await getUserBookings(currentUser.uid).catch(
      () => null,
    );
    const existingBooking = userBookings?.bookings?.find(
      b =>
        (b.session_id === sessionId || b.payment_id === paymentId) &&
        b.status === 'confirmed',
    );

    if (existingBooking) {
      await cleanupTempData(data.spotId, sessionId);
      navigateToBookings();
      return;
    }

    const spot = await loadSpotData(data.spotId);

    const bookingPayload = {
      amount: data.amount || spot?.pricing_hourly || 0,
      currency: (data.currency || 'USD').toUpperCase(),
      payment_status: 'paid',
      payment_method: 'stripe',
      session_id: sessionId,
      payment_id: paymentId,
      status: 'confirmed',
      spot_name: spot?.name || 'Parking Spot',
      spot_address: spot?.address || null,
      spot_latitude: spot?.latitude || null,
      spot_longitude: spot?.longitude || null,
    };

    const result = await bookParkingSpot(
      data.spotId,
      currentUser.uid,
      bookingPayload,
    );

    if (!result?.success) {
      throw new Error(result?.error || 'Booking creation failed');
    }

    if (paymentId && result.bookingId) {
      await updatePaymentStatus(paymentId, {
        booking_id: result.bookingId,
        status: 'succeeded',
        paid_at: new Date(),
      }).catch(() => {});
    }

    await cleanupTempData(data.spotId, sessionId);
    navigateToBookings();
  }

  async function loadSpotData(spotId) {
    const raw = await AsyncStorage.getItem(`spot_${spotId}`).catch(() => null);
    return raw ? JSON.parse(raw) : null;
  }

  async function cleanupTempData(spotId, sessionId) {
    await AsyncStorage.multiRemove([
      `spot_${spotId}`,
      `payment_${sessionId}`,
    ]).catch(() => {});
  }

  function navigateToBookings() {
    if (navigationRef.current) {
      navigationRef.current.navigate('Bookings');
    }
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StripeProvider publishableKey="pk_test_51SXKstC1HeXH2oUQuSjQMoH7zT0olUUFg0dQeZshuhyfgwc9TFi5VYyT59GJZXwAotVWnORfoa3QqYU2bEtr4A2T00ecmUBySG">
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen name="login" component={LoginScreen} />
          <Stack.Screen name="signup" component={SignUpScreen} />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
          />
          <Stack.Screen name="home" component={HomePage} />
          <Stack.Screen name="UserProfileEdit" component={UserProfileEdit} />
          <Stack.Screen name="DirectionsView" component={DirectionsView} />
          <Stack.Screen name="Bookings" component={BookingsScreen} />
          <Stack.Screen
            name="BillingHistory"
            component={BillingHistoryScreen}
          />
        </Stack.Navigator>
      </StripeProvider>

      {isProcessingPayment && (
        <View style={styles.loaderOverlay}>
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loaderText}>Processing payment...</Text>
            <Text style={styles.loaderSubtext}>
              Please wait while we complete your booking
            </Text>
          </View>
        </View>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loaderContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
  },
  loaderSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
});

export default App;
