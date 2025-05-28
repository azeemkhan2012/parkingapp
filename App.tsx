/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import type {PropsWithChildren} from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

type SectionProps = PropsWithChildren<{
  title: string;
}>;
function App(): React.JSX.Element {
 

  return (
    <View>
      <Text style={styles.textColor}>Parking Space Finder</Text> 

    </View>
  );
}

const styles = StyleSheet.create({
  
  textColor:{
    color:"black", 
    margin:10, 
    textAlign:'center',
  },
  mainDiv:{
    display:"flex", 
    justifyContent:"center",
  }
});

export default App;
