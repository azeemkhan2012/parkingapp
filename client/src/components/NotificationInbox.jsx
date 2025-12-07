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
import {getNotifications, markNotificationAsRead, getUnreadCount, getCurrentUser} from '../config/firebase';

/**
 * Notification Inbox Modal Component
 * Displays the last 10 notifications for the current user
 */
const NotificationInbox = ({visible, onClose, onNotificationTap, onReadChange}) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible]);

  const loadNotifications = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      Alert.alert('Error', 'Please login to view notifications');
      onClose();
      return;
    }

    setLoading(true);
    try {
      console.log('Loading notifications for user:', currentUser.uid);
      const notifs = await getNotifications(currentUser.uid);
      console.log('Notifications loaded:', notifs.length, notifs);
      setNotifications(notifs);
      
      if (notifs.length === 0) {
        console.log('No notifications found. Checking Firestore...');
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      console.error('Error details:', error.message, error.code);
      
      // Show more detailed error
      const errorMsg = error.message || 'Unknown error';
      const hint = error.code === 'failed-precondition' 
        ? '\n\nNote: You may need to create a Firestore index. Check the console for the index creation link.'
        : '';
      Alert.alert('Error', 'Failed to load notifications: ' + errorMsg + hint);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationPress = async (notification) => {
    try {
      // Mark as read if not already read
      if (!notification.read && notification.id) {
        await markNotificationAsRead(notification.id);
        // Update local state
        setNotifications(prev =>
          prev.map(n => (n.id === notification.id ? {...n, read: true} : n)),
        );
        // Notify parent to refresh unread count
        if (onReadChange) {
          onReadChange();
        }
      }
      
      // Call onNotificationTap callback
      if (onNotificationTap) {
        onNotificationTap(notification);
      }
      
      // Close modal after a short delay to allow state updates
      setTimeout(() => {
        if (onClose) {
          onClose();
        }
      }, 200);
    } catch (error) {
      console.error('Error handling notification tap:', error);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now';
    
    // Handle Firestore Timestamp
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return 'Just now';
    }

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    // Format full date for older notifications
    return date.toLocaleDateString();
  };

  const renderNotificationItem = ({item}) => {
    const isUnread = !item.read;
    const changeInfo = [];
    
    if (item.price_changed && item.price_change) {
      changeInfo.push(`Price: ${item.price_change.old} → ${item.price_change.new}`);
    }
    
    if (item.availability_changed && item.availability_change) {
      changeInfo.push(
        `Availability: ${item.availability_change.oldAvailable}/${item.availability_change.oldTotal} → ${item.availability_change.newAvailable}/${item.availability_change.newTotal}`,
      );
    }

    return (
      <TouchableOpacity
        style={[styles.notificationItem, isUnread && styles.unreadNotification]}
        onPress={() => handleNotificationPress(item)}>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={[styles.notificationTitle, isUnread && styles.unreadTitle]}>
              {item.title || 'Parking Spot Updated'}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notificationBody} numberOfLines={2}>
            {item.body || item.spot_name || 'Parking spot updated'}
          </Text>
          {changeInfo.length > 0 && (
            <View style={styles.changeInfo}>
              {changeInfo.map((info, index) => (
                <Text key={index} style={styles.changeText}>
                  • {info}
                </Text>
              ))}
            </View>
          )}
          <Text style={styles.timestamp}>{formatTimestamp(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

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
            <Text style={styles.title}>Notifications</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Loading State */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading notifications...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No notifications</Text>
              <Text style={styles.emptySubtext}>
                You'll see notifications about your saved parking spots here
              </Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              renderItem={renderNotificationItem}
              keyExtractor={item => item.id || String(Math.random())}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
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
  notificationItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  unreadNotification: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
    borderWidth: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  unreadTitle: {
    fontWeight: '700',
    color: '#1976D2',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196F3',
    marginLeft: 8,
  },
  notificationBody: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  changeInfo: {
    marginTop: 4,
    marginBottom: 8,
  },
  changeText: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
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
    textAlign: 'center',
  },
});

export default NotificationInbox;

