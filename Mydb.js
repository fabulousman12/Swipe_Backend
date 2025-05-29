const mysql = require('mysql2');
require("dotenv").config();

// Create a MySQL connection pool

const connection = mysql.createConnection({
  host: process.env.External_MySQL_HOST,       // Replace with your MySQL host
  user: process.env.External_MySQL_USER,            // Replace with your MySQL username
  password: process.env.External_MySQL_PASSWORD,    // Replace with your MySQL password
  database: process.env.External_MySQL_DATABASE  ,
  port: process.env.External_MySQL_PORT,
  
  // Replace with your MySQL database name
});

// Connect to MySQL

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err.stack);

    return;
  }
  console.log('Connected to MySQL as ID:', connection.threadId);
 

});

module.exports = connection;

