import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {getSpotPrice, getSpotCapacity} from '../utils/parkingUtils';

const BookingConfirmation = ({route, navigation}) => {
  const {spot, bookingId} = route.params || {};
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDirections, setLoadingDirections] = useState(false);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    setLoading(true);
    Geolocation.getCurrentPosition(
      location => {
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        setLoading(false);
      },
      err => {
        console.log('location error', err);
        Alert.alert('Error', err.message || 'Could not get location');
        setLoading(false);
      },
      {enableHighAccuracy: true},
    );
  };

  const handleGetDirections = () => {
    if (!userLocation) {
      Alert.alert(
        'Location Required',
        'Please enable location services to get directions.',
      );
      getCurrentLocation();
      return;
    }

    if (!spot) {
      Alert.alert('Error', 'Parking spot information is missing.');
      return;
    }

    // Get coordinates from spot
    const spotLat =
      spot.latitude ||
      spot.original_data?.location?.latitude ||
      spot.location?.latitude;
    const spotLon =
      spot.longitude ||
      spot.original_data?.location?.longitude ||
      spot.location?.longitude;

    if (!spotLat || !spotLon) {
      Alert.alert('Error', 'Parking spot location is not available.');
      return;
    }

    // Navigate to directions view
    navigation.navigate('DirectionsView', {
      spot: spot,
      userLocation: userLocation,
      destinationCoords: {latitude: spotLat, longitude: spotLon},
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading booking details...</Text>
      </View>
    );
  }

  const spotName =
    spot?.name || spot?.location?.name || spot?.title || 'Parking Spot';
  const address =
    spot?.address ||
    spot?.original_data?.location?.address ||
    spot?.location?.address ||
    'Address not available';
  const price = getSpotPrice(spot);
  const capacity = getSpotCapacity(spot);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Success Header */}
      <View style={styles.header}>
        <View style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </View>
        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>
          Your parking spot has been reserved successfully
        </Text>
      </View>

      {/* Booking Details Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Booking Details</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Booking ID:</Text>
          <Text style={styles.detailValue}>
            {bookingId || 'N/A'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Parking Spot:</Text>
          <Text style={styles.detailValue}>{spotName}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Address:</Text>
          <Text style={styles.detailValue}>{address}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Price:</Text>
          <Text style={styles.detailValue}>
            PKR {price > 0 ? price : 'N/A'} / hour
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Availability:</Text>
          <Text style={styles.detailValue}>
            {capacity.available} / {capacity.total} spots available
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.directionsButton}
          onPress={handleGetDirections}
          disabled={loadingDirections}>
          {loadingDirections ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Image
                source={require('../assets/navigate.png')}
                style={styles.buttonIcon}
              />
              <Text style={styles.directionsButtonText}>Get Directions</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('home')}>
          <Text style={styles.backButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F6',
  },
  content: {
    padding: 20,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successIconText: {
    fontSize: 50,
    color: '#fff',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    width: 100,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  actionsContainer: {
    marginTop: 20,
  },
  directionsButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonIcon: {
    width: 24,
    height: 24,
    marginRight: 8,
    tintColor: '#fff',
  },
  directionsButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  backButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});

export default BookingConfirmation;


