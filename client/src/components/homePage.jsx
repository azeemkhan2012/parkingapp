import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  Alert,
  FlatList,
  ActivityIndicator,
  NativeModules,
} from 'react-native';
import MapboxGL, {Logger} from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ColorfulCard from '@freakycoder/react-native-colorful-card';
import {useRoute} from '@react-navigation/native';
import {
  getParkingSpots,
  bookParkingSpot,
  getCurrentUser,
  signOut,
} from '../config/firebase';
import {Picker} from '@react-native-picker/picker';
import {onSnapshot, collection, getDocs} from 'firebase/firestore';
import {db} from '../config/firebase';
import {fetchSFparkSpots} from '../utils/sfpark';
import NearbyParkingModal from './NearbyParkingModal';
import functions from '@react-native-firebase/functions';
import {useStripe} from '@stripe/stripe-react-native';

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
// MapboxGL.setConnected(true);
MapboxGL.setTelemetryEnabled(false);
// MapboxGL.setWellKnownTileServer('mapbox');
Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'auto',
});

const routeProfiles = [
  {id: 'walking', label: 'Walking', icon: 'walking'},
  {id: 'cycling', label: 'Cylcing', icon: 'bicycle'},
  {id: 'driving', label: 'Driving', icon: 'car'},
];

const INITIAL_COORDINATE = {
  latitude: 37.78825,
  longitude: -122.4324,
  zoomLevel: 12,
};

const APIKEY =
  'pk.eyJ1IjoiaHV6YWlmYS1zYXR0YXIxIiwiYSI6ImNsbmQxMmZ6dTAwcHgyam1qeXU2bjcwOXQifQ.Pvx7OyCBvhwtBbHVVKOCEg';

