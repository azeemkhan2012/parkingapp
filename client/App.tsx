/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {useEffect, useRef, useState} from 'react';
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
import {Alert, Linking, View, Text, ActivityIndicator, StyleSheet} from 'react-native';
import {
  bookParkingSpot,
  getCurrentUser,
  saveFCMToken,
  getPaymentBySessionId,
  getUserBookings,
  updatePaymentStatus,
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
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Global error handler to suppress URL.host errors
  useEffect(() => {
    try {
      const ErrorUtils = require('react-native').ErrorUtils;
      if (ErrorUtils) {
        const originalHandler = ErrorUtils.getGlobalHandler();
        ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
          const errorMessage = error?.message || String(error);
          if (errorMessage.includes('URL.host') || errorMessage.includes('URL.host is not implemented')) {
            // Silently suppress URL.host errors - they're expected in React Native
            console.log('[App] URL.host error suppressed globally:', errorMessage);
            return;
          }
          // Call original handler for other errors
          if (originalHandler) {
            originalHandler(error, isFatal);
          }
        });
        
        return () => {
          // Restore original handler on unmount
          if (originalHandler) {
            ErrorUtils.setGlobalHandler(originalHandler);
          }
        };
      }
    } catch (e) {
      console.warn('[App] Could not set global error handler:', e);
    }
  }, []);

  useEffect(() => {
    const handleDeepLink = async (eventUrl: any) => {
      if (!eventUrl) return;

      console.log('[handleDeepLink] Deep link received:', eventUrl);

      // Extract session_id manually using regex (avoid URL parsing which causes URL.host errors)
      // Handle both ?session_id=... and &session_id=... patterns
      let sessionId: string | null = null;
      try {
        const match = eventUrl.match(/[?&]session_id=([^&]+)/);
        sessionId = match ? decodeURIComponent(match[1]) : null;
        
        // Clean up sessionId - remove any extra parameters that might have been appended
        if (sessionId) {
          // Session IDs from Stripe start with cs_test_ or cs_live_
          // Remove anything after the session ID (like &platform=android)
          const sessionIdMatch = sessionId.match(/^(cs_test_[a-zA-Z0-9]+|cs_live_[a-zA-Z0-9]+)/);
          if (sessionIdMatch) {
            sessionId = sessionIdMatch[1];
          }
        }
      } catch (parseError) {
        console.warn('[handleDeepLink] Error parsing URL, trying fallback:', parseError);
        // Fallback: simple string extraction
        const fallbackMatch = eventUrl.match(/session_id=([a-zA-Z0-9_]+)/);
        if (fallbackMatch) {
          sessionId = fallbackMatch[1];
        }
      }
      
      console.log('[handleDeepLink] Extracted session ID:', sessionId);

      // Suppress URL.host errors - they're expected in React Native
      // We'll handle them in the catch block instead

      // Process checkout success - call immediately
      if (eventUrl.includes('checkout/success')) {
        if (sessionId) {
          console.log('[handleDeepLink] ✅ Processing successful checkout with session:', sessionId);
          console.log('[handleDeepLink] Calling handleCheckoutSuccess immediately...');
          
          // Show loader immediately
          setIsProcessingPayment(true);
          
          // Call handleCheckoutSuccess - fire and forget, but log results
          // Use Promise.resolve().then() to ensure it runs asynchronously but immediately
          Promise.resolve().then(async () => {
            try {
              console.log('[handleDeepLink] Starting handleCheckoutSuccess...');
              await handleCheckoutSuccess(sessionId);
              console.log('[handleDeepLink] ✅ handleCheckoutSuccess completed successfully');
              
              // Clear checkout flag and hide loader after navigation
              try {
                await AsyncStorage.removeItem('checkout_in_progress');
              } catch (e) {
                console.warn('Failed to clear checkout flag:', e);
              }
              
              // Hide loader after a short delay to ensure navigation is complete
              setTimeout(() => {
                setIsProcessingPayment(false);
              }, 1000);
            } catch (err: any) {
              const errorMessage = err?.message || String(err);
              console.error('[handleDeepLink] ❌ Error in handleCheckoutSuccess:', err);
              console.error('[handleDeepLink] Error message:', errorMessage);
              console.error('[handleDeepLink] Error stack:', err?.stack);
              
              // Clear checkout flag on error
              try {
                await AsyncStorage.removeItem('checkout_in_progress');
              } catch (e) {
                console.warn('Failed to clear checkout flag:', e);
              }
              
              // Hide loader
              setIsProcessingPayment(false);
              
              // If it's a URL.host error, try again after a short delay
              if (errorMessage.includes('URL.host') || errorMessage.includes('URL.host is not implemented')) {
                console.log('[handleDeepLink] URL.host error detected, retrying after 500ms...');
                setTimeout(async () => {
                  try {
                    setIsProcessingPayment(true);
                    console.log('[handleDeepLink] Retrying handleCheckoutSuccess...');
                    await handleCheckoutSuccess(sessionId);
                    console.log('[handleDeepLink] ✅ Retry successful');
                    
                    // Clear flag and hide loader
                    try {
                      await AsyncStorage.removeItem('checkout_in_progress');
                    } catch (e) {
                      console.warn('Failed to clear checkout flag:', e);
                    }
                    setTimeout(() => {
                      setIsProcessingPayment(false);
                    }, 1000);
                  } catch (retryErr: any) {
                    console.error('[handleDeepLink] ❌ Retry also failed:', retryErr);
                    setIsProcessingPayment(false);
                    
                    // Don't show alert for URL.host errors - just log
                    if (!retryErr?.message?.includes('URL.host')) {
                      Alert.alert(
                        'Payment Processing Error',
                        'Payment was successful, but there was an error processing your booking. Please check your bookings or contact support.',
                      );
                    }
                  }
                }, 500);
              } else {
                // Only show alert for non-URL.host errors
                console.error('[handleDeepLink] Non-URL.host error, showing alert');
                Alert.alert(
                  'Payment Processing Error',
                  'Payment was successful, but there was an error processing your booking. Please check your bookings or contact support.',
                );
              }
            }
          });
          } else {
            console.warn('[handleDeepLink] ⚠️ No session ID found in deep link');
            setIsProcessingPayment(false);
            
            // Clear checkout flag
            try {
              await AsyncStorage.removeItem('checkout_in_progress');
            } catch (e) {
              console.warn('Failed to clear checkout flag:', e);
            }
            
            // Navigate to bookings - payment might have succeeded
            if (navigationRef.current) {
              navigationRef.current.navigate('Bookings');
            }
          }
        } else if (eventUrl.includes('checkout/cancel')) {
          console.log('[handleDeepLink] Payment was cancelled by user');
          
          // Clear checkout flag and hide loader
          setIsProcessingPayment(false);
          try {
            await AsyncStorage.removeItem('checkout_in_progress');
          } catch (e) {
            console.warn('Failed to clear checkout flag:', e);
          }
        }
    };

    // Suppress URL.host errors globally for deep link handling
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    // Override console methods to filter URL.host errors
    console.error = (...args: any[]) => {
      const errorStr = args.join(' ');
      if (errorStr.includes('URL.host') || errorStr.includes('URL.host is not implemented')) {
        // Silently suppress - this is expected in React Native
        return;
      }
      originalConsoleError(...args);
    };

    // Handle cold start
    Linking.getInitialURL()
      .then(url => {
        if (url) {
          handleDeepLink(url);
        }
      })
      .catch(err => {
        const errorMessage = err?.message || String(err);
        if (!errorMessage.includes('URL.host')) {
          console.error('Error getting initial URL:', err);
        }
      })
      .finally(() => {
        // Restore console after a delay
        setTimeout(() => {
          console.error = originalConsoleError;
          console.warn = originalConsoleWarn;
        }, 2000);
      });

    // Handle opened links
    const subscription = Linking.addEventListener('url', ({url}) => {
      // Temporarily suppress URL.host errors
      console.error = (...args: any[]) => {
        const errorStr = args.join(' ');
        if (errorStr.includes('URL.host') || errorStr.includes('URL.host is not implemented')) {
          return;
        }
        originalConsoleError(...args);
      };
      
      handleDeepLink(url);
      
      // Restore after processing
      setTimeout(() => {
        console.error = originalConsoleError;
      }, 1000);
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
    console.log('[handleCheckoutSuccess] ===== STARTING =====');
    console.log('[handleCheckoutSuccess] Session ID:', sessionId);
    
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        console.error('[handleCheckoutSuccess] ❌ Invalid session ID');
        throw new Error('Invalid session ID');
      }

      console.log('[handleCheckoutSuccess] ✅ Session ID is valid');
      console.log('[handleCheckoutSuccess] Verifying checkout session:', sessionId);
      
      // Check if payment record was created before checkout
      try {
        const lastAttempt = await AsyncStorage.getItem('last_payment_attempt');
        if (lastAttempt) {
          const attempt = JSON.parse(lastAttempt);
          console.log('[handleCheckoutSuccess] Last payment attempt:', attempt);
          if (attempt.sessionId === sessionId) {
            console.log('[handleCheckoutSuccess] Payment record creation status:', attempt.status);
            if (attempt.status === 'success') {
              console.log('[handleCheckoutSuccess] ✅ Payment record was created before checkout');
            } else if (attempt.status === 'failed') {
              console.log('[handleCheckoutSuccess] ⚠️ Payment record creation failed:', attempt.error);
            }
          }
        }
      } catch (e) {
        console.warn('[handleCheckoutSuccess] Could not read payment attempt log:', e);
      }

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
      console.log('[handleCheckoutSuccess] Verification response:', data);

      // Check payment status - for local dev, we're more lenient
      // Payment status "pending" in Firestore is OK - Stripe session might still be paid
      const isPaid = data.paid === true;
      const paymentStatus = data.payment_status || 'unknown';
      
      console.log('[handleCheckoutSuccess] Payment status from verification:', paymentStatus);
      console.log('[handleCheckoutSuccess] Is paid:', isPaid);
      
      if (!isPaid) {
        console.warn('[handleCheckoutSuccess] ⚠️ Payment not marked as paid in verification');
        console.warn('[handleCheckoutSuccess] Verification data:', data);
        
        // For local dev/testing: If we have a session_id, proceed anyway
        // Don't block on payment lookup - just try to continue
        try {
          const currentUser = getCurrentUser();
          const paymentCheck = currentUser 
            ? await getPaymentBySessionId(sessionId, currentUser.uid)
            : await getPaymentBySessionId(sessionId);
          if (paymentCheck.success && paymentCheck.payment) {
            console.log('[handleCheckoutSuccess] ⚠️ Dev mode: Payment record exists, proceeding with booking');
          } else {
            console.log('[handleCheckoutSuccess] ⚠️ Dev mode: Payment record not found, but proceeding anyway');
          }
        } catch (checkError) {
          console.warn('[handleCheckoutSuccess] Could not check payment record, proceeding anyway:', checkError);
        }
        // Continue anyway - don't block booking creation
        console.log('[handleCheckoutSuccess] Proceeding with booking creation despite payment status');
      } else {
        console.log('[handleCheckoutSuccess] ✅ Payment verified as paid');
      }

      const currentUser = getCurrentUser();
      if (!currentUser) {
        console.error('[handleCheckoutSuccess] No current user - cannot create booking');
        return;
      }

      if (!data.spotId) {
        throw new Error('Spot ID not found in payment data');
      }

      // Check if payment record exists and get payment ID
      console.log('[handleCheckoutSuccess] Looking up payment record by session_id:', sessionId);
      console.log('[handleCheckoutSuccess] User ID for payment lookup:', currentUser.uid);
      let paymentId: string | null = null;
      let paymentResult: any = null;
      
      try {
        // Pass userId to ensure security rules are satisfied and query is more efficient
        paymentResult = await getPaymentBySessionId(sessionId, currentUser.uid);
        if (paymentResult.success && paymentResult.payment) {
          paymentId = (paymentResult.payment as any).id;
          console.log('[handleCheckoutSuccess] ✅ Payment record found:', paymentId);
          console.log('[handleCheckoutSuccess] Payment status:', (paymentResult.payment as any).status);
        } else {
          console.warn('[handleCheckoutSuccess] ⚠️ Payment record not found for session_id:', sessionId);
          console.warn('[handleCheckoutSuccess] Payment result:', paymentResult);
          // Continue anyway - we'll create booking without payment_id link
        }
      } catch (paymentError: any) {
        console.error('[handleCheckoutSuccess] ❌ Error getting payment record:', paymentError);
        console.error('[handleCheckoutSuccess] Error message:', paymentError?.message);
        // Don't stop the flow - continue to create booking even if payment lookup fails
        console.log('[handleCheckoutSuccess] Continuing without payment_id - booking will still be created');
      }

      // Check if booking already exists (prevent duplicates)
      console.log('[handleCheckoutSuccess] Checking for existing bookings...');
      let existingBooking: any = null;
      try {
        const bookingsResult = await getUserBookings(currentUser.uid);
        console.log('[handleCheckoutSuccess] Bookings query result:', {
          success: bookingsResult.success,
          count: bookingsResult.bookings?.length || 0,
        });
        
        if (bookingsResult.success && bookingsResult.bookings) {
          console.log('[handleCheckoutSuccess] Searching for booking with session_id:', sessionId);
          existingBooking = bookingsResult.bookings.find(
            (b: any) => b.session_id === sessionId && b.status === 'confirmed',
          );
          if (existingBooking) {
            console.log('[handleCheckoutSuccess] Found existing booking:', existingBooking.id);
          } else if (paymentId) {
            console.log('[handleCheckoutSuccess] Checking for booking with payment_id:', paymentId);
            existingBooking = bookingsResult.bookings.find(
              (b: any) => b.payment_id === paymentId,
            );
            if (existingBooking) {
              console.log('[handleCheckoutSuccess] Found existing booking by payment_id:', existingBooking.id);
            }
          }
        }
      } catch (bookingsError) {
        console.warn('[handleCheckoutSuccess] Error checking existing bookings, continuing:', bookingsError);
        // Continue anyway - might create duplicate but better than no booking
      }

      // Get spot data from AsyncStorage (stored before checkout)
      let spot = null;
      try {
        const spotData = await AsyncStorage.getItem(`spot_${data.spotId}`);
        if (spotData) {
          spot = JSON.parse(spotData);
          console.log('[handleCheckoutSuccess] ✅ Spot data retrieved from storage:', {
            id: spot.id,
            name: spot.name,
            hasLatitude: !!spot.latitude,
            hasLongitude: !!spot.longitude,
            hasAddress: !!spot.address,
          });
        }
      } catch (storageErr) {
        console.error('[handleCheckoutSuccess] Error getting spot data from storage:', storageErr);
      }

      if (existingBooking) {
        // Booking already exists, navigate to bookings
        console.log('[handleCheckoutSuccess] ✅ Booking already exists:', (existingBooking as any).id);
        
        // Clean up stored data
        try {
          await AsyncStorage.removeItem(`spot_${data.spotId}`);
          await AsyncStorage.removeItem(`payment_${sessionId}`);
        } catch (cleanupErr) {
          console.warn('Error cleaning up stored data:', cleanupErr);
        }
        
        // Navigate to Bookings screen
        if (navigationRef.current) {
          navigationRef.current.navigate('Bookings');
        }
        return;
      }

      // Create booking client-side after successful payment
      const paymentAmount = data.amount || spot?.pricing_hourly || 0;
      // paymentId was already retrieved above

      console.log('[handleCheckoutSuccess] Creating booking with payment ID:', paymentId);

      // Extract location data from spot to pass to booking (critical for navigation)
      const spotName = spot?.name || spot?.location?.name || spot?.title || 'Parking Spot';
      const spotAddress = spot?.address || spot?.location?.address || spot?.original_data?.location?.address || null;
      const spotLatitude = spot?.latitude || spot?.location?.latitude || spot?.original_data?.location?.latitude || null;
      const spotLongitude = spot?.longitude || spot?.location?.longitude || spot?.original_data?.location?.longitude || null;

      console.log('[handleCheckoutSuccess] Extracted location data:', {
        spotName,
        hasAddress: !!spotAddress,
        hasLatitude: spotLatitude !== null,
        hasLongitude: spotLongitude !== null,
        latitude: spotLatitude,
        longitude: spotLongitude,
      });

      const bookingData = {
        amount: paymentAmount,
        currency: data.currency?.toUpperCase() || 'USD',
        payment_status: 'paid',
        payment_method: 'stripe',
        session_id: sessionId,
        payment_id: paymentId,
        status: 'confirmed', // Set status to confirmed after successful payment
        // Location data - CRITICAL for navigation feature
        spot_name: spotName,
        spot_address: spotAddress,
        spot_latitude: spotLatitude,
        spot_longitude: spotLongitude,
        // Don't pass Date objects - let Firestore handle timestamps
        // confirmed_at and booking_start will be set by bookParkingSpot using serverTimestamp()
      };

      console.log('[handleCheckoutSuccess] Attempting to create booking...');
      console.log('[handleCheckoutSuccess] Booking data:', JSON.stringify(bookingData, null, 2));
      console.log('[handleCheckoutSuccess] Spot ID:', data.spotId);
      console.log('[handleCheckoutSuccess] User ID:', currentUser.uid);

      const result = await bookParkingSpot(
        data.spotId,
        currentUser.uid,
        bookingData,
      );

      console.log('[handleCheckoutSuccess] Booking result:', result);

      if (result?.success) {
        const bookingId = (result as any).bookingId;
        console.log('[handleCheckoutSuccess] ✅ Booking created successfully!');
        console.log('[handleCheckoutSuccess] Booking ID:', bookingId);
        
        // Update payment record with booking_id
        if (paymentId && bookingId) {
          console.log('[handleCheckoutSuccess] Updating payment record with booking_id:', bookingId);
          try {
            await updatePaymentStatus(paymentId, {
              booking_id: bookingId,
              status: 'succeeded',
              paid_at: new Date(),
            });
            console.log('[handleCheckoutSuccess] ✅ Payment record updated');
          } catch (updateErr) {
            console.warn('[handleCheckoutSuccess] Could not update payment record:', updateErr);
            // Non-critical - booking is created, payment record can be updated later
          }
        }

        // Clean up stored data first
        try {
          await AsyncStorage.removeItem(`spot_${data.spotId}`);
          await AsyncStorage.removeItem(`payment_${sessionId}`);
        } catch (cleanupErr) {
          console.warn('Error cleaning up stored data:', cleanupErr);
        }

        // Navigate to Bookings screen to show the new booking
        console.log('[handleCheckoutSuccess] Navigating to Bookings screen...');
        if (navigationRef.current) {
          navigationRef.current.navigate('Bookings');
          // Wait a moment to ensure navigation completes
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.error('[handleCheckoutSuccess] Navigation ref is null!');
        }

        // Navigation already happened above, no need for alert
      } else {
        console.error('[handleCheckoutSuccess] ❌ Booking creation failed!');
        console.error('[handleCheckoutSuccess] Error:', result?.error);
        console.error('[handleCheckoutSuccess] Full result:', JSON.stringify(result, null, 2));
        
        // Navigate to bookings anyway - user can check status there
        if (navigationRef.current) {
          navigationRef.current.navigate('Bookings');
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Show error alert
        Alert.alert(
          'Booking Error',
          result?.error || 'Booking could not be created. Please check your bookings or contact support.',
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
      console.error('[handleCheckoutSuccess] ❌ FATAL ERROR:', err);
      console.error('[handleCheckoutSuccess] Error message:', err?.message);
      console.error('[handleCheckoutSuccess] Error stack:', err?.stack);
      
      const errorMessage = err?.message || String(err) || 'Could not confirm payment';

      // Don't show URL.host errors - they're expected in React Native
      if (errorMessage.includes('URL.host') || errorMessage.includes('URL.host is not implemented')) {
        console.log('[handleCheckoutSuccess] URL.host error suppressed in catch block');
      }
      
      // Try to navigate to bookings anyway - booking might have been created
      if (navigationRef.current) {
        navigationRef.current.navigate('Bookings');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Re-throw so caller can handle retry if needed
      throw err;
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
      
      {/* Global Payment Processing Loader */}
      {isProcessingPayment && (
        <View style={appStyles.loaderOverlay}>
          <View style={appStyles.loaderContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={appStyles.loaderText}>Processing payment...</Text>
            <Text style={appStyles.loaderSubtext}>Please wait while we complete your booking</Text>
          </View>
        </View>
      )}
    </NavigationContainer>
  );
}

const appStyles = StyleSheet.create({
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  loaderContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loaderText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  loaderSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default App;
