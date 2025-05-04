require('dotenv').config();
const { sendRandomEngagementQuestion } = require('./random-engagement-notifications');

console.log('Triggering random engagement notification...');
sendRandomEngagementQuestion()
  .then(() => console.log('Random notification triggered successfully'))
  .catch(err => console.error('Error triggering random notification:', err));