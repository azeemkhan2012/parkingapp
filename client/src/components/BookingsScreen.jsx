import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {getUserBookings, cancelBooking, getCurrentUser} from '../config/firebase';

const BookingsScreen = ({navigation}) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);

  // Load bookings when screen comes into focus (e.g., after payment)
  useFocusEffect(
    React.useCallback(() => {
      loadBookings();
    }, []),
  );

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'Please login to view bookings');
        navigation.navigate('login');
        return;
      }

      console.log('[BookingsScreen] Loading bookings for user:', currentUser.uid);
      const result = await getUserBookings(currentUser.uid);
      console.log('[BookingsScreen] Bookings result:', result);
      
      if (result.success) {
        console.log('[BookingsScreen] Found bookings:', result.bookings?.length || 0);
        
        // Log booking data for debugging
        if (result.bookings && result.bookings.length > 0) {
          result.bookings.forEach((booking, index) => {
            console.log(`[BookingsScreen] Booking ${index + 1}:`, {
              id: booking.id,
              spot_name: booking.spot_name,
              status: booking.status,
              payment_status: booking.payment_status,
              hasLatitude: !!booking.spot_latitude,
              hasLongitude: !!booking.spot_longitude,
              hasAddress: !!booking.spot_address,
              latitude: booking.spot_latitude,
              longitude: booking.spot_longitude,
            });
          });
        }
        
        setBookings(result.bookings || []);
        
        if (result.bookings && result.bookings.length === 0) {
          console.log('[BookingsScreen] No bookings found. Checking Firestore directly...');
        }
      } else {
        console.error('[BookingsScreen] Failed to load bookings:', result.error);
        Alert.alert('Error', result.error || 'Failed to load bookings');
      }
    } catch (error) {
      console.error('[BookingsScreen] Error loading bookings:', error);
      console.error('[BookingsScreen] Error stack:', error.stack);
      Alert.alert('Error', `Failed to load bookings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async bookingId => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        {text: 'No', style: 'cancel'},
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(bookingId);
            try {
              const currentUser = getCurrentUser();
              const result = await cancelBooking(bookingId, currentUser.uid);
              if (result.success) {
                Alert.alert('Success', 'Booking cancelled successfully');
                loadBookings(); // Reload bookings
              } else {
                Alert.alert('Error', result.error || 'Failed to cancel booking');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel booking');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ],
    );
  };

  const formatDate = date => {
    if (!date) return 'N/A';
    if (typeof date === 'string') return date;
    
    // Handle numeric timestamps (milliseconds since epoch)
    if (typeof date === 'number') {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    
    // Handle Firestore Timestamp objects
    if (date.toDate) date = date.toDate();
    
    // Handle Date objects
    if (date instanceof Date) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    
    return 'N/A';
  };

  const getStatusColor = status => {
    switch (status) {
      case 'active':
        return '#4CAF50';
      case 'cancelled':
        return '#F44336';
      case 'completed':
        return '#2196F3';
      default:
        return '#999';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Image
              source={require('../assets/arrow.png')}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Bookings</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Image
            source={require('../assets/arrow.png')}
            style={styles.backIcon}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <TouchableOpacity onPress={loadBookings} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {bookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No bookings found</Text>
            <Text style={styles.emptySubtext}>
              Your active and past bookings will appear here
            </Text>
          </View>
        ) : (
          bookings.map(booking => (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <View style={styles.bookingHeaderLeft}>
                  <Text style={styles.spotName}>{booking.spot_name}</Text>
                  <View style={styles.statusContainer}>
                    <View
                      style={[
                        styles.statusBadge,
                        {backgroundColor: getStatusColor(booking.status)},
                      ]}>
                      <Text style={styles.statusText}>
                        {booking.status?.toUpperCase() || 'UNKNOWN'}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.bookingAmount}>
                  {booking.currency || 'PKR'} {booking.amount || 0}
                </Text>
              </View>

              <View style={styles.bookingDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Address:</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>
                    {booking.spot_address || 'N/A'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Booked on:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(booking.booked_at)}
                  </Text>
                </View>

                {booking.booking_start && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Start:</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(booking.booking_start)}
                    </Text>
                  </View>
                )}

                {booking.booking_end && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>End:</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(booking.booking_end)}
                    </Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment:</Text>
                  <Text style={styles.detailValue}>
                    {booking.payment_status || 'N/A'} via{' '}
                    {booking.payment_method || 'N/A'}
                  </Text>
                </View>
              </View>

              <View style={styles.actionButtonsContainer}>
                {/* Get Direction button - show if booking has coordinates */}
                {booking.spot_latitude && booking.spot_longitude ? (
                  <TouchableOpacity
                    style={styles.navigateButton}
                    onPress={() => {
                      console.log('[BookingsScreen] Get Direction pressed for booking:', booking.id);
                      console.log('[BookingsScreen] Booking coordinates:', {
                        latitude: booking.spot_latitude,
                        longitude: booking.spot_longitude,
                        spotName: booking.spot_name,
                      });
                      navigation.navigate('home', {
                        bookingLocation: {
                          latitude: booking.spot_latitude,
                          longitude: booking.spot_longitude,
                          spotName: booking.spot_name,
                          spotAddress: booking.spot_address,
                          startNavigation: true, // Flag to start navigation automatically
                        },
                      });
                    }}>
                    <Image
                      source={require('../assets/navigate.png')}
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.navigateButtonText}>Get Direction</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.noLocationContainer}>
                    <Text style={styles.noLocationText}>Location not available</Text>
                  </View>
                )}

                {/* Cancel button - only for active bookings */}
                {booking.status === 'active' && (
                  <TouchableOpacity
                    style={[
                      styles.cancelButton,
                      cancellingId === booking.id && styles.cancelButtonDisabled,
                    ]}
                    onPress={() => handleCancelBooking(booking.id)}
                    disabled={cancellingId === booking.id}>
                    {cancellingId === booking.id ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: '#333',
    transform: [{rotate: '180deg'}],
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refreshText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookingHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  spotName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  bookingAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  bookingDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
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
  actionButtonsContainer: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 12,
  },
  viewMapButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
    tintColor: '#fff',
  },
  viewMapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  navigateButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noLocationContainer: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noLocationText: {
    color: '#999',
    fontSize: 14,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#F44336',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BookingsScreen;

