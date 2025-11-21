import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  Alert,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';
import {
  getParkingSpots,
  bookParkingSpot,
  getCurrentUser,
  signOut,
} from '../config/firebase';
import {Picker} from '@react-native-picker/picker';
import {onSnapshot, collection} from 'firebase/firestore';
import {db} from '../config/firebase';
import {fetchSFparkSpots} from '../utils/sfpark';

MapboxGL.setAccessToken(
  'pk.eyJ1IjoiaHV6YWlmYS1zYXR0YXIxIiwiYSI6ImNsbmQxMmZ6dTAwcHgyam1qeXU2bjcwOXQifQ.Pvx7OyCBvhwtBbHVVKOCEg',
);

const INITIAL_COORDINATE = {
  latitude: 37.78825,
  longitude: -122.4324,
  zoomLevel: 12,
};

const HomePage = ({navigation}) => {
  const [search, setSearch] = useState('');
  const [spots, setSpots] = useState([]);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [zoom, setZoom] = useState(INITIAL_COORDINATE.zoomLevel);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [availability, setAvailability] = useState('all');
  const [parkingType, setParkingType] = useState('all');
  const [useSFpark, setUseSFpark] = useState(false);

  // Get device location
  useEffect(() => {
    const requestLocation = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Location permission is required.');
          setLoading(false);
          return;
        }
      }
      Geolocation.getCurrentPosition(
        position => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setUserLocation({
            latitude: lat,
            longitude: lon,
          });
          // zoom closer to user's location on app open
          setZoom(15);

          reverseGeocode(lat, lon).catch(() => {});
          setLoading(false);
        },
        error => {
          Alert.alert('Error', 'Could not get location');
          setLoading(false);
        },
        {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
      );
    };
    requestLocation();
  }, []);

  // Fetch parking spots
  // useEffect(() => {
  //   const fetchSpots = async () => {
  //     const spotsData = await getParkingSpots();
  //     setSpots(spotsData);
  //   };
  //   fetchSpots();
  // }, []);
  useEffect(() => {
    if (useSFpark && userLocation) {
      fetchSFparkSpots(userLocation.latitude, userLocation.longitude).then(
        setSpots,
      );
    } else {
      // Listen for Firestore updates
      const unsubscribe = onSnapshot(
        collection(db, 'parking_spots'),
        snapshot => {
          const spotsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          setSpots(spotsData);
        },
      );
      return () => unsubscribe();
    }
  }, [useSFpark, userLocation]);

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

  // Reverse geocode coordinates to a human-friendly place name (LocationIQ)
  const reverseGeocode = async (latitude, longitude) => {
    try {
      const resp = await fetch(
        `https://api.locationiq.com/v1/reverse.php?key=pk.8d19b1ef7170725976c6f53e5c97774c&lat=${encodeURIComponent(
          latitude,
        )}&lon=${encodeURIComponent(longitude)}&format=json`,
      );
      const data = await resp.json();
      if (data) {
        // LocationIQ returns display_name field
        const name =
          data.display_name || (data.address && data.address.city) || '';
        if (name) setSearch(name);
      }
    } catch (e) {
      console.warn('Reverse geocode failed', e);
    }
  };

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

  // Route and distance state
  const [routeGeoJSON, setRouteGeoJSON] = useState(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState(null);

  // Helper: extract numeric coords from a spot object
  const getCoordsFromSpot = spot => {
    if (!spot) return {lat: null, lon: null};
    const lon = Number(
      spot.longitude ??
        spot.original_data?.location?.longitude ??
        spot.location?.longitude ??
        spot.lon ??
        0,
    );
    const lat = Number(
      spot.latitude ??
        spot.original_data?.location?.latitude ??
        spot.location?.latitude ??
        spot.lat ??
        0,
    );
    return {lat: isFinite(lat) ? lat : null, lon: isFinite(lon) ? lon : null};
  };

  // Helper: haversine distance in kilometers
  const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
    if ([lat1, lon1, lat2, lon2].some(v => v == null)) return null;
    const toRad = deg => (deg * Math.PI) / 180;
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((R * c) * 100) / 100; // two decimals
  };

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

  const handleBookSpot = async spotId => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      Alert.alert('Error', 'Please login to book a spot');
      return;
    }
    const result = await bookParkingSpot(spotId, currentUser.uid);
    if (result.success) {
      Alert.alert('Success', 'Spot booked successfully!');
      const spotsData = await getParkingSpots();
      setSpots(spotsData);
    } else {
      Alert.alert('Error', result.error || 'Booking failed');
    }
  };

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
      <MapboxGL.MapView style={{flex: 1}}>
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={zoom}
          centerCoordinate={cameraCenter}
          animationMode="flyTo"
          animationDuration={1000}
        />
        {/* show native user location indicator */}
        <MapboxGL.UserLocation visible={true} />
        {/* Show user location */}
        {userLocation && (
          <MapboxGL.PointAnnotation
            id="user-location"
            coordinate={[userLocation.longitude, userLocation.latitude]}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: '#007AFF',
                borderWidth: 2,
                borderColor: '#fff',
              }}
            />
          </MapboxGL.PointAnnotation>
        )}
        {/* Show parking spots */}
        {filteredSpots.map(spot => {
          console.log(spot, 'spot-debug');

          const lon = Number(spot.longitude ?? spot.original_data?.location?.longitude ?? spot.location?.longitude ?? spot.lon ?? 0);
          const lat = Number(spot.latitude ?? spot.original_data?.location?.latitude ?? spot.location?.latitude ?? spot.lat ?? 0);

          return (
            <MapboxGL.PointAnnotation
              key={String(spot.id)}
              id={String(spot.id)}
              coordinate={[lon, lat]}
              onSelected={() => setSelectedSpot(spot)}>
              <View
                style={[
                  styles.marker,
                  {
                    backgroundColor: spot.availability_available
                      ? '#4CAF50'
                      : '#B0BEC5',
                  },
                ]}>
                <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 10}}>
                  ${spot?.pricing?.daily || 'N/A'}
                  gshfgsjhg
                </Text>
              </View>

              <MapboxGL.Callout key={`callout-${spot.id}`}>
                {selectedSpot?.id === spot.id ? (
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>
                      {spot?.location.address}
                    </Text>
                    <Text>Address: {spot?.address || 'N/A'}</Text>
                    <Text>Type: {spot?.type}</Text>
                    <Text>Price: ${spot?.pricing?.daily}</Text>
                    <Text>Available: {spot?.is_available ? 'Yes' : 'No'}</Text>
                    <Text>Hours: {spot?.hours.open || '24/7'}</Text>
                    <Text>Restrictions: {spot?.restrictions || 'None'}</Text>
                    <TouchableOpacity
                      style={styles.bookButton}
                      onPress={() => handleBookSpot(spot?.id)}>
                      <Text style={styles.bookButtonText}>Book Spot</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Empty view to keep Callout valid for Mapbox
                  <View style={{height: 1, width: 1}} />
                )}
              </MapboxGL.Callout>
            </MapboxGL.PointAnnotation>
          );
        })}
      </MapboxGL.MapView>
      {filteredSpots.length === 0 && (
        <View style={styles.noResults}>
          <Text>No parking spots found.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F6',
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
    top: 68,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    zIndex: 10,
    maxHeight: 180,
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
});

export default HomePage;
