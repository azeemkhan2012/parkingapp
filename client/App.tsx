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
// import HomePage from './src/components/homePage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import HomePage from './src/components/homePage';
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
      <Stack.Navigator initialRouteName="login">
        <Stack.Screen name="login" component={LoginScreen} />
        <Stack.Screen name="signup" component={SignUpScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="home" component={HomePage} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
