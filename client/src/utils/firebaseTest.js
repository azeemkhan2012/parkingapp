import firestore from '@react-native-firebase/firestore';

export const testFirebaseConnection = async () => {
  try {
    console.log('🔍 Testing Firebase connection...');
    
    // Test 1: Basic connection
    const testDoc = await firestore()
      .collection('test')
      .doc('connection-test')
      .get();
    
    console.log('✅ Firebase connection successful!');
    
    // Test 2: Write data
    await firestore()
      .collection('test')
      .doc('connection-test')
      .set({
        timestamp: firestore.FieldValue.serverTimestamp(),
        message: 'Firebase is working!',
        test: true,
        createdAt: new Date().toISOString()
      });
    
    console.log('✅ Firebase write test successful!');
    
    // Test 3: Read data
    const snapshot = await firestore()
      .collection('test')
      .limit(5)
      .get();
    
    const documents = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('✅ Firebase read test successful!');
    console.log('📄 Documents found:', documents.length);
    
    return {
      success: true,
      message: 'Firebase connection, write, and read tests all successful!',
      documentsCount: documents.length
    };
    
  } catch (error) {
    console.error('❌ Firebase test failed:', error);
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
};

export const testFirestoreRules = async () => {
  try {
    // Test if we can read from parking_spots collection
    const spotsSnapshot = await firestore()
      .collection('parking_spots')
      .limit(1)
      .get();
    
    console.log('✅ Firestore rules test - can read parking_spots');
    
    return {
      success: true,
      message: 'Firestore rules allow reading parking_spots collection'
    };
    
  } catch (error) {
    console.error('❌ Firestore rules test failed:', error);
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
}; 