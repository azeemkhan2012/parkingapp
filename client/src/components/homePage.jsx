import React, {useEffect, useState, useRef, useCallback} from 'react';
import {useRoute} from '@react-navigation/native';
import {
  View,
  TextInput,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import MapboxGL, {Logger} from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCurrentUser,
  signOut,
  saveParkingSpotForLater,
  deleteFCMToken as deleteFCMTokenFromFirestore,
  saveFCMToken,
  createPaymentRecord,
  getUnreadCount,
} from '../config/firebase';
import {
  deleteFCMToken as deleteLocalFCMToken,
  initializeFCM,
} from '../utils/notifications';
import {collection, getDocs} from 'firebase/firestore';
import {db} from '../config/firebase';
import NearbyParkingModal from './NearbyParkingModal';
import SavedParkingSpots from './SavedParkingSpots';
import NotificationInbox from './NotificationInbox';
import ReviewFormModal from './ReviewFormModal';

Logger.setLogCallback(log => {
  const {message} = log;
  if (
    message.match('Request failed due to a permanent error: Canceled') ||
    message.match('Request failed due to a permanent error: Socket Closed')
  ) {
    return true;
  }
  return false;
});

MapboxGL.setAccessToken(
  'pk.eyJ1IjoiaHV6YWlmYS1zYXR0YXIxIiwiYSI6ImNsbmQxMmZ6dTAwcHgyam1qeXU2bjcwOXQifQ.Pvx7OyCBvhwtBbHVVKOCEg',
);
MapboxGL.setTelemetryEnabled(false);

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'auto',
});

const INITIAL_COORDINATE = {
  latitude: 37.78825,
  longitude: -122.4324,
  zoomLevel: 14,
};

/* ---------------- Helper: Distance ---------------- */

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = deg => (deg * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // meters
}

