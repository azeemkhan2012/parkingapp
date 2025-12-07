// const { onCall } = require("firebase-functions/v2/https");
// const { defineSecret } = require("firebase-functions/params");
// const stripeLib = require("stripe");
// const { initializeApp } = require("firebase-admin/app");

// initializeApp();

// const STRIPE_SECRET = defineSecret("STRIPE_SECRET");

// exports.createPaymentIntent = onCall(
//   { secrets: [STRIPE_SECRET] },
//   async (request) => {
//     try {
//       const { amount, currency } = request.data;

//       if (!amount || typeof amount !== "number") {
//         throw new Error("Amount is required and must be a number (in smallest currency unit)");
//       }

//       const stripe = stripeLib(STRIPE_SECRET.value());

//       const paymentIntent = await stripe.paymentIntents.create({
//         amount,
//         currency: currency || "usd", // fallback to usd
//         automatic_payment_methods: { enabled: true },
//       });

//       return { clientSecret: paymentIntent.client_secret };
//     } catch (err) {
//       console.error("createPaymentIntent error:", err);
//       return { error: err.message };
//     }
//   }
// );

const {onRequest} = require('firebase-functions/v2/https');
const {onCall} = require('firebase-functions/v2/https');
const {onDocumentUpdated} = require('firebase-functions/v2/firestore');
const {defineSecret} = require('firebase-functions/params');
const stripeLib = require('stripe');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// Secret from Firebase console → Build → Secrets
const STRIPE_SECRET = defineSecret('STRIPE_SECRET');

exports.createCheckoutSession = onRequest(
  {secrets: [STRIPE_SECRET]},
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({error: 'Method not allowed'});
      }

      const {amount, userId, spotId, name} = req.body;

      if (!amount || !spotId) {
        return res.status(400).json({error: 'Missing amount or spotId'});
      }

      const stripe = stripeLib(STRIPE_SECRET.value());

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'PKR', // Stripe doesn't support PKR
              product_data: {
                name: name,
                metadata: {spotId},
              },
              unit_amount: amount, // cents
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId: userId || 'guest',
          spotId,
        },
        success_url:
          'parkingapp://checkout/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'parkingapp://checkout/cancel',
      });

      return res.json({url: session.url});
    } catch (err) {
      console.error('createCheckoutSession error:', err);
      return res.status(500).json({error: err.message});
    }
  },
);

exports.verifyCheckoutSession = onRequest(
  {secrets: [STRIPE_SECRET]},
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({error: 'Method not allowed'});
      }

      const {sessionId} = req.body;
      if (!sessionId) {
        return res.status(400).json({error: 'sessionId required'});
      }

      const stripe = stripeLib(STRIPE_SECRET.value());

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'],
      });

      const paid = session.payment_status === 'paid';

      res.json({
        paid,
        spotId: session.metadata?.spotId || null,
        userId: session.metadata?.userId || null,
      });
    } catch (err) {
      console.error('verifyCheckoutSession error:', err);
      res.status(500).json({error: err.message});
    }
  },
);

// -------------------- Notification Functions --------------------

/**
 * Helper function to extract price from spot data
 * Handles various price field formats
 */
