/**
 * Notification utility functions for Firebase Cloud Messaging (FCM)
 */

import messaging from '@react-native-firebase/messaging';
import {Platform, PermissionsAndroid, Alert} from 'react-native';

/**
 * Request notification permissions
 * Returns true if permission granted, false otherwise
 */
export const requestNotificationPermission = async () => {
  try {
    if (Platform.OS === 'android') {
      // For Android 13+ (API 33+), request POST_NOTIFICATIONS permission
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Notification permission denied');
          return false;
        }
      }
    }

    // Request FCM permission
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Notification permission granted');
      return true;
    } else {
      console.log('Notification permission denied');
      return false;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

/**
 * Check if notification permissions are granted
 */
export const checkNotificationPermission = async () => {
  try {
    const authStatus = await messaging().hasPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    console.error('Error checking notification permission:', error);
    return false;
  }
};

/**
 * Get FCM token
 * Returns token string or null if error
 */
export const getFCMToken = async () => {
  try {
    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Delete FCM token (useful for logout)
 */
export const deleteFCMToken = async () => {
  try {
    await messaging().deleteToken();
    console.log('FCM token deleted');
    return true;
  } catch (error) {
    console.error('Error deleting FCM token:', error);
    return false;
  }
};

/**
 * Setup notification listeners
 * Call this when app starts to handle foreground/background notifications
 */
export const setupNotificationListeners = (getNavigation) => {
  // Handle notification when app is in foreground
  const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
    console.log('Foreground notification received:', remoteMessage);
    // Show alert that user can tap to navigate
    if (remoteMessage.notification) {
      const navigation = getNavigation?.();
      Alert.alert(
        remoteMessage.notification.title || 'Notification',
        remoteMessage.notification.body || '',
        [
          {text: 'Close', style: 'cancel'},
          {
            text: 'View',
            onPress: () => {
              // Navigate if notification has data
              if (remoteMessage.data && navigation) {
                handleNotificationNavigation(remoteMessage.data, navigation);
              }
            },
          },
        ],
      );
    }
  });

  // Handle notification when app is opened from background/quit state
  messaging().onNotificationOpenedApp(remoteMessage => {
    console.log('Notification opened app:', remoteMessage);
    // Navigate to relevant screen based on notification data
    const navigation = getNavigation?.();
    if (remoteMessage.data && navigation) {
      handleNotificationNavigation(remoteMessage.data, navigation);
    }
  });

  // Check if app was opened from a notification (when app was completely closed)
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        console.log('App opened from notification:', remoteMessage);
        // Navigate to relevant screen
        const navigation = getNavigation?.();
        if (remoteMessage.data && navigation) {
          // Use setTimeout to ensure navigation is ready
          setTimeout(() => {
            handleNotificationNavigation(remoteMessage.data, navigation);
          }, 1000);
        }
      }
    });

  return unsubscribeForeground;
};

/**
 * Handle navigation based on notification data
 */
const handleNotificationNavigation = (data, navigation) => {
  console.log('handleNotificationNavigation called with data:', data);
  
  // Navigate based on notification data
  if (data.type === 'parking_spot_change' && data.savedSpotId) {
    // Navigate to home screen with params to open specific saved spot
    navigation.navigate('home', {
      openSavedSpot: true,
      savedSpotId: data.savedSpotId,
      spotId: data.spotId,
    });
  }
};

/**
 * Initialize FCM - Request permission and get token
 * Call this when user logs in
 */
export const initializeFCM = async () => {
  try {
    // Check if permission already granted
    const hasPermission = await checkNotificationPermission();
    
    if (!hasPermission) {
      // Request permission
      const granted = await requestNotificationPermission();
      if (!granted) {
        console.log('Notification permission not granted');
        return null;
      }
    }

    // Get FCM token
    const token = await getFCMToken();
    return token;
  } catch (error) {
    console.error('Error initializing FCM:', error);
    return null;
  }
};

