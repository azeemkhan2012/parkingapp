/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {useEffect} from 'react';
import 'react-native-gesture-handler';
import LoginScreen from './src/components/loginScreen';
import SignUpScreen from './src/components/signUpScreen';
import ForgotPasswordScreen from './src/components/ForgotPasswordScreen';
import UserProfileEdit from './src/components/UserProfileEdit';
import NetworkTest from './src/components/NetworkTest';
// import HomePage from './src/components/homePage';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer} from '@react-navigation/native';
import HomePage from './src/components/homePage';
import {StripeProvider} from '@stripe/stripe-react-native';
import {Alert, Linking} from 'react-native';
import {bookParkingSpot, getCurrentUser} from './src/config/firebase';
// import {NavigationContainer} from './node_modules/@react-navigation/native/lib/typescript/src';
// import {createNativeStackNavigator} from './node_modules/@react-navigation/native-stack/lib/typescript/src';

// import type {PropsWithChildren} from 'react';

// type SectionProps = PropsWithChildren<{
//   title: string;
// }>;

const Stack = createNativeStackNavigator();

function App(): React.JSX.Element {
  useEffect(() => {
    const handleUrl = async (event: any) => {
      const url = event.url;
      const {path, queryParams} = Linking.parse(url);

      // e.g. parkingapp://checkout/success?session_id=cs_test_123
      if (path === 'checkout/success' && queryParams?.session_id) {
        await handleCheckoutSuccess(queryParams.session_id);
      } else if (path === 'checkout/cancel') {
        Alert.alert('Payment cancelled');
      }
    };

    // initial URL (cold start)
    Linking.getInitialURL().then(url => {
      if (url) handleUrl({url});
    });

    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, []);

  async function handleCheckoutSuccess(sessionId: string) {
    try {
      const res = await fetch(
        `https://us-central1-parking-app-1cb84.cloudfunctions.net/verifyCheckoutSession`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({sessionId}),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      if (!data.paid) {
        Alert.alert('Payment not completed', 'Please try again.');
        return;
      }

      // Now safely book the parking spot in Firestore
      const currentUser = getCurrentUser();
      if (!currentUser) {
        Alert.alert(
          'Payment done',
          'Please log in so we can complete your booking.',
        );
        return;
      }

      const result = await bookParkingSpot(data.spotId, currentUser.uid);
      if (result?.success) {
      } else {
        Alert.alert(
          'Warning',
          result?.error ||
            'Booking failed after payment. Please contact support.',
        );
      }
    } catch (err: any) {
      console.error('handleCheckoutSuccess error:', err);
      Alert.alert('Error', err.message || 'Could not confirm payment');
    }
  }

  return (
    <NavigationContainer>
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
        </Stack.Navigator>
      </StripeProvider>
    </NavigationContainer>
  );
}

export default App;
