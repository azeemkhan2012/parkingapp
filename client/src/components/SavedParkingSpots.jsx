import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  getSavedParkingSpots,
  deleteSavedParkingSpot,
  getCurrentUser,
} from '../config/firebase';
import {
  getSpotPrice,
  getSpotCapacity,
  getSpotRating,
  getReviewCount,
} from '../utils/parkingUtils';
import ParkingDetailModal from './ParkingDetailModal';

/**
 * Modal Component showing saved parking spots
 */
const SavedParkingSpots = ({visible, onClose, onBookNow}) => {
  const [savedSpots, setSavedSpots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState(null);

  useEffect(() => {
    if (visible) {
      loadSavedSpots();
    }
  }, [visible]);

  const loadSavedSpots = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      Alert.alert('Error', 'Please login to view saved spots');
      onClose();
      return;
    }

    setLoading(true);
    try {
      const spots = await getSavedParkingSpots(currentUser.uid);
      // Data is already in the correct format from getSavedParkingSpots
      setSavedSpots(spots);
    } catch (error) {
      Alert.alert('Error', 'Failed to load saved spots: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (spot) => {
    Alert.alert(
      'Remove Saved Spot',
      'Are you sure you want to remove this spot from your saved list?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteSavedParkingSpot(spot.savedSpotId);
              if (result.success) {
                // Remove from local state
                setSavedSpots(prev => prev.filter(s => s.savedSpotId !== spot.savedSpotId));
                Alert.alert('Success', 'Spot removed from saved list');
              } else {
                Alert.alert('Error', result.error || 'Failed to remove spot');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to remove spot: ' + error.message);
            }
          },
        },
      ],
    );
  };

  const handleViewDetail = (spot) => {
    setSelectedSpot(spot);
  };

  const handleCloseDetail = () => {
    setSelectedSpot(null);
  };

  const renderSpotItem = ({item}) => {
    const capacity = getSpotCapacity(item);
    const price = getSpotPrice(item);
    const rating = getSpotRating(item);
    const reviewCount = getReviewCount(item);
    const hasAvailability = capacity.available > 0;
    const address = item.address || item.original_data?.location?.address || item.location?.address || 'Address not available';
    const name = item.name || item.location?.name || 'Parking Spot';

    return (
      <View style={styles.spotCard}>
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
            <Text style={styles.detailLabel}>Price:</Text>
            <Text style={styles.detailValue}>
              PKR {price > 0 ? price : 'N/A'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Capacity:</Text>
            <Text style={[styles.detailValue, !hasAvailability && styles.unavailableText]}>
              {capacity.available} / {capacity.total} available
            </Text>
          </View>
        </View>

        <View style={styles.spotActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={() => handleViewDetail(item)}>
            <Text style={styles.viewButtonText}>View Detail</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item)}>
            <Text style={styles.deleteButtonText}>Remove</Text>
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
                Saved Parking Spots ({savedSpots.length})
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Loading State */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading saved spots...</Text>
              </View>
            ) : savedSpots.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No saved parking spots</Text>
                <Text style={styles.emptySubtext}>
                  Save parking spots to view them here later
                </Text>
              </View>
            ) : (
              <FlatList
                data={savedSpots}
                renderItem={renderSpotItem}
                keyExtractor={item => item.savedSpotId || item.id || item.spot_id || String(Math.random())}
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
        onSaveForLater={() => {
          // Already saved, so just close
          handleCloseDetail();
        }}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
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
  viewButton: {
    backgroundColor: '#007AFF',
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  deleteButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
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

export default SavedParkingSpots;