function getPriceFromSpot(spotData) {
  if (!spotData) return null;
  
  // Try pricing_hourly first
  if (spotData.pricing_hourly !== undefined) {
    return typeof spotData.pricing_hourly === 'number' 
      ? spotData.pricing_hourly 
      : parseFloat(spotData.pricing_hourly) || 0;
  }
  
  // Try pricing_daily
  if (spotData.pricing_daily !== undefined) {
    return typeof spotData.pricing_daily === 'number'
      ? spotData.pricing_daily
      : parseFloat(spotData.pricing_daily) || 0;
  }
  
  // Try price field
  if (spotData.price !== undefined) {
    if (typeof spotData.price === 'number') return spotData.price;
    if (typeof spotData.price === 'string') {
      const match = spotData.price.match(/\d+(\.\d+)?/);
      return match ? parseFloat(match[0]) : 0;
    }
  }
  
  // Try original_data.pricing.hourly (nested in original_data)
  if (spotData.original_data?.pricing?.hourly) {
    return typeof spotData.original_data.pricing.hourly === 'number'
      ? spotData.original_data.pricing.hourly
      : parseFloat(spotData.original_data.pricing.hourly) || 0;
  }
  
  if (spotData.original_data?.pricing?.daily) {
    return typeof spotData.original_data.pricing.daily === 'number'
      ? spotData.original_data.pricing.daily
      : parseFloat(spotData.original_data.pricing.daily) || 0;
  }
  
  // Try pricing.hourly (direct nested, for backward compatibility)
  if (spotData.pricing?.hourly) {
    return typeof spotData.pricing.hourly === 'number'
      ? spotData.pricing.hourly
      : parseFloat(spotData.pricing.hourly) || 0;
  }
  
  if (spotData.pricing?.daily) {
    return typeof spotData.pricing.daily === 'number'
      ? spotData.pricing.daily
      : parseFloat(spotData.pricing.daily) || 0;
  }
  
  return null;
}

/**
 * Helper function to extract availability from spot data
 */
function getAvailabilityFromSpot(spotData) {
  if (!spotData) return null;
  
  // Try availability_available and availability_total
  if (spotData.availability_available !== undefined && 
      spotData.availability_total !== undefined) {
    return {
      available: typeof spotData.availability_available === 'number'
        ? spotData.availability_available
        : parseInt(spotData.availability_available) || 0,
      total: typeof spotData.availability_total === 'number'
        ? spotData.availability_total
        : parseInt(spotData.availability_total) || 0,
    };
  }
  
  // Try nested availability object
  if (spotData.availability?.available !== undefined &&
      spotData.availability?.total !== undefined) {
    return {
      available: typeof spotData.availability.available === 'number'
        ? spotData.availability.available
        : parseInt(spotData.availability.available) || 0,
      total: typeof spotData.availability.total === 'number'
        ? spotData.availability.total
        : parseInt(spotData.availability.total) || 0,
    };
  }
  
  return null;
}

/**
 * Helper function to send notifications to users
 * Sends push notifications and stores notification records in Firestore
 */
