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
import {getBillingHistory, getCurrentUser} from '../config/firebase';

const BillingHistoryScreen = ({navigation}) => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBillingHistory();
  }, []);

  const loadBillingHistory = async () => {
    setLoading(true);
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'Please login to view billing history');
        navigation.navigate('login');
        return;
      }

      const result = await getBillingHistory(currentUser.uid);
      if (result.success) {
        setBills(result.bills || []);
      } else {
        Alert.alert('Error', result.error || 'Failed to load billing history');
      }
    } catch (error) {
      console.error('Error loading billing history:', error);
      Alert.alert('Error', 'Failed to load billing history');
    } finally {
      setLoading(false);
    }
  };
  console.log(bills, 'bills');

  const formatDate = date => {
    if (!date) return 'N/A';
    if (typeof date === 'string') return date;
    if (date.toDate) date = date.toDate();
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

  const getPaymentStatusColor = status => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'failed':
        return '#F44336';
      default:
        return '#999';
    }
  };

  const getStatusColor = status => {
    switch (status?.toLowerCase()) {
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

  const calculateTotal = () => {
    return bills
      .filter(bill => bill.payment_status === 'paid')
      .reduce((sum, bill) => sum + (bill.amount || 0), 0);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Billing History</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading billing history...</Text>
        </View>
      </View>
    );
  }

  const totalSpent = calculateTotal();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Billing History</Text>
        <TouchableOpacity
          onPress={loadBillingHistory}
          style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}>
        {bills.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No billing history</Text>
            <Text style={styles.emptySubtext}>
              Your payment transactions will appear here
            </Text>
          </View>
        ) : (
          bills.map(bill => (
            <View key={bill.id} style={styles.billCard}>
              <View style={styles.billHeader}>
                <View style={styles.billHeaderLeft}>
                  <Text style={styles.spotName}>{bill.spot_name}</Text>
                  <View style={styles.badgesContainer}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: getPaymentStatusColor(
                            bill.payment_status,
                          ),
                        },
                      ]}>
                      <Text style={styles.statusText}>
                        {bill.payment_status?.toUpperCase() || 'UNKNOWN'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        styles.bookingStatusBadge,
                        {backgroundColor: getStatusColor(bill.status)},
                      ]}>
                      <Text style={styles.statusText}>
                        {bill.status?.toUpperCase() || 'UNKNOWN'}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.billAmount}>
                  {'PKR'} {bill.amount || 0}
                </Text>
              </View>

              <View style={styles.billDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Address:</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>
                    {bill.spot_address || 'N/A'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(bill.booked_at)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment Method:</Text>
                  <Text style={styles.detailValue}>
                    {bill.payment_method?.toUpperCase() || 'N/A'}
                  </Text>
                </View>

                {bill.session_id && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Session ID:</Text>
                    <Text style={[styles.detailValue, styles.transactionId]}>
                      {bill.session_id.substring(0, 20)}...
                    </Text>
                  </View>
                )}

                {bill.payment_intent_id && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Payment Intent:</Text>
                    <Text style={[styles.detailValue, styles.transactionId]}>
                      {bill.payment_intent_id.substring(0, 20)}...
                    </Text>
                  </View>
                )}

                {bill.paid_at && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Paid At:</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(bill.paid_at)}
                    </Text>
                  </View>
                )}

                {bill.booking_start && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Booking Period:</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(bill.booking_start)}
                      {bill.booking_end
                        ? ` - ${formatDate(bill.booking_end)}`
                        : ''}
                    </Text>
                  </View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#007AFF',
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
  summaryCard: {
    backgroundColor: '#007AFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  summarySubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 0,
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
  billCard: {
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
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  billHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  spotName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  bookingStatusBadge: {
    marginLeft: 0,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  billAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  billDetails: {
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
    width: 120,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  transactionId: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
});

export default BillingHistoryScreen;
