# Troubleshooting Guide - Firebase Network Errors

## Firebase Network Request Failed Error

If you're getting the error "Firebase: Error (auth/network-request-failed)", follow these steps:

### 1. **Immediate Solutions**

#### Check Internet Connection
- Ensure your device has a stable internet connection
- Try switching between WiFi and mobile data
- Check if other apps can access the internet

#### Use Network Diagnostics
- Tap the "🔧 Network Diagnostics" button on the signup screen
- This will show you detailed network status information

### 2. **Common Causes & Solutions**

#### Network Connectivity Issues
```
Problem: Unstable internet connection
Solution: 
- Move closer to WiFi router
- Switch to mobile data temporarily
- Restart your router
```

#### Firebase Service Availability
```
Problem: Firebase services temporarily unavailable
Solution:
- Wait 5-10 minutes and try again
- Check Firebase Status page: https://status.firebase.google.com/
- Try during off-peak hours
```

#### Device Network Settings
```
Problem: Device network configuration issues
Solution:
- Toggle airplane mode on/off
- Restart your device
- Check if VPN is interfering
```

### 3. **Advanced Troubleshooting**

#### Check Firebase Configuration
1. Verify your Firebase project is active
2. Ensure Authentication and Firestore are enabled
3. Check if your API keys are correct

#### Network Configuration
1. **WiFi Issues:**
   - Forget and reconnect to WiFi network
   - Check if network has firewall restrictions
   - Try a different WiFi network

2. **Mobile Data Issues:**
   - Check mobile data is enabled
   - Verify carrier network coverage
   - Try switching between 4G/5G

### 4. **App-Specific Solutions**

#### Clear App Cache
- Close the app completely
- Clear app cache from device settings
- Restart the app

#### Reinstall App
- Uninstall the app
- Restart device
- Reinstall from source

### 5. **Developer Console Debugging**

Check the console logs for detailed error information:
```javascript
// Look for these log messages:
"Starting user registration..."
"Creating user account..."
"User account created successfully: [UID]"
"Saving user profile to Firestore..."
"User profile saved successfully"
```

### 6. **Firebase Project Settings**

Ensure these are enabled in your Firebase Console:
- ✅ Authentication (Email/Password)
- ✅ Firestore Database
- ✅ Proper security rules
- ✅ Project is not in disabled state

### 7. **Regional Access Issues**

Some regions may have restricted access to Firebase:
- Try using a different network
- Check if Firebase is accessible in your region
- Contact Firebase support if issues persist

### 8. **Emergency Solutions**

If nothing else works:
1. **Wait and Retry:** Sometimes it's a temporary Firebase issue
2. **Different Network:** Try a completely different internet connection
3. **Device Restart:** Full device restart often resolves network issues
4. **Contact Support:** If issues persist for more than 24 hours

### 9. **Prevention Tips**

- Always check network before attempting registration
- Use stable WiFi connections when possible
- Keep the app updated
- Monitor Firebase service status

### 10. **Success Indicators**

When registration works correctly, you should see:
- ✅ "Registration Successful!" message
- ✅ Your User ID displayed
- ✅ Automatic navigation to login screen
- ✅ User data saved in Firebase

---

## Still Having Issues?

If you continue to experience problems:
1. Check the console logs for specific error codes
2. Use the Network Diagnostics button
3. Try the troubleshooting steps above
4. Consider reaching out to Firebase support

Remember: Most network issues are temporary and resolve with time or network changes.


