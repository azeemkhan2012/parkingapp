import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {getSpotReviews} from '../config/firebase';

/**
 * Modal Component displaying all reviews for a parking spot
 */
const ReviewsModal = ({visible, onClose, spotId, spotName}) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && spotId) {
      loadReviews();
    } else {
      // Reset reviews when modal closes
      setReviews([]);
    }
  }, [visible, spotId]);

  const loadReviews = async () => {
    if (!spotId) return;

    setLoading(true);
    try {
      console.log('[ReviewsModal] Loading reviews for spotId:', spotId);
      const result = await getSpotReviews(spotId);
      console.log('[ReviewsModal] Reviews result:', result);
      if (result.success) {
        setReviews(result.reviews || []);
        console.log('[ReviewsModal] Loaded', result.reviews?.length || 0, 'reviews');
      } else {
        console.error('[ReviewsModal] Error loading reviews:', result.error);
        // Don't show alert if there are simply no reviews
        if (result.error && !result.error.includes('not found')) {
          Alert.alert('Error', result.error || 'Failed to load reviews. Please try again.');
        } else {
          // No reviews found, just set empty array
          setReviews([]);
        }
      }
    } catch (error) {
      console.error('[ReviewsModal] Exception loading reviews:', error);
      console.error('[ReviewsModal] Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      // Only show alert for actual errors, not for empty results
      if (error.code !== 'permission-denied') {
        Alert.alert('Error', error.message || 'Failed to load reviews. Please try again.');
      } else {
        setReviews([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = date => {
    if (!date) return 'Unknown date';

    try {
      const reviewDate = date instanceof Date ? date : date.toDate();
      const now = new Date();
      const diffTime = Math.abs(now - reviewDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        if (diffHours === 0) {
          const diffMinutes = Math.floor(diffTime / (1000 * 60));
          return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
        }
        return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return months === 1 ? '1 month ago' : `${months} months ago`;
      } else {
        const years = Math.floor(diffDays / 365);
        return years === 1 ? '1 year ago' : `${years} years ago`;
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown date';
    }
  };

  const renderStars = rating => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push('⭐');
      } else if (i === fullStars && hasHalfStar) {
        stars.push('⭐');
      } else {
        stars.push('☆');
      }
    }
    return stars.join('');
  };

  const getUserInitial = userName => {
    if (!userName || userName.trim().length === 0) return 'A';
    return userName.trim().charAt(0).toUpperCase();
  };

  const renderReviewItem = ({item}) => {
    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View style={styles.userAvatar}>
            <Text style={styles.userInitial}>{getUserInitial(item.user_name)}</Text>
          </View>
          <View style={styles.reviewInfo}>
            <View style={styles.reviewHeaderTop}>
              <Text style={styles.userName}>{item.user_name || 'Anonymous'}</Text>
              {item.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓ Verified</Text>
                </View>
              )}
            </View>
            <View style={styles.ratingRow}>
              <Text style={styles.starsText}>{renderStars(item.rating)}</Text>
              <Text style={styles.ratingNumber}>{item.rating.toFixed(1)}</Text>
            </View>
            <Text style={styles.reviewDate}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
        {item.review_text && item.review_text.trim().length > 0 && (
          <Text style={styles.reviewText}>{item.review_text}</Text>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>⭐</Text>
      <Text style={styles.emptyText}>No reviews yet</Text>
      <Text style={styles.emptySubtext}>
        Be the first to review this parking spot!
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.title}>Reviews</Text>
              {spotName && (
                <Text style={styles.spotName} numberOfLines={1}>
                  {spotName}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Reviews List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading reviews...</Text>
            </View>
          ) : reviews.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={reviews}
              renderItem={renderReviewItem}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={
                <Text style={styles.reviewCount}>
                  {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                </Text>
              }
            />
          )}
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
    maxHeight: '90%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  spotName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
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
  reviewCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  reviewCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  reviewHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  reviewInfo: {
    flex: 1,
  },
  reviewHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  verifiedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  starsText: {
    fontSize: 14,
    marginRight: 8,
  },
  ratingNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFA500',
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
  },
  reviewText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default ReviewsModal;
