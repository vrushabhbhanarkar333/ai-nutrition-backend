const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create a test image for AI chat testing
function createTestImage() {
  // Create a 500x500 canvas
  const width = 500;
  const height = 500;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  // Fill the background
  context.fillStyle = '#f5f5f5';
  context.fillRect(0, 0, width, height);

  // Draw a plate
  context.beginPath();
  context.arc(width/2, height/2, 200, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();
  context.strokeStyle = '#cccccc';
  context.lineWidth = 2;
  context.stroke();

  // Draw some "food" items
  // Chicken (protein)
  context.fillStyle = '#e8c39e';
  context.fillRect(width/2 - 80, height/2 - 60, 160, 80);
  
  // Rice (carbs)
  context.fillStyle = '#f9f9f9';
  context.beginPath();
  context.arc(width/2 - 100, height/2 + 60, 60, 0, Math.PI * 2);
  context.fill();
  
  // Broccoli (vegetables)
  context.fillStyle = '#3a7d44';
  context.beginPath();
  context.arc(width/2 + 100, height/2 + 60, 50, 0, Math.PI * 2);
  context.fill();
  
  // Add text
  context.font = '20px Arial';
  context.fillStyle = '#333333';
  context.textAlign = 'center';
  context.fillText('Test Meal: Chicken, Rice, and Broccoli', width/2, height - 50);

  // Save the image
  const buffer = canvas.toBuffer('image/jpeg');
  fs.writeFileSync(path.join(__dirname, 'test-meal.jpg'), buffer);
  
  console.log('Test image created: test-meal.jpg');
}

createTestImage();