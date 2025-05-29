const mysql = require('mysql2');
require("dotenv").config();

// Create a MySQL connection pool

const connection = mysql.createConnection({
  host: process.env.MYSQLHOSTDEV,       // Replace with your MySQL host
  user: process.env.MYSQLUSER,            // Replace with your MySQL username
  password: process.env.MYSQLPASSWORDDEV,    // Replace with your MySQL password
  database: process.env.DATABASEMYSQL2  ,
  port: process.env.MYSQLPORT,
  
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

