import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  getSpotPrice,
  getSpotCapacity,
  getSpotRating,
  getReviewCount,
} from '../utils/parkingUtils';

/**
 * Modal Component showing detailed information about a parking spot
 */
const ParkingDetailModal = ({
  visible,
  onClose,
  spot,
  onBookNow,
  onSaveForLater,
}) => {
  if (!spot) return null;

  const capacity = getSpotCapacity(spot);
  const price = getSpotPrice(spot);
  const rating = getSpotRating(spot);
  const reviewCount = getReviewCount(spot);
  const hasAvailability = capacity.available > 0;
  const address = spot.address || spot.original_data?.location?.address || spot.location?.address || 'Address not available';
  const name = spot.name || spot.location?.name || 'Parking Spot';
  const hourlyPrice = spot.pricing_hourly || spot.pricing?.hourly || price;
  const dailyPrice = spot.pricing_daily || spot.pricing?.daily || null;
  const lat = spot.calculatedLat || spot.latitude || spot.original_data?.location?.latitude || spot.location?.latitude;
  const lon = spot.calculatedLon || spot.longitude || spot.original_data?.location?.longitude || spot.location?.longitude;

  const handleBookNow = () => {
    onClose();
    if (onBookNow) {
      onBookNow(spot);
    }
  };

  const handleSaveForLater = () => {
    onClose();
    if (onSaveForLater) {
      onSaveForLater(spot);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{name}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Rating */}
            {rating > 0 && (
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingText}>⭐ {rating.toFixed(1)}</Text>
                {reviewCount > 0 && (
                  <Text style={styles.reviewCountText}>({reviewCount} reviews)</Text>
                )}
              </View>
            )}

            {/* Address */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Address</Text>
              <Text style={styles.sectionContent}>{address}</Text>
            </View>

            {/* Location Coordinates */}
            {lat && lon && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Location</Text>
                <Text style={styles.sectionContent}>
                  {lat.toFixed(6)}, {lon.toFixed(6)}
                </Text>
              </View>
            )}

            {/* Distance */}
            {spot.distance !== undefined && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Distance</Text>
                <Text style={styles.sectionContent}>
                  {spot.distance.toFixed(2)} km away
                </Text>
              </View>
            )}

            {/* Pricing */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pricing</Text>
              <View style={styles.pricingRow}>
                <Text style={styles.sectionContent}>
                  Hourly: PKR {hourlyPrice > 0 ? hourlyPrice : 'N/A'}
                </Text>
              </View>
              {dailyPrice && (
                <View style={styles.pricingRow}>
                  <Text style={styles.sectionContent}>
                    Daily: PKR {dailyPrice}
                  </Text>
                </View>
              )}
            </View>

            {/* Availability */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Availability</Text>
              <Text style={[styles.sectionContent, !hasAvailability && styles.unavailableText]}>
                {capacity.available} / {capacity.total} spots available
              </Text>
              {!hasAvailability && (
                <Text style={styles.unavailableNote}>
                  This parking spot is currently full
                </Text>
              )}
            </View>

            {/* Additional Info */}
            {spot.description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.sectionContent}>{spot.description}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actions}>
              {hasAvailability && onBookNow && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.bookButton]}
                  onPress={handleBookNow}>
                  <Text style={styles.bookButtonText}>Book Now</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleSaveForLater}>
                <Text style={styles.saveButtonText}>Save for Later</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxHeight: '90%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 12,
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
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  ratingText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFA500',
  },
  reviewCountText: {
    fontSize: 14,
    color: '#999',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  pricingRow: {
    marginBottom: 4,
  },
  unavailableText: {
    color: '#F44336',
  },
  unavailableNote: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 4,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookButton: {
    backgroundColor: '#007AFF',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  saveButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ParkingDetailModal;

