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
  ScrollView,
} from 'react-native';
import {submitReview, checkUserHasReviewed} from '../config/firebase';

/**
 * Modal Component for submitting reviews and ratings
 */
const ReviewFormModal = ({
  visible,
  onClose,
  spotId,
  spotName,
  bookingId = null,
  onReviewSubmitted,
}) => {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(false);

  useEffect(() => {
    if (visible && spotId) {
      // Reset form when modal opens
      setRating(0);
      setReviewText('');
      // Optionally check if user already reviewed
      // checkExistingReview();
    }
  }, [visible, spotId]);

  const checkExistingReview = async () => {
    if (!spotId) return;

    setCheckingExisting(true);
    try {
      const {getCurrentUser} = require('../config/firebase');
      const currentUser = getCurrentUser();
      if (currentUser) {
        const result = await checkUserHasReviewed(spotId, currentUser.uid);
        if (result.success && result.hasReviewed) {
          Alert.alert(
            'Already Reviewed',
            'You have already reviewed this parking spot. You can update your review if needed.',
            [{text: 'OK'}],
          );
        }
      }
    } catch (error) {
      console.error('Error checking existing review:', error);
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleStarPress = starValue => {
    setRating(starValue);
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => handleStarPress(i)}
          style={styles.starButton}
          disabled={loading}>
          <Text style={[styles.star, i <= rating && styles.starFilled]}>
            {i <= rating ? '⭐' : '☆'}
          </Text>
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }

    if (!spotId) {
      Alert.alert('Error', 'Invalid parking spot.');
      return;
    }

    setLoading(true);
    try {
      const reviewData = {
        spot_id: spotId,
        rating: rating,
        review_text: reviewText.trim(),
        booking_id: bookingId,
      };

      const result = await submitReview(reviewData);
      if (result.success) {
        Alert.alert(
          'Thank You!',
          'Your review has been submitted successfully.',
          [
            {
              text: 'OK',
              onPress: () => {
                onClose();
                if (onReviewSubmitted) {
                  onReviewSubmitted();
                }
              },
            },
          ],
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to submit review. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setRating(0);
      setReviewText('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.title}>Leave a Review</Text>
                {spotName && (
                  <Text style={styles.spotName} numberOfLines={1}>
                    {spotName}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                disabled={loading}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Rating Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rating *</Text>
              <View style={styles.starsContainer}>
                {renderStars()}
              </View>
              {rating > 0 && (
                <Text style={styles.ratingText}>
                  {rating === 1
                    ? 'Poor'
                    : rating === 2
                    ? 'Fair'
                    : rating === 3
                    ? 'Good'
                    : rating === 4
                    ? 'Very Good'
                    : 'Excellent'}
                </Text>
              )}
            </View>

            {/* Review Text Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Review (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Share your experience with this parking spot..."
                placeholderTextColor="#999"
                value={reviewText}
                onChangeText={setReviewText}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                editable={!loading}
                maxLength={500}
              />
              <Text style={styles.characterCount}>
                {reviewText.length}/500 characters
              </Text>
            </View>

            {/* Verified Booking Badge */}
            {bookingId && (
              <View style={styles.verifiedContainer}>
                <Text style={styles.verifiedText}>
                  ✓ This review is linked to your booking
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={loading}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.submitButton,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={loading || rating === 0}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Review</Text>
                )}
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
    marginBottom: 24,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 8,
  },
  starButton: {
    marginRight: 8,
  },
  star: {
    fontSize: 36,
  },
  starFilled: {
    // Already handled by emoji
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#333',
    minHeight: 120,
    maxHeight: 200,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  verifiedContainer: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  verifiedText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
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

export default ReviewFormModal;
