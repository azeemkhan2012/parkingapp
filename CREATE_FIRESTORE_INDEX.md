# How to Create Firestore Index for Notifications

## Quick Method (Recommended)

1. **Check your console/terminal** when the error appeared - there should be a clickable link that says something like:
   ```
   https://console.firebase.google.com/project/parking-app-1cb84/firestore/indexes?create_composite=...
   ```

2. **Click that link** - it will automatically open Firebase Console with the index pre-configured

3. **Click "Create Index"** and wait a few minutes for it to build

## Manual Method

If you don't have the link, follow these steps:

### Step 1: Open Firebase Console
1. Go to: https://console.firebase.google.com/project/parking-app-1cb84/firestore/indexes

### Step 2: Create Index
1. Click **"Create Index"** button (top of the page)
2. Fill in the following:

**Collection ID**: `notifications`

**Fields to index**:
- Field 1:
  - Field path: `user_id`
  - Order: **Ascending**
- Field 2:
  - Field path: `created_at`
  - Order: **Descending**

3. Click **"Create"**

### Step 3: Wait for Index to Build
- The index status will show "Building..."
- Usually takes 1-3 minutes
- Status will change to "Enabled" when ready

## Verify Index Created

After the index is created:
1. Refresh your app
2. Open the notification inbox (bell icon)
3. Notifications should now load correctly

## Troubleshooting

**If index still shows "Building" after 5 minutes:**
- Refresh the Firebase Console page
- Check if there are any errors in the index creation

**If you see multiple indexes:**
- That's fine, Firebase may create additional indexes automatically
- Only the one with `user_id` (Ascending) + `created_at` (Descending) is needed

## Alternative: Use Fallback Query

The code already has a fallback that works without the index (but may be slower). If you want to use it temporarily while the index builds, the error message should show the notifications, but with a warning about the index.

