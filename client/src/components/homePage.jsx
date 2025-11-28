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
} from 'react-native';
import MapboxGL, {Logger} from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';
import {signOut} from '../config/firebase';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ColorfulCard from '@freakycoder/react-native-colorful-card';

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
  zoomLevel: 17,
};

const APIKEY =
  'pk.eyJ1IjoiaHV6YWlmYS1zYXR0YXIxIiwiYSI6ImNsbmQxMmZ6dTAwcHgyam1qeXU2bjcwOXQifQ.Pvx7OyCBvhwtBbHVVKOCEg';

function speakInstruction(step) {
  const text = step.maneuver.instruction;
  Tts.speak(text);
}

const HomePage = ({navigation}) => {
  const [search, setSearch] = useState('');
  // destinationCoords uses [longitude, latitude] (GeoJSON order)
  const [destinationCoords, setDestinationCoords] = useState([67.03, 24.8021]);
  const [zoom, setZoom] = useState(INITIAL_COORDINATE.zoomLevel);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedRouteProfile, setselectedRouteProfile] = useState('driving');
  const [routeDirections, setRouteDirections] = useState(null);
  const [routeStartCoords, setRouteStartCoords] = useState(null);
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
          // setLoading(false);
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

  // Request device location only once on mount
  useEffect(() => {
    getPermissionLocation();
  }, []);

  // Recreate a route whenever the start location or the selected profile changes
  useEffect(() => {
    if (userLocation && selectedRouteProfile) {
      createRouterLine(userLocation, selectedRouteProfile);
    }
  }, [userLocation, selectedRouteProfile]);

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

    // Guard: need valid start coordinates
    if (!coords || coords.longitude == null || coords.latitude == null) {
      console.warn('createRouterLine called with invalid coords:', coords);
      return;
    }

    // store start to show an icon marker
    setRouteStartCoords([coords.longitude, coords.latitude]);

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
      const newStart = {
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      };
      setUserLocation(newStart);
      setZoom(15);
      setSearch(item.place_name || (item.raw && item.raw.display_name) || '');

      // Immediately create the route from the selected start (also handled by the userLocation effect)
      createRouterLine(newStart, selectedRouteProfile);
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
        pitch: 90,
        // heading: location.coords.heading,
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
      zoomLevel: zoom,
      pitch: 70,
        // heading: location.coords.heading,
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
      speakInstruction(nextStep);
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
        solid
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
          ref={cameraRef}
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

        {/* Start marker (when user chooses custom start or location found) */}
        {routeStartCoords && (
          <MapboxGL.PointAnnotation id="start" coordinate={routeStartCoords}>
            <View
              style={[styles.destinationIcon, {backgroundColor: '#2b9cff'}]}>
              {/* use 'navigate' which is used elsewhere in the app */}
              <Ionicons name="navigate" size={22} color="#fff" />
            </View>
          </MapboxGL.PointAnnotation>
        )}

        {/* Destination marker */}
        {destinationCoords && (
          <MapboxGL.PointAnnotation
            id="destination"
            coordinate={destinationCoords}>
            <View style={styles.destinationIcon}>
              {/* <Ionicons name="storefront" size={24} color="#e1310a" /> */}
              <Icon name="parking" size={30} solid color="#900" />
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
    marginBottom: 4,
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
