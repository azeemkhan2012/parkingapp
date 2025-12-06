import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {
  calculateDistance,
  getSpotPrice,
  getSpotCapacity,
  getSpotRating,
  getReviewCount,
} from '../utils/parkingUtils';
import ParkingDetailModal from './ParkingDetailModal';

/**
 * Modal Component showing nearby parking spots with filters
 * Similar to Google Maps parking results
 */
const NearbyParkingModal = ({
  visible,
  onClose,
  spots,
  userLocation,
  onBookNow,
  onSaveForLater,
}) => {
  // Filter states
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [availability, setAvailability] = useState('all');
  const [distanceFilter, setDistanceFilter] = useState(5); // Default 5km
  const [selectedSpot, setSelectedSpot] = useState(null); // For detail popup

  // Calculate distances and filter spots
  const processedSpots = useMemo(() => {
    if (!userLocation || !spots || spots.length === 0) return [];

    return spots
      .map(spot => {
        // Get coordinates from various possible structures
        const lat =
          spot.latitude ||
          spot.original_data?.location?.latitude ||
          spot.location?.latitude;
        const lon =
          spot.longitude ||
          spot.original_data?.location?.longitude ||
          spot.location?.longitude;

        if (!lat || !lon) return null;

        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          lat,
          lon,
        );

        if (distance === null) return null;

        return {
          ...spot,
          distance,
          calculatedLat: lat,
          calculatedLon: lon,
        };
      })
      .filter(spot => spot !== null && spot.distance <= distanceFilter)
      .sort((a, b) => {
        // Sort by availability first (available first), then by distance
        const aAvailable = getSpotCapacity(a).available > 0;
        const bAvailable = getSpotCapacity(b).available > 0;
        if (aAvailable !== bAvailable) {
          return aAvailable ? -1 : 1;
        }
        return a.distance - b.distance;
      });
  }, [spots, userLocation, distanceFilter]);

  // Apply filters
  const filteredSpots = useMemo(() => {
    return processedSpots.filter(spot => {
      // Price filter
      const spotPrice = getSpotPrice(spot);
      const minPriceNum =
        minPrice && minPrice.trim() ? parseFloat(minPrice) : null;
      const maxPriceNum =
        maxPrice && maxPrice.trim() ? parseFloat(maxPrice) : null;

      if (
        minPriceNum !== null &&
        (isNaN(minPriceNum) || spotPrice < minPriceNum)
      ) {
        return false;
      }
      if (
        maxPriceNum !== null &&
        (isNaN(maxPriceNum) || spotPrice > maxPriceNum)
      ) {
        return false;
      }

      // Availability filter
      const capacity = getSpotCapacity(spot);
      const hasAvailability = capacity.available > 0;

      if (availability === 'available' && !hasAvailability) return false;
      if (availability === 'unavailable' && hasAvailability) return false;

      return true;
    });
  }, [processedSpots, minPrice, maxPrice, availability]);

  const handleViewDetail = (spot) => {
    setSelectedSpot(spot);
  };

  const handleCloseDetail = () => {
    setSelectedSpot(null);
  };

  const handleSaveForLater = spot => {
    if (onSaveForLater) {
      onSaveForLater(spot);
    }
  };

  const renderSpotItem = ({item}) => {
    const capacity = getSpotCapacity(item);
    const price = getSpotPrice(item);
    const rating = getSpotRating(item);
    const reviewCount = getReviewCount(item);
    const hasAvailability = capacity.available > 0;
    const address =
      item.address ||
      item.original_data?.location?.address ||
      item.location?.address ||
      'Address not available';
    const name = item.name || item.location?.name || 'Parking Spot';

    return (
      <View
        style={[
          styles.spotCard,
          !hasAvailability && styles.spotCardUnavailable,
        ]}>
        <View style={styles.spotHeader}>
          <View style={styles.spotInfo}>
            <Text style={styles.spotName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.spotAddress} numberOfLines={2}>
              {address}
            </Text>
          </View>
          {rating > 0 && (
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingText}>⭐ {rating.toFixed(1)}</Text>
              {reviewCount > 0 && (
                <Text style={styles.reviewCountText}>({reviewCount})</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.spotDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Distance:</Text>
            <Text style={styles.detailValue}>
              {item.distance.toFixed(2)} km
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Price:</Text>
            <Text style={styles.detailValue}>
              PKR {price > 0 ? price : 'N/A'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Capacity:</Text>
            <Text
              style={[
                styles.detailValue,
                !hasAvailability && styles.unavailableText,
              ]}>
              {capacity.available} / {capacity.total} available
            </Text>
          </View>
        </View>

        <View style={styles.spotActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.bookButton]}
            onPress={() => handleViewDetail(item)}>
            <Text style={styles.bookButtonText}>View Detail</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={() => handleSaveForLater(item)}>
            <Text style={styles.saveButtonText}>Save for Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };


  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                Nearby Parking ({filteredSpots.length})
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Filters Section */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
              <View style={styles.filtersRow}>
                {/* Price Range */}
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Price Range</Text>
                  <View style={styles.priceInputs}>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="Min"
                      placeholderTextColor="#999"
                      value={minPrice}
                      onChangeText={text => {
                        // Only allow numbers and decimal point
                        const cleaned = text.replace(/[^0-9.]/g, '');
                        setMinPrice(cleaned);
                      }}
                      keyboardType="numeric"
                    />
                    <Text style={styles.priceSeparator}>-</Text>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="Max"
                      placeholderTextColor="#999"
                      value={maxPrice}
                      onChangeText={text => {
                        const cleaned = text.replace(/[^0-9.]/g, '');
                        setMaxPrice(cleaned);
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Availability Filter */}
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Availability</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={availability}
                      style={styles.picker}
                      onValueChange={setAvailability}>
                      <Picker.Item label="All" value="all" />
                      <Picker.Item label="Available" value="available" />
                      <Picker.Item label="Unavailable" value="unavailable" />
                    </Picker>
                  </View>
                </View>

                {/* Distance Filter */}
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Distance</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={distanceFilter.toString()}
                      style={styles.picker}
                      onValueChange={value => setDistanceFilter(parseFloat(value))}>
                      <Picker.Item label="1 km" value="1" />
                      <Picker.Item label="2 km" value="2" />
                      <Picker.Item label="3 km" value="3" />
                      <Picker.Item label="4 km" value="4" />
                      <Picker.Item label="5 km" value="5" />
                    </Picker>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Results List */}
            {filteredSpots.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No parking spots found</Text>
                <Text style={styles.emptySubtext}>
                  Try adjusting your filters or search radius
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredSpots}
                renderItem={renderSpotItem}
                keyExtractor={item => item.id || item.spot_id || String(Math.random())}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>
        </View>
      </Modal>
      <ParkingDetailModal
        visible={selectedSpot !== null}
        onClose={handleCloseDetail}
        spot={selectedSpot}
        onBookNow={onBookNow}
        onSaveForLater={onSaveForLater}
      />
    </>
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
    maxHeight: '90%',
    padding: 20,
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
  filtersContainer: {
    marginBottom: 16,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filterGroup: {
    marginRight: 12,
    minWidth: 120,
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    fontWeight: '600',
  },
  priceInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
    minWidth: 60,
    height: 55,

  },
  priceSeparator: {
    fontSize: 16,
    color: '#666',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: 120,
  },
  listContent: {
    paddingBottom: 10,
  },
  spotCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  spotCardUnavailable: {
    opacity: 0.6,
    backgroundColor: '#f5f5f5',
  },
  spotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  spotInfo: {
    flex: 1,
    marginRight: 12,
  },
  spotName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  spotAddress: {
    fontSize: 14,
    color: '#666',
  },
  ratingContainer: {
    alignItems: 'flex-end',
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFA500',
  },
  reviewCountText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  spotDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    width: 80,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    flex: 1,
  },
  unavailableText: {
    color: '#F44336',
  },
  spotActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 12,
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
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
});

export default NearbyParkingModal;
