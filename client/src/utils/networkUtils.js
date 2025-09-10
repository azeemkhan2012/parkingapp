import NetInfo from '@react-native-community/netinfo';

// Check if device has internet connectivity
export const checkInternetConnection = async () => {
  try {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      isWifi: state.type === 'wifi',
      isCellular: state.type === 'cellular',
      details: state.details
    };
  } catch (error) {
    console.error('Error checking network connection:', error);
    return {
      isConnected: false,
      isInternetReachable: false,
      type: 'unknown',
      isWifi: false,
      isCellular: false,
      details: null
    };
  }
};

// Test Firebase connectivity
export const testFirebaseConnection = async () => {
  try {
    // Simple ping to Firebase
    const response = await fetch('https://firebase.google.com', {
      method: 'HEAD',
      timeout: 5000
    });
    return response.ok;
  } catch (error) {
    console.error('Firebase connection test failed:', error);
    return false;
  }
};

// Get network status summary
export const getNetworkStatus = async () => {
  const connection = await checkInternetConnection();
  const firebaseTest = await testFirebaseConnection();
  
  return {
    ...connection,
    firebaseReachable: firebaseTest,
    timestamp: new Date().toISOString()
  };
};

// Monitor network changes
export const addNetworkListener = (callback) => {
  return NetInfo.addEventListener(callback);
};

// Remove network listener
export const removeNetworkListener = (unsubscribe) => {
  if (unsubscribe) {
    unsubscribe();
  }
};