const HomePage = ({navigation}) => {
  const [search, setSearch] = useState('');
  const [destinationCoords, setDestinationCoords] = useState([24.8021, 67.03]);
  const [zoom, setZoom] = useState(INITIAL_COORDINATE.zoomLevel);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedRouteProfile, setselectedRouteProfile] = useState('driving');
  const [routeDirections, setRouteDirections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [availability, setAvailability] = useState('all');
  const [parkingType, setParkingType] = useState('all');
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);

  const route = useRoute();
  const stripe = useStripe();
  const {initPaymentSheet, presentPaymentSheet} = stripe || {};
  const [useSFpark, setUseSFpark] = useState(false);
  const [showNearbyModal, setShowNearbyModal] = useState(false);
  const [nearbySpots, setNearbySpots] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  console.log('NativeModules----', NativeModules.StripeSdk);

  // Get device location
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
          console.log('location error', err);
          Alert.alert('Error', err.message || 'Could not get location');
          setLoading(false);
        },
        {enableHighAccuracy: true},
      );
    } catch (error) {
      console.error('Error getting location', error);
      setLoading(false);
    }
  }
  useEffect(() => {
    getPermissionLocation();
    //console.log(store.longitude);
    if (selectedRouteProfile !== null) {
      createRouterLine(userLocation, selectedRouteProfile);
    }
  }, [selectedRouteProfile]);

  // Function to find nearby parking spots
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
      // Fetch all parking spots from Firestore
      const snapshot = await getDocs(collection(db, 'parking_spots'));
      const allSpots = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter spots that have valid coordinates
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
    } catch (error) {
      console.error('Error fetching nearby parking:', error);
      Alert.alert('Error', 'Failed to fetch parking spots. Please try again.');
    } finally {
      setLoadingNearby(false);
    }
  };

  async function createPaymentIntent(amount) {
    const response = await functions().httpsCallable('createPaymentIntent')({
      amount,
    });

    return response.data.clientSecret;
  }

  async function pay(amount) {
    console.log('===', typeof initPaymentSheet);
    debugger;
    if (!initPaymentSheet || !presentPaymentSheet) {
      Alert.alert('Error', 'Stripe is not ready. Please try again.');
      console.error('Stripe hooks not available');
      return;
    }

    try {
      const clientSecret = await createPaymentIntent(amount);
      if (!clientSecret) {
        console.error('No clientSecret returned!');
        return;
      }

      const init = await initPaymentSheet({
        merchantDisplayName: 'Parking App',
        paymentIntentClientSecret: clientSecret,
        allowsDelayedPaymentMethods: true,
      })
        .then(d => {
          console.log('d', d);
        })
        .catch(e => {
          console.log('e', e);
        });
      debugger;
      if (init.error) {
        console.log('initError: ', init.error);
        Alert.alert('Error', init.error.message);
        return;
      }

      const result = await presentPaymentSheet();

      if (result.error) {
        console.log('Payment failed:', result.error.message);
        Alert.alert('Payment Failed', result.error.message);
      } else {
        console.log('Payment success!');
        Alert.alert('Success', 'Payment completed!');
      }
    } catch (er) {
      console.log('er...', er);
      Alert.alert('Error', er?.message || 'Payment failed');
    }
  }

  const testStripeMinimal = async () => {
    console.log('=== MINIMAL STRIPE TEST ===');

    try {
      // Test 1: Check hooks are available
      console.log('Test 1: Hooks available');
      console.log('initPaymentSheet:', typeof initPaymentSheet);
      console.log('presentPaymentSheet:', typeof presentPaymentSheet);

      // Test 2: Try with a hardcoded test client secret
      const testSecret = 'pi_test_secret_123'; // This will fail but shouldn't crash

      console.log('Test 2: Calling initPaymentSheet with test secret');
      const result = await initPaymentSheet({
        merchantDisplayName: 'Test',
        paymentIntentClientSecret: testSecret,
      });

      console.log('Test result:', result);
      Alert.alert('Test Result', JSON.stringify(result));
    } catch (error) {
      console.error('Test error:', error);
      Alert.alert('Test Error', error?.message || 'Unknown');
    }
  };

  // Handle book now action
  const handleBookNow = async spot => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      Alert.alert('Login Required', 'Please login to book a parking spot.');
      return;
    }

    try {
      await pay(30000);
      // await testStripeMinimal();
      // const result = await bookParkingSpot(spot.id, currentUser.uid);
      // if (result.success) {
      //   Alert.alert('Success', 'Parking spot booked successfully!');
      //   // Refresh nearby spots
      //   findNearbyParking();
      // } else {
      //   Alert.alert('Error', result.error || 'Booking failed');
      // }
    } catch (error) {
      console.log('error ---- ', error);
      Alert.alert('Error', 'Failed to book parking spot.');
    }
  };

  // Handle save for later action
  const handleSaveForLater = spot => {
    // TODO: Implement save for later functionality
    Alert.alert('Saved', 'Parking spot saved for later!');
    console.log('Saving spot for later:', spot);
  };

  // const filteredSpots = spots.filter(spot => {
  //   const matchesSearch =
  //     !search.trim() ||
  //     (spot.location &&
  //       spot.location.toLowerCase().includes(search.toLowerCase()));
  //   const matchesPrice =
  //     (!minPrice || spot.price >= parseFloat(minPrice)) &&
  //     (!maxPrice || spot.price <= parseFloat(maxPrice));
  //   const matchesAvailability =
  //     availability === 'all' ||
  //     (availability === 'available' && spot.is_available) ||
  //     (availability === 'unavailable' && !spot.is_available);
  //   const matchesType = parkingType === 'all' || spot.type === parkingType;
  //   return matchesSearch && matchesPrice && matchesAvailability && matchesType;
  // });

  const filteredSpots = [
    {
      spot_id: 'khi_128',
      id: 'khi_128',

      name: 'Midway Commercial Parking',
      type: 'lot',

      // Location
      latitude: 25.0312,
      longitude: 67.2823,
      address: 'Midway Commercial, Bahria Town, Karachi',
      city: 'Karachi',
      area: 'Bahria Town',

      // Pricing
      pricing_currency: 'PKR',
      pricing_hourly: 40,
      pricing_daily: 200,
      pricing_freeFor: null,

      // Availability
      availability_available: 58,
      availability_total: 150,

      // Hours
      hours_open: '08:00',
      hours_close: '23:00',
      hours_is24Hours: false,

      // Amenities
      amenities: ['security'],

      // Restrictions
      restrictions: [],

      // Rating
      rating: 3.8,
      reviewCount: 103,

      isActive: true,

      created_at: '2025-11-18T19:22:35Z',
      updated_at: '2025-11-18T19:22:35Z',

      // Full structured object (optional)
      original_data: {
        location: {
          name: 'Midway Commercial Parking',
          address: 'Midway Commercial, Bahria Town, Karachi',
          latitude: 25.0312,
          longitude: 67.2823,
        },
        availability: {
          available: 58,
          total: 150,
        },
        pricing: {
          currency: 'PKR',
          hourly: 40,
          daily: 200,
          freeFor: null,
        },
        hours: {
          open: '08:00',
          close: '23:00',
          is24Hours: false,
        },
        amenities: ['security'],
        restrictions: [],
        rating: 3.8,
        reviewCount: 103,
      },
    },
  ];

  // Geocode address to coordinates (using Mapbox API)
  const geocodeAddress = async address => {
    try {
      // Use LocationIQ forward geocoding (search) to get coordinates
      const resp = await fetch(
        `https://api.locationiq.com/v1/search.php?key=pk.8d19b1ef7170725976c6f53e5c97774c&q=${encodeURIComponent(
          address,
        )}&format=json&limit=1`,
      );
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const latitude = parseFloat(item.lat);
        const longitude = parseFloat(item.lon);
        setUserLocation({latitude, longitude});
        setZoom(15);
      } else if (data && data.lat && data.lon) {
        // sometimes LocationIQ may return an object
        const latitude = parseFloat(data.lat);
        const longitude = parseFloat(data.lon);
        setUserLocation({latitude, longitude});
        setZoom(15);
      } else {
        Alert.alert('Not found', 'Could not find that address.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to search location.');
    }
  };

  function startNavigation() {
    if (!routeDirections) {
      Alert.alert('No route', 'Please select a route first.');
      return;
    }
    setIsNavigating(!isNavigating);
  }

  function makeRouterFeature(coordinates) {
    let routerFeature = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coordinates,
          },
        },
      ],
    };
    return routerFeature;
  }

  async function createRouterLine(coords, routeProfile) {
    console.log(coords, 'coords');

    const startCoords = `${coords.longitude},${coords.latitude}`;

    const endCoords = `${['67.03005', '24.80234']}`;
    const geometries = 'geojson';
    const url = `https://api.mapbox.com/directions/v5/mapbox/${routeProfile}/${startCoords};${endCoords}?alternatives=true&geometries=${geometries}&steps=true&banner_instructions=true&overview=full&voice_instructions=true&access_token=${APIKEY}`;

    try {
      let response = await fetch(url);
      let json = await response.json();
      console.log(json, 'agdfjahg');

      const data = json?.routes.map(data => {
        setDistance((data.distance / 1000).toFixed(2));
        setDuration((data.duration / 3600).toFixed(2));
      });

      let coordinates = json['routes'][0]['geometry']['coordinates'];
      let destinationCoordinates =
        json['routes'][0]['geometry']['coordinates'].slice(-1)[0];
      let steps = json.routes[0].legs[0].steps;
      setCurrentStep(steps);
      setDestinationCoords(destinationCoordinates);
      if (coordinates.length) {
        const routerFeature = makeRouterFeature([...coordinates]);
        console.log(routerFeature, 'routerFeature');

        setRouteDirections(routerFeature);
      }
      setLoading(false);
    } catch (e) {
      setLoading(false);
      console.log(e);
    }
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
      // Normalize data from different providers:
      // - LocationIQ autocomplete returns an Array of places (top-level array)
      // - Mapbox returns an object with `features` array
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
    } catch (e) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // When user selects a suggestion (normalized item)
  const handleSuggestionPress = item => {
    // If we have explicit coordinates, use them. Otherwise fall back to geocoding by name.
    if (item && item.lat != null && item.lon != null) {
      setUserLocation({
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      });
      setZoom(15);
      setSearch(item.place_name || (item.raw && item.raw.display_name) || '');
    } else if (
      item &&
      (item.place_name || (item.raw && item.raw.display_name))
    ) {
      const name = item.place_name || (item.raw && item.raw.display_name);
      setSearch(name);
      // Try geocoding the name as fallback
      geocodeAddress(name);
    }
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Camera center: user location or initial
  const cameraCenter = userLocation
    ? [userLocation.longitude, userLocation.latitude]
    : [INITIAL_COORDINATE.longitude, INITIAL_COORDINATE.latitude];

  // Camera ref to programmatically move camera when needed
  const cameraRef = useRef(null);

  // When userLocation changes, ensure camera moves to that location
  useEffect(() => {
    if (!userLocation || !cameraRef.current) return;
    try {
      // setCamera is supported by the MapboxGL Camera ref in @rnmapbox/maps
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation.longitude, userLocation.latitude],
        zoomLevel: zoom,
        animationMode: 'flyTo',
        animationDuration: 1000,
      });
    } catch (e) {
      // fallback: rely on prop change (centerCoordinate) which is already wired
      // console.warn if needed
    }
  }, [userLocation, zoom]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const handleLogout = async () => {
    try {
      await signOut();
      Alert.alert('Signed out', 'You have been logged out.');
      // send user to the login screen and clear history
      navigation.reset({index: 0, routes: [{name: 'login'}]});
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to log out');
    }
  };

  function handleNavigationUpdate(location) {
    if (!currentStep) return;

    const userLng = location.coords.longitude;
    const userLat = location.coords.latitude;

    // Move camera to follow user
    cameraRef.current?.setCamera({
      centerCoordinate: [userLng, userLat],
      zoomLevel: 16,
      animationMode: 'flyTo',
      animationDuration: 1000,
    });

    // Check if user reached next step
    const nextStep = currentStep[0];
    const [endLng, endLat] = nextStep.maneuver.location;

    const distance = getDistance(userLat, userLng, endLat, endLng);

    if (distance < 20) {
      // Step complete → move to next
      currentStep.shift();

      if (currentStep.length === 0) {
        Alert.alert('Arrived!', 'You reached your destination.');
        setIsNavigating(false);
      } else {
        setCurrentStep([...currentStep]);
      }
    }
  }

  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // meters
  }

  const renderItem = ({item}) => (
    <TouchableOpacity
      style={[
        styles.routeProfileButton,
        item.id == selectedRouteProfile && styles.selectedRouteProfileButton,
      ]}
      onPress={() => setselectedRouteProfile(item.id)}>
      <Icon
        name={item.icon}
        size={24}
        color={
          item.id == selectedRouteProfile ? 'white' : 'rgba(255,255,255,0.6)'
        }
      />
      <Text
        style={[
          styles.routeProfileButtonText,
          item.id == selectedRouteProfile &&
            styles.selectedRouteProfileButtonText,
        ]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => {
          console.log('Testing Stripe availability...');
          if (initPaymentSheet) {
            Alert.alert('Success', 'Stripe is loaded!');
          } else {
            Alert.alert('Error', 'Stripe not loaded');
          }
        }}
        style={{padding: 20, backgroundColor: 'blue'}}>
        <Text style={{color: 'white'}}>Test Stripe</Text>
      </TouchableOpacity>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate('UserProfileEdit')}>
          <Text style={styles.actionsText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.actionsText}>Log Out</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.topBar}>
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
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          returnKeyType="search"
        />

        {/* Find Parking Near Me Button */}
        <TouchableOpacity
          style={styles.findNearbyButton}
          onPress={findNearbyParking}
          disabled={loadingNearby || !userLocation}>
          {loadingNearby ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.findNearbyButtonText}>
              🚗 Find Parking Near Me
            </Text>
          )}
        </TouchableOpacity>
        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <View style={styles.suggestionsDropdown}>
            {suggestions.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.suggestionItem}
                onPress={() => handleSuggestionPress(item)}>
                <Text numberOfLines={2}>
                  {item.place_name ||
                    (item.raw && item.raw.display_name) ||
                    'Unknown'}
                </Text>
                {item.raw && item.raw.address && item.raw.address.country && (
                  <Text style={{fontSize: 12, color: '#666'}}>
                    {item.raw.address.country}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Filter Controls */}
        <View style={styles.filterRow}>
          <TextInput
            style={styles.filterInput}
            placeholder="Min Price"
            placeholderTextColor="#999"
            value={minPrice}
            onChangeText={setMinPrice}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.filterInput}
            placeholder="Max Price"
            placeholderTextColor="#999"
            value={maxPrice}
            onChangeText={setMaxPrice}
            keyboardType="numeric"
          />
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={availability}
              style={styles.filterPicker}
              onValueChange={setAvailability}>
              <Picker.Item label="All" value="all" />
              <Picker.Item label="Available" value="available" />
              <Picker.Item label="Unavailable" value="unavailable" />
            </Picker>
          </View>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={parkingType}
              style={styles.filterPicker}
              onValueChange={setParkingType}>
              <Picker.Item label="All Types" value="all" />
              <Picker.Item label="Street" value="street" />
              <Picker.Item label="Garage" value="garage" />
            </Picker>
          </View>
        </View>
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsDropdown}>
          {suggestions.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.suggestionItem}
              onPress={() => handleSuggestionPress(item)}>
              <Text numberOfLines={2}>
                {item.place_name ||
                  (item.raw && item.raw.display_name) ||
                  'Unknown'}
              </Text>
              {item.raw && item.raw.address && item.raw.address.country && (
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
      {isNavigating && currentStep && (
        <View style={styles.navInstructionWrap} pointerEvents="box-none">
          <View style={styles.navInstructionInner}>
            <View style={styles.navIconContainer}>
              <Ionicons name="navigate" size={22} color="#fff" />
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
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <MapboxGL.MapView
        style={{flex: 1}}
        rotateEnabled={true}
        styleURL="mapbox://styles/mapbox/navigation-night-v1"
        zoomEnabled={true}
        onDidFinishLoadingMap={async () => {
          await createRouterLine(userLocation, selectedRouteProfile);
        }}>
        <MapboxGL.Camera
          // ref={cameraRef}
          zoomLevel={zoom}
          centerCoordinate={cameraCenter}
          animationMode="flyTo"
          animationDuration={6000}
        />

        {routeDirections && (
          <MapboxGL.ShapeSource id="line1" shape={routeDirections}>
            <MapboxGL.LineLayer
              id="routerLine01"
              style={{
                lineColor: '#142ffa',
                lineWidth: 8,
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {destinationCoords && (
          <MapboxGL.PointAnnotation
            id="user-location"
            coordinate={destinationCoords}>
            <View style={styles.destinationIcon}>
              {/* <Ionicons name="storefront" size={24} color="#e1310a" /> */}
              <Icon name="parking" size={30} color="#900" />
            </View>
          </MapboxGL.PointAnnotation>
        )}
        <MapboxGL.UserLocation
          animated={true}
          androidRenderMode={'gps'}
          showsUserHeadingIndicator={true}
          onUpdate={loc => {
            if (isNavigating) handleNavigationUpdate(loc);
          }}
        />

        {/* Show parking spots */}
      </MapboxGL.MapView>
      {filteredSpots.length === 0 && (
        <View style={styles.noResults}>
          <Text>No parking spots found.</Text>
        </View>
      )}
      {routeDirections && (
        <View style={styles.cardContainer}>
          <ColorfulCard
            title={`Dollmen Shopping Center`}
            value={`${duration} h`}
            footerTitle="Distance"
            footerValue={`${distance} km`}
            iconImageSource={require('../assets/info.png')}
            style={{backgroundColor: '#33495F'}}
            onPress={() => {}}
          />
        </View>
      )}
      <FlatList
        data={routeProfiles}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        horizontal
        contentContainerStyle={styles.routeProfileList}
        showsHorizontalScrollIndicator={false}
        style={styles.flatList}
      />
      <TouchableOpacity
        style={[
          styles.startNavButton,
          isNavigating && styles.startNavButtonActive,
        ]}
        onPress={() => startNavigation()}>
        <View style={styles.startNavButtonInner}>
          <Ionicons
            name={isNavigating ? 'play-skip-forward' : 'car'}
            size={18}
            color="#fff"
            style={{marginRight: 10}}
          />
          <Text style={styles.startNavButtonText}>
            {isNavigating ? 'Stop Navigation' : 'Start Navigation'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Nearby Parking Modal */}
      <NearbyParkingModal
        visible={showNearbyModal}
        onClose={() => setShowNearbyModal(false)}
        spots={nearbySpots}
        userLocation={userLocation}
        onBookNow={handleBookNow}
        onSaveForLater={handleSaveForLater}
      />
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
  searchBar: {
    backgroundColor: '#fff',
    borderColor: 'grey',
    borderWidth: 1,
    borderRadius: 50,
    padding: 12,
    margin: 16,
    fontSize: 16,
    zIndex: 2,
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    marginHorizontal: 16,
    elevation: 2,
  },
  suggestionsDropdown: {
    position: 'absolute',
    top: 128,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    zIndex: 9999,
    maxHeight: 'auto',
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
    backgroundColor: '#f9f9f9',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  findNearbyButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  findNearbyButtonText: {
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

  /* Navigation instruction banner */
  navInstructionWrap: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 999,
    alignItems: 'center',
  },
  navInstructionInner: {
    backgroundColor: '#111827',
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
});

export default HomePage;