const HomePage = ({navigation}) => {
  const route = useRoute();
  const cameraRef = useRef(null);
  const pendingNavigationRef = useRef(null);

  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(INITIAL_COORDINATE.zoomLevel);
  const [userLocation, setUserLocation] = useState(null);
  const [routeDirections, setRouteDirections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [showNearbyModal, setShowNearbyModal] = useState(false);
  const [nearbySpots, setNearbySpots] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [savingSpot, setSavingSpot] = useState(false);
  const [showSavedSpots, setShowSavedSpots] = useState(false);
  const [savedSpotToOpen, setSavedSpotToOpen] = useState(null);
  const [showNotificationInbox, setShowNotificationInbox] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [currentBookingForReview, setCurrentBookingForReview] = useState(null);
  const [searchedLocation, setSearchedLocation] = useState(null);

  // If these exist in your full file, keep them; otherwise define:
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [selectedRouteProfile] = useState('driving');

  /* ---------------- Location Permission ---------------- */

  async function getPermissionLocation() {
    try {
      Geolocation.getCurrentPosition(
        location => {
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          setZoom(15);
          setLoading(false);
        },
        err => {
          Alert.alert('Error', err?.message || 'Could not get location');
          setLoading(false);
        },
        {enableHighAccuracy: true},
      );
    } catch {
      setLoading(false);
    }
  }

  const handleCurrentLocationPress = () => {
    getPermissionLocation();
    setSearch('');
    setRouteDirections(null);
    setDistance(null);
    setDuration(null);
    setSearchedLocation(null);
  };

  useEffect(() => {
    getPermissionLocation();
  }, []);

  /* ---------------- FCM Init on App Start ---------------- */

  useEffect(() => {
    const initializeFCMIfLoggedIn = async () => {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        return;
      }
      try {
        const fcmToken = await initializeFCM();
        if (fcmToken) {
          await saveFCMToken(currentUser.uid, fcmToken);
        }
      } catch {
        // Fail silently – push setup should not block app
      }
    };

    initializeFCMIfLoggedIn();
  }, []);

  /* ---------------- Unread Notification Count ---------------- */

  useEffect(() => {
    const loadUnreadCount = async () => {
      const currentUser = getCurrentUser();
      if (!currentUser) return;

      try {
        const count = await getUnreadCount(currentUser.uid);
        setUnreadCount(count);
      } catch {
        // If unread count fails, ignore; app still works
      }
    };

    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  /* ---------------- Checkout Status Loader ---------------- */

  useEffect(() => {
    const checkCheckoutStatus = async () => {
      try {
        const checkoutInProgress = await AsyncStorage.getItem(
          'checkout_in_progress',
        );
        setIsBookingLoading(checkoutInProgress === 'true');
      } catch {
        setIsBookingLoading(false);
      }
    };

    checkCheckoutStatus();

    const unsubscribe = navigation.addListener('focus', checkCheckoutStatus);

    let intervalId = null;
    if (isBookingLoading) {
      intervalId = setInterval(checkCheckoutStatus, 1000);
    }

    return () => {
      unsubscribe();
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [navigation, isBookingLoading]);

  /* ---------------- Navigation from Notifications / Bookings ---------------- */

  useEffect(() => {
    const params = route.params;

    // Open saved spot directly
    if (params?.openSavedSpot && params?.savedSpotId) {
      setShowSavedSpots(true);
      setSavedSpotToOpen(params.savedSpotId);
      navigation.setParams({openSavedSpot: undefined, savedSpotId: undefined});
    }

    // Booking → Map location
    if (params?.bookingLocation) {
      const {
        latitude,
        longitude,
        spotName,
        spotAddress,
        startNavigation,
        spotId,
        bookingId,
      } = params.bookingLocation;

      if (latitude && longitude) {
        setZoom(15);

        if (spotName) {
          setSearch(spotName);
        } else if (spotAddress) {
          setSearch(spotAddress);
        }

        if (cameraRef.current) {
          try {
            cameraRef.current.setCamera({
              centerCoordinate: [longitude, latitude],
              zoomLevel: 15,
              animationMode: 'flyTo',
              animationDuration: 1000,
            });
          } catch {
            // Camera errors are non-critical
          }
        }

        if (startNavigation) {
          pendingNavigationRef.current = {
            destination: {latitude, longitude},
            routeProfile: selectedRouteProfile,
            timestamp: Date.now(),
            spotId,
            bookingId,
            spotName,
          };
        }

        navigation.setParams({bookingLocation: undefined});
      }
    }
  }, [route.params, navigation, selectedRouteProfile]);

  /* ---------------- Find Nearby Parking ---------------- */

  const findNearbyParking = async () => {
    if (!userLocation) {
      Alert.alert(
        'Location Required',
        'Please enable location services to find nearby parking.',
      );
      return;
    }

    setLoadingNearby(true);
    try {
      const snapshot = await getDocs(collection(db, 'parking_spots'));
      const allSpots = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
        };
      });

      const validSpots = allSpots.filter(spot => {
        const lat =
          spot.latitude ||
          spot.original_data?.location?.latitude ||
          spot.location?.latitude;
        const lon =
          spot.longitude ||
          spot.original_data?.location?.longitude ||
          spot.location?.longitude;
        return lat && lon;
      });

      setNearbySpots(validSpots);
      setShowNearbyModal(true);
    } catch {
      Alert.alert('Error', 'Failed to fetch parking spots. Please try again.');
    } finally {
      setLoadingNearby(false);
    }
  };

  /* ---------------- Start Stripe Checkout ---------------- */

  async function startCheckout(spot) {
    setIsBookingLoading(true);

    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        setIsBookingLoading(false);
        Alert.alert('Login Required', 'Please login to book a parking spot.');
        return;
      }

      const hourlyRate = spot.pricing_hourly;
      const amountCents = hourlyRate * 100;
      const currency = 'usd';

      try {
        await AsyncStorage.setItem(`spot_${spot.id}`, JSON.stringify(spot));
      } catch {
        // Not critical – spot info can be refetched
      }

      try {
        await AsyncStorage.setItem('checkout_in_progress', 'true');
      } catch {
        // Non-critical – only affects loader state
      }

      const response = await fetch(
        'https://us-central1-parking-app-1cb84.cloudfunctions.net/createCheckoutSession',
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            amount: amountCents,
            spotId: spot.id,
            userId: currentUser.uid,
            email: currentUser.email || '',
            name: spot.name || 'Parking Spot Booking',
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      let sessionId = data.sessionId;
      if (!sessionId && data.url) {
        const urlMatch = data.url.match(/\/cs_test_([a-zA-Z0-9]+)/);
        if (urlMatch) {
          sessionId = `cs_test_${urlMatch[1]}`;
        }
      }

      const logData = {
        timestamp: new Date().toISOString(),
        sessionId,
        userId: currentUser.uid,
        spotId: spot.id,
        amount: amountCents,
        status: 'attempting',
      };

      if (sessionId) {
        try {
          await AsyncStorage.setItem(
            'last_payment_attempt',
            JSON.stringify(logData),
          );
        } catch {
          // Not critical
        }
      }

      let paymentResult = null;

      if (sessionId) {
        try {
          paymentResult = await createPaymentRecord(
            currentUser.uid,
            spot.id,
            sessionId,
            amountCents,
            currency,
            {
              spot_name: spot.name || 'Parking Spot',
              spot_address: spot.address || 'Address not available',
            },
          );

          if (paymentResult?.success) {
            logData.status = 'success';
            logData.paymentId = paymentResult.paymentId;
            await AsyncStorage.setItem(
              'last_payment_attempt',
              JSON.stringify(logData),
            );
            await AsyncStorage.setItem(
              `payment_${sessionId}`,
              paymentResult.paymentId,
            );
          } else {
            logData.status = 'failed';
            logData.error = paymentResult?.error;
            await AsyncStorage.setItem(
              'last_payment_attempt',
              JSON.stringify(logData),
            );
          }
        } catch (error) {
          logData.status = 'exception';
          logData.error = error?.message;
          try {
            await AsyncStorage.setItem(
              'last_payment_attempt',
              JSON.stringify(logData),
            );
          } catch {
            // ignore
          }
        }

        if (paymentResult && paymentResult.success && paymentResult.paymentId) {
          try {
            await AsyncStorage.setItem(
              `payment_${sessionId}`,
              paymentResult.paymentId,
            );
          } catch {
            // ignore
          }
        }
      }

      await Linking.openURL(data.url);
      // Loader will be cleared by deep-link handler in App after payment.
    } catch (err) {
      setIsBookingLoading(false);
      try {
        await AsyncStorage.removeItem('checkout_in_progress');
      } catch {
        // ignore
      }

      Alert.alert(
        'Error',
        err?.message || 'Unable to start checkout. Please try again.',
      );
    }
  }

  const handleBookNow = spot => {
    setShowNearbyModal(false);
    startCheckout(spot);
  };

  /* ---------------- Save Spot For Later ---------------- */

  const handleSaveForLater = async spot => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      Alert.alert('Login Required', 'Please login to save parking spots.');
      return;
    }

    if (savingSpot) return;

    const spotName =
      spot?.name ||
      spot?.location?.name ||
      spot?.title ||
      spot?.address ||
      'Parking spot';

    setSavingSpot(true);
    try {
      const result = await saveParkingSpotForLater(currentUser.uid, spot);
      if (result.success) {
        Alert.alert('Saved!', `${spotName} has been saved for later.`);
      } else {
        const errorMsg = result.error || 'Could not save parking spot';
        if (errorMsg.toLowerCase().includes('already saved')) {
          Alert.alert(
            'Already Saved',
            'This parking spot is already in your saved list.',
          );
        } else {
          Alert.alert('Unable to Save', errorMsg);
        }
      }
    } catch {
      Alert.alert(
        'Error',
        'Failed to save parking spot. Please check your connection and try again.',
      );
    } finally {
      setSavingSpot(false);
    }
  };

  /* ---------------- Geocoding & Suggestions ---------------- */

  const geocodeAddress = async address => {
    try {
      const resp = await fetch(
        `https://api.locationiq.com/v1/search.php?key=pk.8d19b1ef7170725976c6f53e5c97774c&q=${encodeURIComponent(
          address,
        )}&format=json&limit=1`,
      );
      const data = await resp.json();
      let latitude;
      let longitude;

      if (Array.isArray(data) && data.length > 0) {
        latitude = parseFloat(data[0].lat);
        longitude = parseFloat(data[0].lon);
      } else if (data && data.lat && data.lon) {
        latitude = parseFloat(data.lat);
        longitude = parseFloat(data.lon);
      } else {
        Alert.alert('Not found', 'Could not find that address.');
        return;
      }

      const newLocation = {latitude, longitude};
      setUserLocation(newLocation);
      setZoom(15);

      if (cameraRef.current) {
        try {
          cameraRef.current.setCamera({
            centerCoordinate: [longitude, latitude],
            zoomLevel: 15,
            animationMode: 'flyTo',
            animationDuration: 1000,
          });
        } catch {
          // ignore
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to search location.');
    }
  };

  function startNavigation() {
    if (!routeDirections) {
      Alert.alert('No route', 'Please select a route first.');
      return;
    }
    setIsNavigating(current => !current);
  }

  const fetchSuggestions = async text => {
    if (!text.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const resp = await fetch(
        `https://api.locationiq.com/v1/autocomplete?key=pk.8d19b1ef7170725976c6f53e5c97774c&q=${text}&limit=5&dedupe=1`,
      );
      const data = await resp.json();
      let normalized = [];

      if (Array.isArray(data)) {
        normalized = data.map(item => ({
          id: item.place_id || item.osm_id || `${item.lat}-${item.lon}`,
          place_name:
            item.display_name ||
            item.place_name ||
            (item.address && item.address.name) ||
            '',
          lat: item.lat ? parseFloat(item.lat) : undefined,
          lon: item.lon ? parseFloat(item.lon) : undefined,
          raw: item,
        }));
      } else if (data && data.features) {
        normalized = data.features.map(f => ({
          id: f.id || f.place_id || `${f.center?.[1]}-${f.center?.[0]}`,
          place_name: f.place_name || f.text || '',
          lat: f.center ? f.center[1] : f.geometry?.coordinates?.[1],
          lon: f.center ? f.center[0] : f.geometry?.coordinates?.[0],
          raw: f,
        }));
      }

      setSuggestions(normalized);
      setShowSuggestions(normalized.length > 0);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionPress = item => {
    setSuggestions([]);
    setShowSuggestions(false);

    if (item && item.lat != null && item.lon != null) {
      const lat = Number(item.lat);
      const lon = Number(item.lon);

      const newLocation = {latitude: lat, longitude: lon};
      setUserLocation(newLocation);
      setSearchedLocation(newLocation); // Marker will use this
      setZoom(14);
      setSearch(item.place_name || item.raw?.display_name || '');

      if (cameraRef.current) {
        try {
          cameraRef.current.setCamera({
            centerCoordinate: [lon, lat],
            zoomLevel: 15,
            animationMode: 'flyTo',
            animationDuration: 1000,
          });
        } catch {
          // ignore
        }
      }
    } else if (item?.place_name || item?.raw?.display_name) {
      const name = item.place_name || item.raw.display_name;
      setSearch(name);
      geocodeAddress(name);
    }
  };

  /* ---------------- Camera behavior ---------------- */

  const cameraCenter = userLocation
    ? [userLocation.longitude, userLocation.latitude]
    : [INITIAL_COORDINATE.longitude, INITIAL_COORDINATE.latitude];

  useEffect(() => {
    if (!userLocation || !cameraRef.current) return;
    try {
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation.longitude, userLocation.latitude],
        zoomLevel: zoom,
        animationMode: 'flyTo',
        animationDuration: 1000,
      });
    } catch {
      // ignore
    }
  }, [userLocation, zoom]);

  /* ---------------- Logout ---------------- */

  const handleLogout = async () => {
    try {
      const currentUser = getCurrentUser();

      if (currentUser) {
        try {
          await deleteFCMTokenFromFirestore(currentUser.uid);
          await deleteLocalFCMToken();
        } catch {
          // Token deletion shouldn't block logout
        }
      }

      await signOut();
      Alert.alert('Signed out', 'You have been logged out.');
      navigation.reset({index: 0, routes: [{name: 'login'}]});
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to log out');
    }
  };

  /* ---------------- Navigation Step Updates ---------------- */

  function handleNavigationUpdate(location) {
    if (!currentStep) return;

    const userLng = location.coords.longitude;
    const userLat = location.coords.latitude;

    cameraRef.current?.setCamera({
      centerCoordinate: isNavigating ? [userLng, userLat] : undefined,
      zoomLevel: isNavigating ? 16 : 14,
      pitch: isNavigating ? 70 : 0,
      animationMode: 'flyTo',
      animationDuration: 1000,
    });

    const nextStep = currentStep[0];
    const [endLng, endLat] = nextStep.maneuver.location;

    const dist = getDistance(userLat, userLng, endLat, endLng);

    if (dist < 20) {
      currentStep.shift();

      if (currentStep.length === 0) {
        Alert.alert('Arrived!', 'You reached your destination.', [
          {
            text: 'OK',
            onPress: () => {
              const pending = pendingNavigationRef.current;
              if (pending && (pending.spotId || pending.bookingId)) {
                setCurrentBookingForReview({
                  spotId: pending.spotId,
                  bookingId: pending.bookingId,
                  spotName: pending.spotName,
                });
                setShowReviewForm(true);
              }
            },
          },
        ]);
        setIsNavigating(false);
      } else {
        setCurrentStep([...currentStep]);
      }
    }
  }

  /* ---------------- Loading Screen ---------------- */

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  /* ---------------- Render ---------------- */

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            setShowSearchBar(prev => !prev);
            setShowDropdown(false);
          }}>
          <Image
            source={require('../assets/search.png')}
            style={styles.iconButtonImage}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={!loadingNearby ? styles.findNearbyButton : {}}
          onPress={findNearbyParking}
          disabled={loadingNearby || !userLocation}>
          {loadingNearby ? (
            <ActivityIndicator color="#999" />
          ) : (
            <>
              <Image
                source={require('../assets/findparking.png')}
                style={styles.findNearbyButtonIcon}
              />
              <Text style={styles.findNearbyButtonText}>
                Find Parking Near Me
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.iconButtonContainer}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={async () => {
              setShowNotificationInbox(true);
              setShowDropdown(false);
              setShowSearchBar(false);

              const currentUser = getCurrentUser();
              if (currentUser) {
                try {
                  const count = await getUnreadCount(currentUser.uid);
                  setUnreadCount(count);
                } catch {
                  // ignore
                }
              }
            }}>
            <Image
              source={require('../assets/notification.png')}
              style={styles.iconButtonImage}
            />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            setShowDropdown(prev => !prev);
            setShowSearchBar(false);
            setShowNotificationInbox(false);
          }}>
          <Image
            source={require('../assets/menu.png')}
            style={styles.iconButtonImage}
          />
        </TouchableOpacity>
      </View>

      {/* Dropdown Menu */}
      {showDropdown && (
        <View style={styles.dropdownMenu}>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setShowDropdown(false);
              navigation.navigate('UserProfileEdit');
            }}>
            <Image
              source={require('../assets/person.png')}
              style={styles.dropdownIcon}
            />
            <Text style={styles.dropdownText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setShowDropdown(false);
              setShowSavedSpots(true);
            }}>
            <Image
              source={require('../assets/bookmark.png')}
              style={styles.dropdownIcon}
            />
            <Text style={styles.dropdownText}>Saved Spots</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setShowDropdown(false);
              navigation.navigate('Bookings');
            }}>
            <Image
              source={require('../assets/bookmark.png')}
              style={styles.dropdownIcon}
            />
            <Text style={styles.dropdownText}>My Bookings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setShowDropdown(false);
              navigation.navigate('BillingHistory');
            }}>
            <Image
              source={require('../assets/time.png')}
              style={styles.dropdownIcon}
            />
            <Text style={styles.dropdownText}>Billing History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dropdownItem, styles.dropdownItemLast]}
            onPress={() => {
              setShowDropdown(false);
              handleLogout();
            }}>
            <Image
              source={require('../assets/arrow.png')}
              style={styles.dropdownIcon}
            />
            <Text style={[styles.dropdownText, styles.logoutText]}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Bar */}
      {showSearchBar && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchBar}
            placeholder="Search by address or location..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={text => {
              setSearch(text);
              fetchSuggestions(text);
            }}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 300);
            }}
            returnKeyType="search"
            autoFocus
          />
          <TouchableOpacity
            style={styles.closeSearchButton}
            onPress={() => {
              setShowSearchBar(false);
              setShowSuggestions(false);
            }}>
            <Image
              source={require('../assets/close.png')}
              style={styles.iconButtonImage}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Suggestions Dropdown */}
      {showSearchBar && showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsDropdown} pointerEvents="box-none">
          {suggestions.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.suggestionItem}
              activeOpacity={0.7}
              onPressIn={() => setShowSuggestions(true)}
              onPress={() => {
                handleSuggestionPress(item);
                setShowSearchBar(false);
                setShowSuggestions(false);
              }}>
              <Text numberOfLines={2}>
                {item.place_name ||
                  item.raw?.display_name ||
                  'Unknown location'}
              </Text>
              {item.raw?.address?.country && (
                <Text style={{fontSize: 12, color: '#666'}}>
                  {item.raw.address.country}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Zoom Controls */}
      <View style={styles.zoomControls}>
        <Text
          style={styles.zoomButton}
          onPress={() => setZoom(z => Math.min(z + 1, 20))}>
          +
        </Text>
        <Text
          style={styles.zoomButton}
          onPress={() => setZoom(z => Math.max(z - 1, 1))}>
          -
        </Text>
      </View>

      {/* Current Location Button */}
      <View style={styles.currentLocationButtonContainer}>
        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={handleCurrentLocationPress}>
          <Image
            source={require('../assets/currentLocation.png')}
            style={styles.currentLocationButtonImage}
          />
        </TouchableOpacity>
      </View>

      {/* Navigation Instruction Banner */}
      {isNavigating && currentStep && (
        <View style={styles.navInstructionWrap} pointerEvents="box-none">
          <View style={styles.navInstructionInner}>
            <View style={styles.navIconContainer}>
              <Image
                source={require('../assets/navigate.png')}
                style={styles.navigateIcon}
              />
            </View>
            <View style={styles.navTextContainer}>
              <Text numberOfLines={2} style={styles.navInstructionText}>
                {currentStep[0]?.maneuver?.instruction}
              </Text>
              <View style={styles.navMetaRow}>
                <Text style={styles.navMetaText}>
                  {currentStep[0]?.distance != null
                    ? `${Math.round(currentStep[0].distance)} m`
                    : ''}
                </Text>
                {currentStep[0]?.duration != null && (
                  <Text style={[styles.navMetaText, {marginLeft: 12}]}>
                    ~{Math.round(currentStep[0].duration / 60)} min
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.navCloseBtn}
              onPress={() => setIsNavigating(false)}>
              <Image
                source={require('../assets/close.png')}
                style={styles.navigateIcon}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Map */}
      <MapboxGL.MapView
        style={{flex: 1}}
        rotateEnabled
        styleURL="mapbox://styles/mapbox/navigation-night-v1"
        zoomEnabled>
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={zoom}
          centerCoordinate={cameraCenter}
          animationMode="flyTo"
          animationDuration={6000}
        />
        {searchedLocation && (
          <MapboxGL.PointAnnotation
            id="searched-location"
            coordinate={[searchedLocation.longitude, searchedLocation.latitude]}
          />
        )}

        <MapboxGL.UserLocation
          animated
          androidRenderMode="gps"
          showsUserHeadingIndicator
          onUpdate={handleNavigationUpdate}
        />
      </MapboxGL.MapView>

      {/* Nearby Parking Modal */}
      <NearbyParkingModal
        visible={showNearbyModal}
        onClose={() => setShowNearbyModal(false)}
        spots={nearbySpots}
        userLocation={userLocation}
        onBookNow={handleBookNow}
        onSaveForLater={handleSaveForLater}
      />

      {/* Saved Parking Spots Modal */}
      <SavedParkingSpots
        visible={showSavedSpots}
        onClose={() => {
          setShowSavedSpots(false);
          setSavedSpotToOpen(null);
        }}
        onBookNow={handleBookNow}
        spotToOpen={savedSpotToOpen}
      />

      {/* Notification Inbox Modal */}
      <NotificationInbox
        visible={showNotificationInbox}
        onClose={async () => {
          setShowNotificationInbox(false);
          const currentUser = getCurrentUser();
          if (currentUser) {
            try {
              const count = await getUnreadCount(currentUser.uid);
              setUnreadCount(count);
            } catch {
              // ignore
            }
          }
        }}
        onReadChange={async () => {
          const currentUser = getCurrentUser();
          if (currentUser) {
            try {
              const count = await getUnreadCount(currentUser.uid);
              setUnreadCount(count);
            } catch {
              // ignore
            }
          }
        }}
        onNotificationTap={notification => {
          if (notification.saved_spot_id) {
            setShowSavedSpots(true);
            setSavedSpotToOpen(notification.saved_spot_id);
          }
        }}
      />

      {/* Booking Loader Overlay */}
      {isBookingLoading && (
        <View style={styles.loaderOverlay}>
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loaderText}>Processing booking...</Text>
            <Text style={styles.loaderSubtext}>Please wait</Text>
          </View>
        </View>
      )}

      {/* Review Form Modal */}
      {currentBookingForReview && (
        <ReviewFormModal
          visible={showReviewForm}
          onClose={() => {
            setShowReviewForm(false);
            setCurrentBookingForReview(null);
            pendingNavigationRef.current = null;
          }}
          spotId={currentBookingForReview.spotId}
          spotName={currentBookingForReview.spotName}
          bookingId={currentBookingForReview.bookingId}
          onReviewSubmitted={() => {
            setShowReviewForm(false);
            setCurrentBookingForReview(null);
            pendingNavigationRef.current = null;
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F6',
  },
  destinationIcon: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 999,
  },
  flatList: {
    position: 'absolute',
    bottom: 20,
    left: Dimensions.get('window').width / 2 - 40,
    right: 0,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  suggestionsDropdown: {
    position: 'absolute',
    top: 150,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    zIndex: 97,
    maxHeight: 400,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  marker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#fff',
  },
  callout: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    minWidth: 120,
  },
  calloutTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bookButton: {
    backgroundColor: '#007AFF',
    padding: 6,
    borderRadius: 4,
    marginTop: 4,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  zoomControls: {
    position: 'absolute',
    top: 180,
    right: 20,
    zIndex: 3,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    padding: 4,
    flexDirection: 'column',
    alignItems: 'center',
  },
  zoomButton: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 6,
    color: '#007AFF',
  },
  currentLocationButtonContainer: {
    position: 'absolute',
    top: 280,
    right: 18,
    zIndex: 3,
    borderRadius: 8,
    padding: 4,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleButton: {
    position: 'absolute',
    top: 140,
    right: 20,
    zIndex: 3,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    padding: 8,
  },
  styleButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  firebaseTestButton: {
    position: 'absolute',
    top: 180,
    right: 20,
    zIndex: 3,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  firebaseTestText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  firebaseStatusText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  noResults: {
    position: 'absolute',
    top: 190,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 80,
    zIndex: 5,
    elevation: 2,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 100,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 22,
    padding: 10,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  iconButtonContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  bellIcon: {
    width: '25',
    height: '25',
  },
  iconButtonImage: {
    width: '100%',
    height: '100%',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 999,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  currentLocationButtonImage: {
    width: 20,
    height: 20,
  },
  dropdownIcon: {
    marginRight: 12,
    width: 20,
    height: 20,
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  logoutText: {
    color: '#F44336',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 98,
  },
  currentLocationButton: {
    width: 34,
    height: 34,
    marginLeft: 8,
    borderRadius: 22,
    padding: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  closeSearchButton: {
    width: 34,
    height: 34,
    marginLeft: 8,
    borderRadius: 22,
    padding: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionButtonsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  topBar: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 16,
    padding: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    zIndex: 10,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    justifyContent: 'space-between',
  },
  filterInput: {
    width: 70,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    backgroundColor: '#f9f9f9',
    height: 50,
  },
  pickerWrapper: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#f9f9f9',
    overflow: 'hidden',
  },
  filterPicker: {
    width: '100%',
    height: 50,
  },
  searchBar: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  findNearbyButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    flexDirection: 'row',
    gap: 4,
  },
  findNearbyButtonIcon: {
    width: '20',
    height: '20',
    paddingRight: '8',
  },
  findNearbyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    display: 'flex',
    justifyContent: 'center',
    gap: 4,
  },
  savedSpotsButton: {
    backgroundColor: '#FFA500',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  savedSpotsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  editBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#28a745',
    borderRadius: 8,
  },
  logoutBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
  },
  actionsText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  startNavButton: {
    position: 'absolute',
    bottom: 26,
    left: 20,
    right: 20,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E86B0A',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  startNavButtonActive: {
    backgroundColor: '#FF3B30',
  },
  startNavButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  startNavButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  navInstructionWrap: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 999,
    alignItems: 'center',
  },
  navInstructionInner: {
    backgroundColor: '#0A84FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    elevation: 8,
  },
  navIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  navigateIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  navTextContainer: {
    flex: 1,
  },
  navInstructionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  navMetaRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  navMetaText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
  },
  navCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  parking: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  routeProfileButton: {
    width: 50,
    height: 50,
    borderRadius: 40,
    marginHorizontal: 8,
    borderColor: '#fff',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  selectedRouteProfileButton: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  routeProfileButtonText: {
    color: '#fff',
    marginTop: 5,
    fontSize: 12,
    fontWeight: '600',
  },
  selectedRouteProfileButtonText: {
    color: '#000',
  },
  bottomRouteCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    flexDirection: 'row',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 999,
  },
  routePathSection: {
    flex: 1,
    paddingRight: 16,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  targetIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
  routeLineContainer: {
    position: 'relative',
    marginLeft: 10,
    marginVertical: 8,
    minHeight: 80,
  },
  dashedLineContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    flexDirection: 'column',
  },
  dashSegment: {
    width: 2,
    height: 6,
    backgroundColor: '#FF69B4',
    marginBottom: 4,
  },
  waypointsContainer: {
    paddingLeft: 20,
    paddingTop: 4,
  },
  waypointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  waypointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF69B4',
    marginRight: 8,
  },
  waypointText: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  locationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  routeInfoSection: {
    flex: 1,
    paddingLeft: 16,
    borderLeftWidth: 1,
    borderLeftColor: '#e0e0e0',
  },
  transportModes: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  transportModeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  transportModeIconSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#fff',
  },
  transportIconImage: {
    width: 24,
    height: 24,
    tintColor: '#000',
  },
  transportIconImageSelected: {
    tintColor: '#007AFF',
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  startBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A84FF',
    paddingVertical: 10,
    borderRadius: 30,
    marginBottom: 16,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
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

export default HomePage;
