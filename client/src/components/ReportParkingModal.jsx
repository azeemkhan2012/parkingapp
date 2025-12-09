import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {reportParkingSpot, getCurrentUser} from '../config/firebase';
import {
  getSpotPrice,
  getSpotCapacity,
} from '../utils/parkingUtils';

/**
 * Modal Component for reporting parking spot changes
 * Allows users to report availability, pricing, and space changes
 */
const ReportParkingModal = ({visible, onClose, spot, onReportSuccess}) => {
  const [loading, setLoading] = useState(false);
  const [availabilityAvailable, setAvailabilityAvailable] = useState('');
  const [availabilityTotal, setAvailabilityTotal] = useState('');
  const [pricingHourly, setPricingHourly] = useState('');
  const [pricingDaily, setPricingDaily] = useState('');

  // Initialize form with current spot data when modal opens
  useEffect(() => {
    if (visible && spot) {
      const capacity = getSpotCapacity(spot);
      const price = getSpotPrice(spot);
      
      setAvailabilityAvailable(
        capacity.available !== undefined ? capacity.available.toString() : '',
      );
      setAvailabilityTotal(
        capacity.total !== undefined ? capacity.total.toString() : '',
      );
      setPricingHourly(price > 0 ? price.toString() : '');
      setPricingDaily(
        spot.pricing_daily || spot.pricing?.daily
          ? (spot.pricing_daily || spot.pricing.daily).toString()
          : '',
      );
    }
  }, [visible, spot]);

  const handleReport = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      Alert.alert('Login Required', 'Please login to report parking changes.');
      return;
    }

    // For saved spots, use spot_id (the actual parking_spots document ID)
    // For regular spots, use id (the Firestore document ID)
    // NOTE: Do NOT use original_data.id - that's the JSON data ID, not the Firestore document ID
    const spotId = spot?.spot_id || spot?.id;
    if (!spot || !spotId) {
      console.error('[ReportParkingModal] Invalid spot data:', {
        spot: spot,
        hasSpotId: !!spot?.spot_id,
        hasId: !!spot?.id,
        spotIdValue: spot?.id,
        spotIdType: typeof spot?.id,
        spotSpotIdValue: spot?.spot_id,
        spotSpotIdType: typeof spot?.spot_id,
      });
      Alert.alert('Error', 'Invalid parking spot. Missing spot ID.');
      return;
    }
    
    console.log('[ReportParkingModal] Using spot ID:', spotId, 'from spot:', {
      hasSpotId: !!spot?.spot_id,
      hasId: !!spot?.id,
      idValue: spot?.id,
      spotIdValue: spot?.spot_id,
    });

    // Validate that at least one field is provided
    if (
      !availabilityAvailable &&
      !availabilityTotal &&
      !pricingHourly &&
      !pricingDaily
    ) {
      Alert.alert(
        'No Changes',
        'Please provide at least one change to report.',
      );
      return;
    }

    // Build report data
    const reportData = {};
    if (availabilityAvailable) {
      const available = parseInt(availabilityAvailable);
      if (isNaN(available) || available < 0) {
        Alert.alert('Invalid Input', 'Available spots must be a valid number.');
        return;
      }
      reportData.availability_available = available;
    }

    if (availabilityTotal) {
      const total = parseInt(availabilityTotal);
      if (isNaN(total) || total < 1) {
        Alert.alert('Invalid Input', 'Total spots must be at least 1.');
        return;
      }
      reportData.availability_total = total;
    }

    if (pricingHourly) {
      const hourly = parseFloat(pricingHourly);
      if (isNaN(hourly) || hourly < 0) {
        Alert.alert('Invalid Input', 'Hourly price must be a valid number.');
        return;
      }
      reportData.pricing_hourly = hourly;
    }

    if (pricingDaily) {
      const daily = parseFloat(pricingDaily);
      if (isNaN(daily) || daily < 0) {
        Alert.alert('Invalid Input', 'Daily price must be a valid number.');
        return;
      }
      reportData.pricing_daily = daily;
    }

    setLoading(true);
    try {
      const result = await reportParkingSpot(spotId, reportData);
      if (result.success) {
        Alert.alert(
          'Report Submitted',
          'Thank you for your report! The parking spot information has been updated and users will be notified.',
          [
            {
              text: 'OK',
              onPress: () => {
                onClose();
                if (onReportSuccess) {
                  onReportSuccess();
                }
              },
            },
          ],
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to submit report.');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      // Reset form
      setAvailabilityAvailable('');
      setAvailabilityTotal('');
      setPricingHourly('');
      setPricingDaily('');
      onClose();
    }
  };

  if (!spot) return null;

  const spotName = spot.name || spot.location?.name || 'Parking Spot';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Report Changes</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              disabled={loading}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.spotName}>{spotName}</Text>
          <Text style={styles.description}>
            Help keep parking information up to date by reporting any changes
            you notice.
          </Text>

          {/* Availability Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Availability</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Available Spots</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 5"
                  placeholderTextColor="#999"
                  value={availabilityAvailable}
                  onChangeText={text => {
                    const cleaned = text.replace(/[^0-9]/g, '');
                    setAvailabilityAvailable(cleaned);
                  }}
                  keyboardType="numeric"
                  editable={!loading}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Total Spots</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 10"
                  placeholderTextColor="#999"
                  value={availabilityTotal}
                  onChangeText={text => {
                    const cleaned = text.replace(/[^0-9]/g, '');
                    setAvailabilityTotal(cleaned);
                  }}
                  keyboardType="numeric"
                  editable={!loading}
                />
              </View>
            </View>
          </View>

          {/* Pricing Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Hourly (PKR)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 200"
                  placeholderTextColor="#999"
                  value={pricingHourly}
                  onChangeText={text => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    setPricingHourly(cleaned);
                  }}
                  keyboardType="decimal-pad"
                  editable={!loading}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Daily (PKR)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 1200"
                  placeholderTextColor="#999"
                  value={pricingDaily}
                  onChangeText={text => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    setPricingDaily(cleaned);
                  }}
                  keyboardType="decimal-pad"
                  editable={!loading}
                />
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={loading}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleReport}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  spotName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ReportParkingModal;
