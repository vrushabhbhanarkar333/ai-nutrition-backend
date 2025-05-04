const { sendRandomEngagementQuestion } = require('../scripts/random-engagement-notifications');

/**
 * Schedule random notifications throughout the day
 * This service uses random intervals to send AI questions to users
 */
class RandomNotificationService {
  constructor() {
    this.isRunning = false;
    this.timerId = null;
    this.minIntervalHours = 3;  // Minimum 3 hours between notifications
    this.maxIntervalHours = 8;  // Maximum 8 hours between notifications
    this.activeHoursStart = 8;  // Start sending at 8 AM
    this.activeHoursEnd = 22;   // Stop sending at 10 PM
  }

  /**
   * Start the random notification service
   */
  start() {
    if (this.isRunning) {
      console.log('Random notification service is already running');
      return;
    }

    console.log('Starting random notification service');
    this.isRunning = true;
    this.scheduleNextNotification();
  }

  /**
   * Stop the random notification service
   */
  stop() {
    if (!this.isRunning) {
      console.log('Random notification service is not running');
      return;
    }

    console.log('Stopping random notification service');
    this.isRunning = false;
    
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Schedule the next random notification
   */
  scheduleNextNotification() {
    if (!this.isRunning) return;

    // Calculate a random interval between min and max hours (converted to milliseconds)
    const intervalHours = Math.random() * (this.maxIntervalHours - this.minIntervalHours) + this.minIntervalHours;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    console.log(`Scheduling next random notification in ${intervalHours.toFixed(2)} hours`);

    // Schedule the next notification
    this.timerId = setTimeout(async () => {
      // Check if current hour is within active hours
      const currentHour = new Date().getHours();
      
      if (currentHour >= this.activeHoursStart && currentHour < this.activeHoursEnd) {
        console.log(`Sending random notification at ${new Date().toLocaleTimeString()}`);
        
        try {
          // Send the notification
          await sendRandomEngagementQuestion();
        } catch (error) {
          console.error('Error sending random notification:', error);
        }
      } else {
        console.log(`Current hour (${currentHour}) is outside active hours (${this.activeHoursStart}-${this.activeHoursEnd}). Skipping notification.`);
      }

      // Schedule the next notification
      this.scheduleNextNotification();
    }, intervalMs);
  }
}

// Create a singleton instance
const randomNotificationService = new RandomNotificationService();

module.exports = randomNotificationService;