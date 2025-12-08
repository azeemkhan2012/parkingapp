import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import MapboxGL, {Logger} from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';

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

const APIKEY =
  'pk.eyJ1IjoiaHV6YWlmYS1zYXR0YXIxIiwiYSI6ImNsbmQxMmZ6dTAwcHgyam1qeXU2bjcwOXQifQ.Pvx7OyCBvhwtBbHVVKOCEg';

const DirectionsView = ({route, navigation}) => {
  const {bookingLocation} = route.params || {};
  const destinationCoords = bookingLocation;

  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routeDirections, setRouteDirections] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]); // full route geometry
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false); // simulation flag
  const [currentStep, setCurrentStep] = useState(null);
  const [selectedRouteProfile, setSelectedRouteProfile] = useState('driving');
  const [zoom, setZoom] = useState(12);

  const cameraRef = useRef(null);
  const simIntervalRef = useRef(null); // interval ref for simulation

  const routeProfiles = [
    {
      id: 'cycling',
      label: 'Cycling',
      icon: require('../assets/bike.png'),
      mapboxProfile: 'cycling',
    },
    {
      id: 'driving',
      label: 'Driving',
      icon: require('../assets/car.png'),
      mapboxProfile: 'driving',
    },
  ];

  // Get initial location
  useEffect(() => {
    Geolocation.getCurrentPosition(
      position => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      error => {
        console.log('Geolocation error:', error);
        Alert.alert(
          'Location Error',
          'Unable to fetch your current location. Please ensure location services are enabled.',
        );
      },
      {enableHighAccuracy: true},
    );
  }, []);

  // Build the route when we have location + destination or profile changes
  useEffect(() => {
    if (currentLocation && bookingLocation) {
      createRouteLine(currentLocation, selectedRouteProfile);
    }
  }, [currentLocation, destinationCoords, selectedRouteProfile]);

  // Watch real GPS only when navigating AND not simulating
  useEffect(() => {
    if (isNavigating && !isSimulating) {
      const watchId = Geolocation.watchPosition(
        location => {
          setCurrentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        },
        err => console.log('location error', err),
        {enableHighAccuracy: true, distanceFilter: 10},
      );

      return () => {
        Geolocation.clearWatch(watchId);
      };
    }
  }, [isNavigating, isSimulating]);

  // Keep camera on current location
  useEffect(() => {
    if (currentLocation && cameraRef.current) {
      try {
        cameraRef.current.setCamera({
          centerCoordinate: [
            currentLocation.longitude,
            currentLocation.latitude,
          ],
          zoomLevel: isNavigating ? 16 : zoom,
          animationMode: 'flyTo',
          animationDuration: 1000,
        });
      } catch (e) {
        console.warn('Camera update error:', e);
      }
    }
  }, []);

  function makeRouterFeature(coordinates) {
    return {
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
  }

  async function createRouteLine(coords, routeProfile) {
    if (!coords || !destinationCoords) return;
    if (!routeCoords.length > 0) {
      setLoading(true);
    }
    const startCoords = `${coords.longitude},${coords.latitude}`;
    const endCoords = `${destinationCoords.longitude},${destinationCoords.latitude}`;
    const geometries = 'geojson';
    const url = `https://api.mapbox.com/directions/v5/mapbox/${routeProfile}/${startCoords};${endCoords}?alternatives=true&geometries=${geometries}&steps=true&banner_instructions=true&overview=full&voice_instructions=true&access_token=${APIKEY}`;

    try {
      let response = await fetch(url);
      let json = await response.json();

      if (json.routes && json.routes.length > 0) {
        const route = json.routes[0];
        setDistance((route.distance / 1000).toFixed(1));

        const totalSeconds = route.duration;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        if (hours > 0) {
          setDuration(`${hours}H ${minutes} MIN`);
        } else {
          setDuration(`${minutes} MIN`);
        }

        let coordinates = route.geometry.coordinates;
        let steps = route.legs[0].steps;

        setCurrentStep(steps);
        setRouteCoords(coordinates); // store route points for simulation
        setRouteDirections(makeRouterFeature(coordinates));
      } else {
        Alert.alert('Error', 'Could not calculate route. Please try again.');
      }
    } catch (e) {
      console.log('Route error:', e);
      Alert.alert(
        'Error',
        'Failed to get directions. Please check your connection.',
      );
    } finally {
      setLoading(false);
    }
  }

  function startNavigation() {
    if (!routeDirections) {
      Alert.alert('No route', 'Please wait for the route to be calculated.');
      return;
    }

    // Stop simulation if user manually stops navigation
    if (isNavigating && isSimulating) {
      stopSimulation();
    }

    setIsNavigating(prev => !prev);
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
    return R * c;
  }

  function handleNavigationUpdate(location) {
    if (!currentStep || currentStep.length === 0) return;

    const userLng = location.coords.longitude;
    const userLat = location.coords.latitude;

    // Move camera to follow user
    if (cameraRef.current) {
      try {
        cameraRef.current.setCamera({
          centerCoordinate: [userLng, userLat],
          zoomLevel: 16,
          pitch: 70,
          animationMode: 'flyTo',
          animationDuration: 1000,
        });
        setZoom(16);
      } catch (e) {
        console.warn('Camera update error:', e);
      }
    }

    // Extra: Check distance to final destination
    if (destinationCoords) {
      const destDistance = getDistance(
        userLat,
        userLng,
        Number(destinationCoords.latitude),
        Number(destinationCoords.longitude),
      );

      if (destDistance < 20) {
        Alert.alert('Arrived!', 'You reached your destination.');
        setIsNavigating(false);
        setIsSimulating(false);
        setCurrentStep([]);
        stopSimulation();
        return;
      }
    }

    // Check if user reached next step
    const nextStep = currentStep[0];
    if (nextStep && nextStep.maneuver && nextStep.maneuver.location) {
      const [endLng, endLat] = nextStep.maneuver.location;
      const distance = getDistance(userLat, userLng, endLat, endLng);

      if (distance < 20) {
        const updatedSteps = [...currentStep];
        updatedSteps.shift();

        if (updatedSteps.length === 0) {
          Alert.alert('Arrived!', 'You reached your destination.');
          setIsNavigating(false);
          setIsSimulating(false);
          stopSimulation();
        } else {
          setCurrentStep(updatedSteps);
        }
      }
    }
  }

  // --- SIMULATION LOGIC ---

  function startSimulation() {
    if (!routeCoords || routeCoords.length === 0) {
      Alert.alert('No route', 'Route coordinates are not available.');
      return;
    }

    try {
      cameraRef.current.setCamera({
        centerCoordinate: [userLng, userLat],
        zoomLevel: 16,
        pitch: 70,
        animationMode: 'flyTo',
        animationDuration: 1000,
      });
    } catch (e) {
      console.warn('Camera update error:', e);
    }
    setZoom(16);
    // reset if was simulating already
    stopSimulation();

    setIsNavigating(true);
    setIsSimulating(true);

    let index = 0;

    simIntervalRef.current = setInterval(() => {
      if (index >= routeCoords.length) {
        stopSimulation();
        Alert.alert('Arrived!', 'You reached your destination (simulation).');
        setIsNavigating(false);
        setIsSimulating(false);
        return;
      }

      const [lng, lat] = routeCoords[index];

      const fakeLocation = {
        coords: {
          latitude: lat,
          longitude: lng,
        },
      };

      // update marker position
      setCurrentLocation({latitude: lat, longitude: lng});

      // reuse normal navigation logic
      handleNavigationUpdate(fakeLocation);

      index++;
    }, 1000); // 1 second per point
  }

  function stopSimulation() {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
  }

  // Clear sim interval on unmount
  useEffect(() => {
    return () => {
      stopSimulation();
    };
  }, []);

  const cameraCenter = currentLocation
    ? [currentLocation.longitude, currentLocation.latitude]
    : destinationCoords
    ? [Number(destinationCoords.longitude), Number(destinationCoords.latitude)]
    : [-122.4324, 37.78825];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Directions to {destinationCoords?.spotName}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Map */}
      <MapboxGL.MapView
        style={styles.map}
        rotateEnabled={true}
        styleURL="mapbox://styles/mapbox/navigation-night-v1"
        zoomEnabled={true}>
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={zoom}
          centerCoordinate={cameraCenter}
          animationMode="flyTo"
          animationDuration={1000}
        />

        {/* Route Line */}
        {routeDirections && (
          <MapboxGL.ShapeSource id="routeLine" shape={routeDirections}>
            <MapboxGL.LineLayer
              id="routeLineLayer"
              style={{
                lineColor: '#142ffa',
                lineWidth: 8,
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Destination Marker */}
        {destinationCoords && (
          <MapboxGL.PointAnnotation
            id="destination"
            coordinate={[
              Number(destinationCoords.longitude),
              Number(destinationCoords.latitude),
            ]}></MapboxGL.PointAnnotation>
        )}

        {/* User Location */}
        <MapboxGL.UserLocation
          animated={true}
          androidRenderMode={'gps'}
          showsUserHeadingIndicator={true}
          onUpdate={loc => {
            if (isNavigating && !isSimulating) {
              handleNavigationUpdate(loc);
            }
          }}
        />
      </MapboxGL.MapView>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Calculating route...</Text>
        </View>
      )}

      {/* Navigation Instruction Banner */}
      {isNavigating && currentStep && currentStep.length > 0 && (
        <View style={styles.navInstructionWrap}>
          <View style={styles.navInstructionInner}>
            <View style={styles.navIconContainer}>
              <Image
                source={require('../assets/navigate.png')}
                style={styles.navigateIcon}
              />
            </View>
            <View style={styles.navTextContainer}>
              <Text numberOfLines={2} style={styles.navInstructionText}>
                {currentStep[0]?.maneuver?.instruction || 'Continue straight'}
              </Text>
              <View style={styles.navMetaRow}>
                {currentStep[0]?.distance != null && (
                  <Text style={styles.navMetaText}>
                    {Math.round(currentStep[0].distance)} m
                  </Text>
                )}
                {currentStep[0]?.duration != null && (
                  <Text style={[styles.navMetaText, {marginLeft: 12}]}>
                    ~{Math.round(currentStep[0].duration / 60)} min
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.navCloseBtn}
              onPress={() => {
                setIsNavigating(false);
                setIsSimulating(false);
                stopSimulation();
              }}>
              <Image
                source={require('../assets/close.png')}
                style={styles.navigateIcon}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Route Info Card */}
      {routeDirections && distance && duration && (
        <View style={styles.routeCard}>
          <View style={styles.routeInfoSection}>
            <View style={styles.transportModes}>
              {routeProfiles.map(profile => {
                const isSelected =
                  selectedRouteProfile === profile.mapboxProfile;
                return (
                  <TouchableOpacity
                    key={profile.id}
                    style={[
                      styles.transportModeIcon,
                      isSelected && styles.transportModeIconSelected,
                      {marginRight: 8},
                    ]}
                    onPress={() => {
                      setSelectedRouteProfile(profile.mapboxProfile);
                    }}>
                    <Image
                      source={profile.icon}
                      style={[
                        styles.transportIconImage,
                        isSelected && styles.transportIconImageSelected,
                      ]}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.infoLabelRow}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>DISTANCE</Text>
                <Text style={styles.infoValue}>{distance} KM</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ESTIMATED TIME</Text>
                <Text style={styles.infoValue}>{duration}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.startNavButton,
              isNavigating && styles.startNavButtonActive,
            ]}
            onPress={startNavigation}>
            <Text style={styles.startNavButtonText}>
              {isNavigating ? 'Stop Navigation' : '▲ Start Navigation'}
            </Text>
          </TouchableOpacity>

          {/* Simulate button for testing */}
          <TouchableOpacity
            style={[
              styles.startNavButton,
              {marginTop: 10, backgroundColor: '#444'},
            ]}
            onPress={startSimulation}>
            <Text style={styles.startNavButtonText}>▶ Simulate Navigation</Text>
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 100,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 60,
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#fff',
  },
  destinationIcon: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  parkingIcon: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  navInstructionWrap: {
    position: 'absolute',
    top: 70,
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
  routeCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 999,
  },
  routeInfoSection: {
    marginBottom: 16,
  },
  infoLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
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
  startNavButton: {
    backgroundColor: '#0A84FF',
    borderRadius: 28,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startNavButtonActive: {
    backgroundColor: '#0556a7',
  },
  startNavButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default DirectionsView;
