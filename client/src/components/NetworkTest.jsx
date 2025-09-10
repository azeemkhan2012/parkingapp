import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { checkInternetConnection, testFirebaseConnection } from '../utils/networkUtils';

const NetworkTest = () => {
  const [networkStatus, setNetworkStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const testNetwork = async () => {
    setIsLoading(true);
    try {
      const connection = await checkInternetConnection();
      const firebaseTest = await testFirebaseConnection();
      
      setNetworkStatus({
        connection,
        firebaseTest,
        timestamp: new Date().toISOString()
      });
      
      console.log('Network Test Results:', { connection, firebaseTest });
    } catch (error) {
      console.error('Network test failed:', error);
      Alert.alert('Error', 'Network test failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Network Test</Text>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={testNetwork}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Testing...' : 'Test Network Connection'}
        </Text>
      </TouchableOpacity>

      {networkStatus && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusTitle}>Network Status:</Text>
          <Text>Connected: {networkStatus.connection.isConnected ? 'Yes' : 'No'}</Text>
          <Text>Internet: {networkStatus.connection.isInternetReachable ? 'Yes' : 'No'}</Text>
          <Text>Type: {networkStatus.connection.type}</Text>
          <Text>Firebase: {networkStatus.firebaseTest ? 'Reachable' : 'Not Reachable'}</Text>
          <Text>Time: {networkStatus.timestamp}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});

export default NetworkTest;


