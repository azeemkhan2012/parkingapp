/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import SignUpScreen from './src/components/signUpScreen';
// import type {PropsWithChildren} from 'react';
// import LoginScreen from './src/components/loginScreen';

// type SectionProps = PropsWithChildren<{
//   title: string;
// }>;
function App(): React.JSX.Element {
  return (
    <>
      {/* // <LoginScreen /> */}
      <SignUpScreen />
    </>
  );
}

export default App;