async function sendNotificationsForChanges(changeData) {
  const {spotId, spotName, priceChanged, priceChange, availabilityChanged, availabilityChange, affectedUsers} = changeData;
  
  // Build notification message
  let notificationTitle = 'Parking Spot Updated';
  let notificationBody = '';
  
  if (priceChanged && availabilityChanged) {
    notificationBody = `${spotName}: Price changed to ${priceChange.new}, Availability: ${availabilityChange.newAvailable}/${availabilityChange.newTotal}`;
  } else if (priceChanged) {
    notificationBody = `${spotName}: Price changed from ${priceChange.old} to ${priceChange.new}`;
  } else if (availabilityChanged) {
    notificationBody = `${spotName}: Availability changed to ${availabilityChange.newAvailable}/${availabilityChange.newTotal}`;
  } else {
    notificationBody = `${spotName} has been updated`;
  }
  
  // Send notification to each affected user
  const notificationPromises = affectedUsers.map(async (user) => {
    try {
      const {userId, savedSpotId} = user;
      
      // Get user's FCM token
      const tokenDoc = await db.collection('user_tokens').doc(userId).get();
      if (!tokenDoc.exists) {
        console.log(`[sendNotificationsForChanges] No FCM token found for user ${userId}`);
        return;
      }
      
      const tokenData = tokenDoc.data();
      const fcmToken = tokenData.fcm_token;
      
      if (!fcmToken) {
        console.log(`[sendNotificationsForChanges] FCM token is empty for user ${userId}`);
        return;
      }
      
      // Prepare notification payload with navigation data
      const message = {
        token: fcmToken,
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        data: {
          type: 'parking_spot_change',
          spotId: spotId,
          savedSpotId: savedSpotId,
          priceChanged: priceChanged ? 'true' : 'false',
          availabilityChanged: availabilityChanged ? 'true' : 'false',
          // Additional data for the notification
          spotName: spotName,
          timestamp: new Date().toISOString(),
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'parking_updates',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };
      
      // Send the notification
      const response = await messaging.send(message);
      console.log(`[sendNotificationsForChanges] Notification sent to user ${userId}:`, response);
      
      // Store notification in Firestore for inbox
      await db.collection('notifications').add({
        user_id: userId,
        saved_spot_id: savedSpotId,
        spot_id: spotId,
        spot_name: spotName,
        type: 'parking_spot_change',
        title: notificationTitle,
        body: notificationBody,
        price_changed: priceChanged,
        price_change: priceChange,
        availability_changed: availabilityChanged,
        availability_change: availabilityChange,
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });
      
      console.log(`[sendNotificationsForChanges] Notification stored in Firestore for user ${userId}`);
      
    } catch (error) {
      console.error(`[sendNotificationsForChanges] Error sending notification to user ${user.userId}:`, error);
      // Don't throw - continue with other users even if one fails
    }
  });
  
  // Wait for all notifications to be sent
  await Promise.allSettled(notificationPromises);
}

/**
 * Cloud Function: Monitor parking spot changes
 * Triggers when a parking spot document is updated
 */
exports.monitorParkingSpotChanges = onDocumentUpdated(
  'parking_spots/{spotId}',
  async (event) => {
    try {
      const spotId = event.params.spotId;
      const beforeData = event.data.before.data();
      const afterData = event.data.after.data();
      
      console.log(`[monitorParkingSpotChanges] Spot ${spotId} updated`);
      
      // Extract price and availability from old and new data
      const oldPrice = getPriceFromSpot(beforeData);
      const newPrice = getPriceFromSpot(afterData);
      const oldAvailability = getAvailabilityFromSpot(beforeData);
      const newAvailability = getAvailabilityFromSpot(afterData);
      
      // Check for price change
      const priceChanged = oldPrice !== null && 
                          newPrice !== null && 
                          oldPrice !== newPrice;
      
      // Check for availability change
      const availabilityChanged = oldAvailability !== null &&
                                  newAvailability !== null &&
                                  (oldAvailability.available !== newAvailability.available ||
                                   oldAvailability.total !== newAvailability.total);
      
      // If no relevant changes, exit early
      if (!priceChanged && !availabilityChanged) {
        console.log(`[monitorParkingSpotChanges] No price or availability changes detected for spot ${spotId}`);
        return;
      }
      
      console.log(`[monitorParkingSpotChanges] Changes detected for spot ${spotId}:`, {
        priceChanged,
        priceChange: priceChanged ? {old: oldPrice, new: newPrice} : null,
        availabilityChanged,
        availabilityChange: availabilityChanged 
          ? {old: oldAvailability, new: newAvailability}
          : null,
      });
      
      // Find all users who saved this spot (by spot_id)
      const savedSpotsSnapshot = await db
        .collection('saved_spots')
        .where('spot_id', '==', spotId)
        .get();
      
      if (savedSpotsSnapshot.empty) {
        console.log(`[monitorParkingSpotChanges] No users have saved spot ${spotId}`);
        return;
      }
      
      const affectedUsers = [];
      savedSpotsSnapshot.forEach((doc) => {
        const savedSpotData = doc.data();
        const userId = savedSpotData.user_id;
        
        // Only notify if user has notifications enabled (default to true if not set)
        const notificationsEnabled = savedSpotData.notifications_enabled !== false;
        
        if (notificationsEnabled && userId) {
          affectedUsers.push({
            userId,
            savedSpotId: doc.id,
            savedSpotData,
          });
        }
      });
      
      if (affectedUsers.length === 0) {
        console.log(`[monitorParkingSpotChanges] No users with notifications enabled for spot ${spotId}`);
        return;
      }
      
      console.log(`[monitorParkingSpotChanges] Found ${affectedUsers.length} users to notify for spot ${spotId}`);
      
      // Prepare change data for notification
      const spotName = afterData.name || afterData.location?.name || afterData.title || 'Parking Spot';
      const changeData = {
        spotId,
        spotName,
        priceChanged,
        priceChange: priceChanged ? {old: oldPrice, new: newPrice} : null,
        availabilityChanged,
        availabilityChange: availabilityChanged 
          ? {
              oldAvailable: oldAvailability.available,
              newAvailable: newAvailability.available,
              oldTotal: oldAvailability.total,
              newTotal: newAvailability.total,
            }
          : null,
        affectedUsers,
      };
      
      // Send notifications to all affected users
      await sendNotificationsForChanges(changeData);
      
      console.log('[monitorParkingSpotChanges] Notifications sent successfully');
      
      return changeData;
      
    } catch (error) {
      console.error('[monitorParkingSpotChanges] Error:', error);
      throw error;
    }
  },
);

// -------------------- Pricing Update Functions --------------------

/**
 * Helper function to extract hourly price from spot data
 * Same logic as Cloud Function monitorParkingSpotChanges
 */
function getHourlyPriceFromSpot(spotData) {
  if (!spotData) return null;
  
  // Try pricing_hourly first (flat field)
  if (spotData.pricing_hourly !== undefined) {
    return typeof spotData.pricing_hourly === 'number' 
      ? spotData.pricing_hourly 
      : parseFloat(spotData.pricing_hourly) || null;
  }
  
  // Try original_data.pricing.hourly (nested in original_data)
  if (spotData.original_data?.pricing?.hourly !== undefined) {
    return typeof spotData.original_data.pricing.hourly === 'number'
      ? spotData.original_data.pricing.hourly
      : parseFloat(spotData.original_data.pricing.hourly) || null;
  }
  
  // Try pricing.hourly (direct nested, for backward compatibility)
  if (spotData.pricing?.hourly !== undefined) {
    return typeof spotData.pricing.hourly === 'number'
      ? spotData.pricing.hourly
      : parseFloat(spotData.pricing.hourly) || null;
  }
  
  // Try price field (may be string like "$5/hour")
  if (spotData.price !== undefined) {
    if (typeof spotData.price === 'number') return spotData.price;
    if (typeof spotData.price === 'string') {
      const match = spotData.price.match(/\d+(\.\d+)?/);
      return match ? parseFloat(match[0]) : null;
    }
  }
  
  return null;
}

/**
 * Generate new random price between min and max
 */
function generateRandomPrice(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get new price based on current price (tiered approach)
 */
function getNewPrice(currentPrice) {
  const MIN_PRICE = 150;
  const MAX_PRICE = 300;
  
  if (currentPrice >= MIN_PRICE) {
    return currentPrice; // Keep as is
  }
  
  // Tiered pricing based on current price
  if (currentPrice >= 100) {
    // 100-149 → 200-250
    return generateRandomPrice(200, 250);
  } else if (currentPrice >= 50) {
    // 50-99 → 180-220
    return generateRandomPrice(180, 220);
  } else if (currentPrice >= 40) {
    // 40-49 → 170-200
    return generateRandomPrice(170, 200);
  } else if (currentPrice >= 30) {
    // 30-39 → 160-190
    return generateRandomPrice(160, 190);
  } else {
    // 0-29 → 150-180
    return generateRandomPrice(150, 180);
  }
}

/**
 * Cloud Function: Analyze current pricing in Firestore
 * Returns statistics about pricing
 */
exports.analyzePricing = onCall(async (request) => {
  try {
    console.log('[analyzePricing] Starting analysis...');
    
    // Get all parking spots
    const spotsSnapshot = await db.collection('parking_spots').get();
    
    const analysis = {
      totalSpots: spotsSnapshot.size,
      spotsBelow150: 0,
      spotsAbove150: 0,
      spotsWithoutPrice: 0,
      priceRanges: {
        '0-29': 0,
        '30-49': 0,
        '50-99': 0,
        '100-149': 0,
        '150-199': 0,
        '200-249': 0,
        '250+': 0,
      },
      pricingFormats: {
        pricing_hourly: 0,
        pricing_hourly_object: 0,
        price_field: 0,
        unknown: 0,
      },
      spotsToUpdate: [],
    };
    
    spotsSnapshot.forEach((doc) => {
      const spotData = doc.data();
      const hourlyPrice = getHourlyPriceFromSpot(spotData);
      
      // Identify pricing format
      if (spotData.pricing_hourly !== undefined) {
        analysis.pricingFormats.pricing_hourly++;
      } else if (spotData.pricing?.hourly !== undefined) {
        analysis.pricingFormats.pricing_hourly_object++;
      } else if (spotData.price !== undefined) {
        analysis.pricingFormats.price_field++;
      } else {
        analysis.pricingFormats.unknown++;
      }
      
      if (hourlyPrice === null) {
        analysis.spotsWithoutPrice++;
        return;
      }
      
      // Categorize by price range
      if (hourlyPrice < 30) {
        analysis.priceRanges['0-29']++;
      } else if (hourlyPrice < 50) {
        analysis.priceRanges['30-49']++;
      } else if (hourlyPrice < 100) {
        analysis.priceRanges['50-99']++;
      } else if (hourlyPrice < 150) {
        analysis.priceRanges['100-149']++;
      } else if (hourlyPrice < 200) {
        analysis.priceRanges['150-199']++;
      } else if (hourlyPrice < 250) {
        analysis.priceRanges['200-249']++;
      } else {
        analysis.priceRanges['250+']++;
      }
      
      // Check if needs update
      if (hourlyPrice < 150) {
        analysis.spotsBelow150++;
        const newPrice = getNewPrice(hourlyPrice);
        analysis.spotsToUpdate.push({
          spotId: doc.id,
          name: spotData.name || 'Unknown',
          currentPrice: hourlyPrice,
          newPrice: newPrice,
        });
      } else {
        analysis.spotsAbove150++;
      }
    });
    
    console.log('[analyzePricing] Analysis complete:', analysis);
    
    return {
      success: true,
      analysis: analysis,
    };
  } catch (error) {
    console.error('[analyzePricing] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Cloud Function: Update pricing for parking spots (HTTP version for easier testing)
 * Can run in dry-run mode (preview only) or actual update mode
 */
exports.updatePricingHTTP = onRequest(
  {
    timeoutSeconds: 540, // 9 minutes max for large datasets
    memory: '512MiB', // More memory for faster processing
  },
  async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({error: 'Method not allowed. Use POST.'});
    }
    
    const {dryRun = true, minPrice = 150} = req.body || {};
    
    console.log(`[updatePricing] Starting update (dryRun: ${dryRun}, minPrice: ${minPrice})...`);
    
    // Get all parking spots
    const spotsSnapshot = await db.collection('parking_spots').get();
    
    const results = {
      totalSpots: spotsSnapshot.size,
      updated: 0,
      skipped: 0,
      errors: 0,
      updates: [],
      errors_list: [],
    };
    
    // Process in smaller batches to commit more frequently
    const BATCH_SIZE = 250; // Smaller batches for more frequent commits
    let batchCount = 0;
    let batch = db.batch();
    let totalProcessed = 0;
    
    for (const doc of spotsSnapshot.docs) {
      try {
        const spotData = doc.data();
        const hourlyPrice = getHourlyPriceFromSpot(spotData);
        
        // Check both formats to see if either needs updating
        let needsUpdate = false;
        let targetPrice = null;
        
        if (hourlyPrice === null) {
          results.skipped++;
          totalProcessed++;
          continue;
        }
        
        // If price is < minPrice, we need to update
        if (hourlyPrice < minPrice) {
          needsUpdate = true;
          targetPrice = getNewPrice(hourlyPrice);
        } else {
          // Check if both formats exist and are out of sync
          const hasFlatFields = spotData.pricing_hourly !== undefined;
          const hasNestedFields = spotData.original_data?.pricing?.hourly !== undefined;
          
          if (hasFlatFields && hasNestedFields) {
            // Both formats exist - check if they match
            const flatPrice = typeof spotData.pricing_hourly === 'number' 
              ? spotData.pricing_hourly 
              : parseFloat(spotData.pricing_hourly) || null;
            const nestedPrice = typeof spotData.original_data.pricing.hourly === 'number'
              ? spotData.original_data.pricing.hourly
              : parseFloat(spotData.original_data.pricing.hourly) || null;
            
            // If they don't match, sync them (use the higher value or flat field as source of truth)
            if (flatPrice !== null && nestedPrice !== null && flatPrice !== nestedPrice) {
              needsUpdate = true;
              // Use flat field as source of truth (since app prefers it)
              targetPrice = flatPrice >= minPrice ? flatPrice : getNewPrice(flatPrice);
              console.log(`[updatePricing] Syncing mismatched prices for ${doc.id}: flat=${flatPrice}, nested=${nestedPrice}, will set to ${targetPrice}`);
            }
          }
        }
        
        // Skip if no update needed
        if (!needsUpdate) {
          results.skipped++;
          totalProcessed++;
          continue;
        }
        
        // Use targetPrice if set (for syncing), otherwise calculate new price
        const newPrice = targetPrice || getNewPrice(hourlyPrice);
        
        // Update BOTH formats if they exist to keep them in sync
        let updateData = {};
        let hasFlatFields = spotData.pricing_hourly !== undefined;
        let hasNestedFields = spotData.original_data?.pricing?.hourly !== undefined;
        
        // Calculate new daily price proportionally
        // Use the higher value (flat field if exists, or nested) as source for ratio
        let newDailyPrice = null;
        let sourceDailyPrice = spotData.pricing_daily || spotData.original_data?.pricing?.daily;
        let sourceHourlyPrice = spotData.pricing_hourly || spotData.original_data?.pricing?.hourly || hourlyPrice;
        
        if (sourceDailyPrice && sourceHourlyPrice && sourceHourlyPrice > 0) {
          const ratio = sourceDailyPrice / sourceHourlyPrice;
          newDailyPrice = Math.round(newPrice * ratio);
        } else if (newPrice) {
          // Default: 6x hourly for daily if no existing daily price
          newDailyPrice = newPrice * 6;
        }
        
        // Update flat fields (pricing_hourly, pricing_daily)
        if (hasFlatFields) {
          updateData.pricing_hourly = newPrice;
          if (newDailyPrice !== null && spotData.pricing_daily !== undefined) {
            updateData.pricing_daily = newDailyPrice;
          }
        }
        
        // Update nested fields in original_data.pricing (original_data.pricing.hourly, original_data.pricing.daily)
        if (hasNestedFields) {
          // Update original_data.pricing object
          const originalData = spotData.original_data || {};
          const nestedPricing = {
            ...originalData.pricing,
            hourly: newPrice,
          };
          if (newDailyPrice !== null && originalData.pricing?.daily !== undefined) {
            nestedPricing.daily = newDailyPrice;
          }
          // Preserve other nested fields
          if (originalData.pricing?.currency) nestedPricing.currency = originalData.pricing.currency;
          if (originalData.pricing?.freeFor !== undefined) nestedPricing.freeFor = originalData.pricing.freeFor;
          
          // Update the entire original_data object, preserving all other fields
          updateData.original_data = {
            ...originalData,
            pricing: nestedPricing,
          };
        }
        
        // If only price field exists, update it
        if (!hasFlatFields && !hasNestedFields && spotData.price !== undefined) {
          updateData.price = `${newPrice} PKR/hour`;
        }
        
        // If no pricing fields found, create flat fields (standard format)
        if (!hasFlatFields && !hasNestedFields && spotData.price === undefined) {
          updateData.pricing_hourly = newPrice;
          if (newDailyPrice !== null) {
            updateData.pricing_daily = newDailyPrice;
          } else {
            updateData.pricing_daily = newPrice * 6; // Default 6x hourly for daily
          }
        }
        
        // Determine format for logging
        let formatType = 'unknown';
        if (hasFlatFields && hasNestedFields) {
          formatType = 'both (pricing_hourly + original_data.pricing.hourly)';
        } else if (hasFlatFields) {
          formatType = 'pricing_hourly';
        } else if (hasNestedFields) {
          formatType = 'original_data.pricing.hourly';
        } else if (spotData.price !== undefined) {
          formatType = 'price';
        }
        
        const updateInfo = {
          spotId: doc.id,
          name: spotData.name || 'Unknown',
          currentPrice: hourlyPrice,
          newPrice: newPrice,
          format: formatType,
        };
        
        // Only keep first 100 updates in results to avoid large responses
        if (results.updates.length < 100) {
          results.updates.push(updateInfo);
        }
        
        if (!dryRun) {
          // Add to batch
          const spotRef = db.collection('parking_spots').doc(doc.id);
          batch.update(spotRef, updateData);
          batchCount++;
          results.updated++;
          
          // Commit batch if full and create new batch
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`[updatePricing] Committed batch of ${batchCount} updates. Total updated so far: ${results.updated}`);
            batch = db.batch(); // Create new batch for next set
            batchCount = 0;
          }
        } else {
          results.updated++;
        }
        
        totalProcessed++;
        
        // Log progress every 100 spots
        if (totalProcessed % 100 === 0) {
          console.log(`[updatePricing] Processed ${totalProcessed}/${spotsSnapshot.size} spots`);
        }
      } catch (error) {
        console.error(`[updatePricing] Error updating spot ${doc.id}:`, error);
        results.errors++;
        if (results.errors_list.length < 50) {
          results.errors_list.push({
            spotId: doc.id,
            error: error.message,
          });
        }
        totalProcessed++;
      }
    }
    
    // Commit remaining updates
    if (!dryRun && batchCount > 0) {
      await batch.commit();
      console.log(`[updatePricing] Committed final batch of ${batchCount} updates`);
    }
    
    const mode = dryRun ? 'DRY RUN' : 'ACTUAL UPDATE';
    console.log(`[updatePricing] ${mode} complete:`, results);
    
    // Limit response size for large datasets
    const responseResults = {
      ...results,
      updates: results.updates.slice(0, 50),
      errors_list: results.errors_list.slice(0, 20),
      note: results.updates.length > 50 ? 
        `${results.updates.length - 50} more updates not shown in response` : undefined,
    };
    
    res.json({
      success: true,
      dryRun: dryRun,
      results: responseResults,
      message: dryRun 
        ? `Dry run complete. Would update ${results.updated} spots.`
        : `Update complete. Updated ${results.updated} spots.`,
    });
  } catch (error) {
    console.error('[updatePricing] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Cloud Function: Verify pricing updates
 * Checks that all spots have minimum price
 */
exports.verifyPricing = onCall(async (request) => {
  try {
    const {minPrice = 150} = request.data || {};
    
    console.log(`[verifyPricing] Starting verification (minPrice: ${minPrice})...`);
    
    const spotsSnapshot = await db.collection('parking_spots').get();
    
    const verification = {
      totalSpots: spotsSnapshot.size,
      compliant: 0,
      nonCompliant: 0,
      noPrice: 0,
      nonCompliantSpots: [],
    };
    
    spotsSnapshot.forEach((doc) => {
      const spotData = doc.data();
      const hourlyPrice = getHourlyPriceFromSpot(spotData);
      
      if (hourlyPrice === null) {
        verification.noPrice++;
        return;
      }
      
      if (hourlyPrice >= minPrice) {
        verification.compliant++;
      } else {
        verification.nonCompliant++;
        verification.nonCompliantSpots.push({
          spotId: doc.id,
          name: spotData.name || 'Unknown',
          currentPrice: hourlyPrice,
        });
      }
    });
    
    console.log('[verifyPricing] Verification complete:', verification);
    
    return {
      success: true,
      verification: verification,
      allCompliant: verification.nonCompliant === 0,
      message: verification.nonCompliant === 0
        ? `All ${verification.compliant} spots comply with minimum price of ${minPrice} PKR.`
        : `${verification.nonCompliant} spots still below minimum price of ${minPrice} PKR.`,
    };
  } catch (error) {
    console.error('[verifyPricing] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});
