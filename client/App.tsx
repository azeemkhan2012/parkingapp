/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {useEffect, useRef} from 'react';
import 'react-native-gesture-handler';
import LoginScreen from './src/components/loginScreen';
import SignUpScreen from './src/components/signUpScreen';
import ForgotPasswordScreen from './src/components/ForgotPasswordScreen';
import UserProfileEdit from './src/components/UserProfileEdit';
import NetworkTest from './src/components/NetworkTest';
import BookingConfirmation from './src/components/BookingConfirmation';
import DirectionsView from './src/components/DirectionsView';
import BookingsScreen from './src/components/BookingsScreen';
import BillingHistoryScreen from './src/components/BillingHistoryScreen';
// import HomePage from './src/components/homePage';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer} from '@react-navigation/native';
import HomePage from './src/components/homePage';
import {StripeProvider} from '@stripe/stripe-react-native';
import {Alert, Linking} from 'react-native';
import {
  bookParkingSpot,
  getCurrentUser,
  saveFCMToken,
} from './src/config/firebase';
import {
  setupNotificationListeners,
  getFCMToken,
} from './src/utils/notifications';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import {NavigationContainer} from './node_modules/@react-navigation/native/lib/typescript/src';
// import {createNativeStackNavigator} from './node_modules/@react-navigation/native-stack/lib/typescript/src';

// import type {PropsWithChildren} from 'react';

// type SectionProps = PropsWithChildren<{
//   title: string;
// }>;

const Stack = createNativeStackNavigator();

function App(): React.JSX.Element {
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    const handleDeepLink = async (eventUrl: any) => {
      try {
        if (!eventUrl) return;

        console.log('Deep link received:', eventUrl);

        // Extract session_id manually using regex
        const match = eventUrl.match(/[?&]session_id=([^&]+)/);
        const sessionId = match ? decodeURIComponent(match[1]) : null;

        if (eventUrl.includes('checkout/success')) {
          if (sessionId) {
            await handleCheckoutSuccess(sessionId);
          } else {
            Alert.alert(
              'Payment Successful',
              'Could not verify session, but payment went through.',
            );
          }
        }

        if (eventUrl.includes('checkout/cancel')) {
          Alert.alert('Payment Cancelled', 'User cancelled the payment.');
        }
      } catch (error: any) {
        console.log('Deep link error suppressed:', error?.message);
        // Do NOT show URL.host errors to user
      }
    };

    // Handle cold start
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink(url);
    });

    // Handle opened links
    const subscription = Linking.addEventListener('url', ({url}) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  // Setup notification listeners
  useEffect(() => {
    // Get navigation instance when available
    const getNavigation = () => {
      return navigationRef.current;
    };

    // Setup notification listeners
    const unsubscribeForeground = setupNotificationListeners(getNavigation);

    // Handle FCM token refresh
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(
      async (token: any) => {
        console.log('FCM token refreshed:', token);
        const currentUser = getCurrentUser();
        if (currentUser) {
          try {
            await saveFCMToken(currentUser.uid, token);
            console.log('Refreshed FCM token saved');
          } catch (error) {
            console.error('Error saving refreshed token:', error);
          }
        }
      },
    );

    return () => {
      unsubscribeForeground();
      unsubscribeTokenRefresh();
    };
  }, []);

  async function handleCheckoutSuccess(sessionId: string) {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Invalid session ID');
      }

      console.log('Verifying checkout session:', sessionId);

      const res = await fetch(
        `https://us-central1-parking-app-1cb84.cloudfunctions.net/verifyCheckoutSession`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({sessionId}),
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Verification failed');
      }

      const data = await res.json();

      if (!data.paid) {
        Alert.alert('Payment not completed', 'Please try again.');
        return;
      }

      // Now safely book the parking spot in Firestore
      const currentUser = getCurrentUser();
      if (!currentUser) {
        Alert.alert(
          'Payment Successful',
          'Please log in so we can complete your booking.',
        );
        return;
      }

      if (!data.spotId) {
        throw new Error('Spot ID not found in payment data');
      }

      // Get spot data from AsyncStorage (stored before checkout)
      let spot = null;
      try {
        const spotData = await AsyncStorage.getItem(`spot_${data.spotId}`);
        if (spotData) {
          spot = JSON.parse(spotData);
        }
      } catch (storageErr) {
        console.error('Error getting spot data from storage:', storageErr);
      }

      // Get payment amount from response or spot data
      const paymentAmount = data.amount || spot?.pricing_hourly || 0;

      // Book parking spot with payment details
      const bookingData = {
        amount: paymentAmount,
        currency: data.currency?.toUpperCase() || 'PKR',
        payment_status: 'paid',
        payment_method: 'stripe',
        session_id: sessionId,
        booking_start: new Date(),
      };

      const result = await bookParkingSpot(
        data.spotId,
        currentUser.uid,
        bookingData,
      );

      if (result?.success) {
        navigationRef.current.navigate('BookingConfirmation', {
          spot: spot || {id: data.spotId},
          bookingId: result.bookingId || sessionId,
        });

        // Clean up stored spot data
        try {
          await AsyncStorage.removeItem(`spot_${data.spotId}`);
        } catch (cleanupErr) {
          console.warn('Error cleaning up spot data:', cleanupErr);
        }
      } else {
        Alert.alert(
          'Warning',
          result?.error ||
            'Booking failed after payment. Please contact support with your payment confirmation.',
        );
      }
      // if (result?.success) {
      //   // Get the spot data from AsyncStorage (stored before checkout)
      //   let spot = null;
      //   try {
      //     const spotData = await AsyncStorage.getItem(`spot_${data.spotId}`);
      //     if (spotData) {
      //       spot = JSON.parse(spotData);
      //     }
      //   } catch (storageErr) {
      //     console.error('Error getting spot data from storage:', storageErr);
      //   }

      //   // Navigate to booking confirmation page
      //   if (navigationRef.current) {
      //     navigationRef.current.navigate('BookingConfirmation', {
      //       spot: spot || {id: data.spotId},
      //       bookingId: (result as any).bookingId || sessionId,
      //     });
      //   }

      //   // Clean up stored spot data
      //   try {
      //     await AsyncStorage.removeItem(`spot_${data.spotId}`);
      //   } catch (cleanupErr) {
      //     console.warn('Error cleaning up spot data:', cleanupErr);
      //   }
      // } else {
      //   Alert.alert(
      //     'Warning',
      //     result?.error ||
      //       'Booking failed after payment. Please contact support with your payment confirmation.',
      //   );
      // }
    } catch (err: any) {
      console.error('handleCheckoutSuccess error:', err);
      const errorMessage = err.message || 'Could not confirm payment';

      // Don't show URL.host errors to user
      if (errorMessage.includes('URL.host') || errorMessage.includes('URL')) {
        Alert.alert(
          'Payment Processing',
          'Your payment was successful. Please check your bookings or contact support if you have any issues.',
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
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
          <Stack.Screen name="NetworkTest" component={NetworkTest} />
          <Stack.Screen
            name="BookingConfirmation"
            component={BookingConfirmation}
          />
          <Stack.Screen name="DirectionsView" component={DirectionsView} />
          <Stack.Screen name="Bookings" component={BookingsScreen} />
          <Stack.Screen
            name="BillingHistory"
            component={BillingHistoryScreen}
          />
        </Stack.Navigator>
      </StripeProvider>
    </NavigationContainer>
  );
}

export default App;
