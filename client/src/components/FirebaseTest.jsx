import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import firestore from '@react-native-firebase/firestore';

const FirebaseTest = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [testData, setTestData] = useState(null);

  useEffect(() => {
    testFirebaseConnection();
  }, []);

  const testFirebaseConnection = async () => {
    try {
      // Test basic Firestore connection
      const testDoc = await firestore()
        .collection('test')
        .doc('connection-test')
        .get();
      
      setIsConnected(true);
      console.log('✅ Firebase connection successful!');
      
      // Try to write a test document
      await firestore()
        .collection('test')
        .doc('connection-test')
        .set({
          timestamp: firestore.FieldValue.serverTimestamp(),
          message: 'Firebase is working!',
          test: true
        });
      
      setTestData('Firebase connection and write test successful!');
      
    } catch (error) {
      console.error('❌ Firebase connection failed:', error);
      setIsConnected(false);
      setTestData(`Firebase error: ${error.message}`);
      Alert.alert('Firebase Test', `Connection failed: ${error.message}`);
    }
  };

  const testReadData = async () => {
    try {
      const snapshot = await firestore()
        .collection('test')
        .limit(5)
        .get();
      
      const documents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      Alert.alert('Firebase Test', `Read ${documents.length} documents successfully!`);
      console.log('Read documents:', documents);
      
    } catch (error) {
      Alert.alert('Firebase Test', `Read failed: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firebase Connection Test</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Connection Status:</Text>
        <Text style={[
          styles.statusText, 
          { color: isConnected ? '#4CAF50' : '#F44336' }
        ]}>
          {isConnected ? '✅ Connected' : '❌ Disconnected'}
        </Text>
      </View>

      {testData && (
        <View style={styles.dataContainer}>
          <Text style={styles.dataLabel}>Test Result:</Text>
          <Text style={styles.dataText}>{testData}</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Text 
          style={styles.button}
          onPress={testFirebaseConnection}
        >
          Test Connection
        </Text>
        
        <Text 
          style={styles.button}
          onPress={testReadData}
        >
          Test Read Data
        </Text>
      </View>
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
    marginBottom: 30,
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 10,
    color: '#333',
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  dataContainer: {
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 20,
    elevation: 2,
  },
  dataLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  dataText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    color: '#fff',
    padding: 15,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    overflow: 'hidden',
  },
});

export default FirebaseTest; 