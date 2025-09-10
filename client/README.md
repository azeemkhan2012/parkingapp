# Parking App - Prototype Phase

## Overview
A React Native parking application with comprehensive user registration, login, and profile management functionality.

## Features Implemented

### 1. User Registration System
- **Complete Registration Form** with all required fields:
  - First Name
  - Last Name
  - Username (unique, alphanumeric + underscore only)
  - Email Address
  - Full Address
  - Mobile Number
  - Password
  - Confirm Password
- **System-generated User ID** (Firebase UID)
- **Real-time validation** for all fields
- **Username availability checking**
- **Data persistence** to Firebase Firestore

### 2. User Login System
- **Username-based authentication** (instead of email)
- **Secure password verification**
- **Session management** with React Native AsyncStorage
- **Navigation to home page** after successful login

### 3. Profile Management
- **Edit Profile functionality** accessible after login
- **Update all registration information**:
  - Personal details
  - Contact information
  - Address
  - Mobile number
- **Real-time validation** during editing
- **Profile data persistence** to database

### 4. Technical Implementation
- **Firebase Authentication** for user management
- **Firestore Database** for user profile storage
- **React Navigation** for screen management
- **Form validation** with error handling
- **Loading states** and user feedback
- **Responsive design** for mobile devices

## Database Schema

### Users Collection
```javascript
{
  userId: "firebase_uid",
  firstName: "string",
  lastName: "string", 
  username: "string (unique)",
  email: "string",
  address: "string",
  mobileNo: "string",
  createdAt: "timestamp",
  updatedAt: "timestamp"
}
```

## Navigation Flow
1. **Login Screen** → Enter username and password
2. **Signup Screen** → Complete registration form
3. **Home Screen** → Access to parking features + Edit Profile button
4. **Profile Edit Screen** → Modify user information

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure Firebase:
   - Update `src/config/firebase.js` with your Firebase credentials
   - Enable Authentication and Firestore in Firebase Console

3. Run the application:
   ```bash
   # For Android
   npm run android
   
   # For iOS
   npm run ios
   ```

## Prototype Requirements Met

✅ **Create a registration page with all the important fields**  
✅ **Users can register using user details like user id (system-generated), name, username, email, address, mobile No. etc.**  
✅ **All the data on the registration page should be saved in the database**  
✅ **Create a login page**  
✅ **Users can login using usernames and passwords**  
✅ **After login in the application, the user can edit registration information**

## Additional Features
- **Parking spot management** with Mapbox integration
- **Location services** and geocoding
- **SFpark data integration** for public parking information
- **Real-time filtering** and search capabilities
- **Responsive UI** with modern design patterns
