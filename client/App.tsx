/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
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
// import {NavigationContainer} from './node_modules/@react-navigation/native/lib/typescript/src';
// import {createNativeStackNavigator} from './node_modules/@react-navigation/native-stack/lib/typescript/src';

// import type {PropsWithChildren} from 'react';

// type SectionProps = PropsWithChildren<{
//   title: string;
// }>;

const Stack = createNativeStackNavigator();

function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <StripeProvider publishableKey="pk_test_51SXKstC1HeXH2oUQuSjQMoH7zT0olUUFg0dQeZshuhyfgwc9TFi5VYyT59GJZXwAotVWnORfoa3QqYU2bEtr4A2T00ecmUBySG">
        <Stack.Navigator initialRouteName="login">
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
