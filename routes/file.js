const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const requestIp = require('request-ip');
const cookieParser = require('cookie-parser');

// Middleware to parse cookies and get IP address
router.use(cookieParser());
router.use(requestIp.mw());

router.get('/logs', (req, res) => {
  // Get user's public and private IP address
  const publicIp = req.clientIp; // Public IP
  const privateIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress; // Private IP
  
  // Get cookies
  const cookies = req.cookies;

  // Create an object to store the data
  const data = {
    publicIp,
    privateIp,
    cookies,
  };
  console.log(data);

  // Sanitize the public IP for use in a filename
  const sanitizedPublicIp = publicIp.replace(/[:.]/g, '-'); // Replace colon and period characters

  // Specify the path for the JSON file, using the IP in the filename
  const filePath = path.join(__dirname, 'funstore', `userData_${sanitizedPublicIp}.json`);

  // Save the data to a JSON file
  fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
    if (err) {
      console.error('Error writing to file:', err);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }

    // Send the funny HTML response
    const htmlFilePath = path.join(__dirname, 'funstore', 'funnyResponse.html');
    res.sendFile(htmlFilePath);
  });
});
const funFacts = [
  "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old!",
  "Bananas are berries, but strawberries aren't!",
  "Octopuses have three hearts, nine brains, and blue blood.",
  "You can't hum while holding your nose closed.",
  "A group of flamingos is called a 'flamboyance'.",
  "There are more stars in the universe than grains of sand on all the world's beaches.",
  "Tigers' skin is actually striped, just like their fur.",
  "Cows have best friends and get stressed when they are separated.",
  "You can hear a blue whale's heartbeat from more than 2 miles away.",
  "Wombat poop is cube-shaped."
];

// New route for serving random fun facts
const axios = require('axios'); // You'll need axios for making the API request

router.get('/funfact', async (req, res) => {
  try {
    // Fetch a random joke from the API
    const jokeResponse = await axios.get('https://official-joke-api.appspot.com/random_joke');
    const joke = jokeResponse.data;

    // Function to generate a random color for the background
    const getRandomColor = () => {
      const letters = '0123456789ABCDEF';
      let color = '#';
      for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
      }
      return color;
    };

    // Generate random background color
    const randomBgColor = getRandomColor();

    // Send a funny HTML response with the joke and random background color
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Random Joke</title>
        <style>
          body {
            font-family: 'Comic Sans MS', cursive, sans-serif;
            background-color: ${randomBgColor};
            color: #333;
            text-align: center;
            padding: 50px;
            transition: background-color 0.5s;
          }
          h1 {
            color: #ff6347;
            font-size: 3.5em;
            text-shadow: 2px 2px #b2ebf2;
          }
          .fun-box {
            display: inline-block;
            padding: 30px;
            border: 3px solid #ff4500;
            border-radius: 20px;
            background: #ffffff;
            box-shadow: 10px 10px 0px #ffa07a;
            animation: bounce 1s ease-in-out infinite;
          }
          @keyframes bounce {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-10px);
            }
          }
          p {
            font-size: 1.5em;
            color: #00796b;
          }
          .button {
            display: inline-block;
            padding: 15px 30px;
            margin-top: 30px;
            background-color: #ff4500;
            color: white;
            font-size: 1.5em;
            text-decoration: none;
            border-radius: 10px;
            transition: background-color 0.3s;
          }
          .button:hover {
            background-color: #ff6347;
          }
          .emoji {
            font-size: 2em;
          }
        </style>
      </head>
      <body>
        <div class="fun-box">
          <h1>Here's a Joke! <span class="emoji">😂</span></h1>
          <p><strong></strong> ${joke.setup}</p>
          <p><strong>:</strong> ${joke.punchline}</p>
          <a class="button" href="/private/funfact">Another Joke 🎉</a>
          <br />
          <a class="button" href="/index">Go Home 🏡</a>
        </div>
      </body>
      </html>
    `;

    // Send the joke as an HTML response
    res.send(htmlContent);

  } catch (error) {
    console.error('Error fetching joke:', error);
    res.status(500).send('Oops! Something went wrong while fetching a joke.');
  }
});



module.exports = router;
